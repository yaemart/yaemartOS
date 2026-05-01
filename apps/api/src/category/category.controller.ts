import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../iam/casbin.guard';
import { RequirePolicy } from '../iam/require-policy.decorator';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Controller('categories')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @RequirePolicy({ obj: 'categories', act: 'read', field: '*' })
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('brandId') brandId?: string,
    @Query('search') search?: string,
  ) {
    return this.categoryService.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      brandId,
      search,
    });
  }

  @Get(':id')
  @RequirePolicy({ obj: 'categories', act: 'read', field: '*' })
  async getById(@Param('id') id: string) {
    return this.categoryService.getById(id);
  }

  @Post()
  @RequirePolicy({ obj: 'categories', act: 'write', field: '*' })
  async create(@Body() body: CreateCategoryDto, @Req() req: Request) {
    return this.categoryService.create(body, this.actor(req));
  }

  @Patch(':id')
  @RequirePolicy({ obj: 'categories', act: 'write', field: '*' })
  async update(@Param('id') id: string, @Body() body: UpdateCategoryDto, @Req() req: Request) {
    return this.categoryService.update(id, body, this.actor(req));
  }

  @Delete(':id')
  @RequirePolicy({ obj: 'categories', act: 'write', field: '*' })
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.categoryService.remove(id, this.actor(req));
  }

  @Get(':id/template')
  @RequirePolicy({ obj: 'categories', act: 'read', field: '*' })
  async getTemplate(
    @Param('id') categoryId: string,
    @Query('locale') locale?: 'en' | 'es' | 'fr' | 'de' | 'it',
  ) {
    return this.categoryService.getTemplate(categoryId, locale);
  }

  @Put(':id/template')
  @RequirePolicy({ obj: 'categories', act: 'write', field: '*' })
  async upsertTemplate(
    @Param('id') categoryId: string,
    @Body() body: UpdateTemplateDto,
    @Req() req: Request,
  ) {
    return this.categoryService.upsertTemplate(categoryId, body, this.actor(req));
  }

  private actor(req: Request): { id?: string; brandId?: string } {
    const user = req.user as { id?: string; brandId?: string } | undefined;
    return { id: user?.id, brandId: user?.brandId };
  }
}
