import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../iam/casbin.guard';
import { RequirePolicy } from '../iam/require-policy.decorator';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingService } from './listing.service';
import { ListingVersionService } from './listing-version.service';

@Controller('listings')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class ListingController {
  constructor(
    private readonly listingService: ListingService,
    private readonly versionService: ListingVersionService,
  ) {}

  @Get()
  @RequirePolicy({ obj: 'listings', act: 'read', field: '*' })
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('productId') productId?: string,
    @Query('brandId') brandId?: string,
    @Query('status') status?: string,
  ) {
    return this.listingService.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      productId,
      brandId,
      status,
    });
  }

  @Get(':id')
  @RequirePolicy({ obj: 'listings', act: 'read', field: '*' })
  async getById(@Param('id') id: string) {
    return this.listingService.getById(id);
  }

  @Post()
  @RequirePolicy({ obj: 'listings', act: 'write', field: '*' })
  async create(@Body() body: CreateListingDto, @Req() req: Request) {
    return this.listingService.create(body, this.actor(req));
  }

  @Patch(':id')
  @RequirePolicy({ obj: 'listings', act: 'write', field: '*' })
  async update(@Param('id') id: string, @Body() body: UpdateListingDto, @Req() req: Request) {
    return this.listingService.update(id, body, this.actor(req));
  }

  @Delete(':id')
  @RequirePolicy({ obj: 'listings', act: 'write', field: '*' })
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.listingService.remove(id, this.actor(req));
  }

  @Get(':id/versions')
  @RequirePolicy({ obj: 'listings', act: 'read', field: '*' })
  async listVersions(@Param('id') id: string) {
    return this.versionService.listVersions(id);
  }

  @Patch(':id/versions/:versionNumber/activate')
  @RequirePolicy({ obj: 'listings', act: 'write', field: '*' })
  @HttpCode(HttpStatus.OK)
  async activateVersion(
    @Param('id') id: string,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
    @Req() req: Request,
  ) {
    return this.versionService.activateVersion(id, versionNumber, this.actor(req));
  }

  private actor(req: Request): { id?: string; brandId?: string } {
    const user = req.user as { id?: string; brandId?: string } | undefined;
    return { id: user?.id, brandId: user?.brandId };
  }
}
