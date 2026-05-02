import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
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
import { FAQ_GENERATION_SERVICE } from '../ai/tokens';
import type { FaqGenerationService } from '../ai/providers/faq-generation.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductService } from './product.service';

@Controller('products')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    @Inject(FAQ_GENERATION_SERVICE) private readonly faqService: FaqGenerationService,
  ) {}

  @Get()
  @RequirePolicy({ obj: 'products', act: 'read', field: '*' })
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('brandId') brandId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('source') source?: 'manual' | 'category_inherit' | 'ai_generated' | 'erp_import',
  ) {
    return this.productService.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      brandId,
      categoryId,
      search,
      source,
    });
  }

  @Get(':id')
  @RequirePolicy({ obj: 'products', act: 'read', field: '*' })
  async getById(@Param('id') id: string) {
    return this.productService.getById(id);
  }

  @Post()
  @RequirePolicy({ obj: 'products', act: 'write', field: '*' })
  async create(@Body() body: CreateProductDto, @Req() req: Request) {
    return this.productService.create(body, this.actor(req));
  }

  @Patch(':id')
  @RequirePolicy({ obj: 'products', act: 'write', field: '*' })
  async update(@Param('id') id: string, @Body() body: UpdateProductDto, @Req() req: Request) {
    return this.productService.update(id, body, this.actor(req));
  }

  @Put(':id/content')
  @RequirePolicy({ obj: 'products', act: 'write', field: '*' })
  async updateContent(
    @Param('id') id: string,
    @Body() body: UpdateContentDto,
    @Req() req: Request,
  ) {
    return this.productService.updateContent(id, body, this.actor(req));
  }

  @Post(':id/faq')
  @RequirePolicy({ obj: 'products', act: 'write', field: '*' })
  async generateFaq(@Param('id') id: string, @Query('locale') locale: string = 'en') {
    return this.faqService.generateFaq(id, locale);
  }

  @Delete(':id')
  @RequirePolicy({ obj: 'products', act: 'write', field: '*' })
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.productService.remove(id, this.actor(req));
  }

  private actor(req: Request): { id?: string; brandId?: string } {
    const user = req.user as { id?: string; brandId?: string } | undefined;
    return { id: user?.id, brandId: user?.brandId };
  }
}
