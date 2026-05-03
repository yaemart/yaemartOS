import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import type { TenantSchema } from '@yaemartos/db';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../iam/casbin.guard';
import { RequirePolicy } from '../../iam/require-policy.decorator';
import { AdminWarrantyService } from './admin-warranty.service';

class UpdateWarrantyStatusDto {
  @IsString()
  @IsIn(['active', 'expired', 'void'])
  status!: string;
}

@Controller('admin/warranties')
@UseGuards(JwtAuthGuard, CasbinGuard)
@RequirePolicy({ obj: 'warranties', act: 'read', field: '*' })
export class AdminWarrantyController {
  constructor(private readonly adminWarrantyService: AdminWarrantyService) {}

  /** List warranty registrations across all brands or a specific brand. */
  @Get()
  findAll(
    @Query('brandId') brandId?: string,
    @Query('status') status?: string,
    @Query('productSku') productSku?: string,
    @Query('customerId') customerId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminWarrantyService.findAll({
      brandId,
      status,
      productSku,
      customerId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  /** Get a single warranty registration. Requires brandId query param. */
  @Get(':warrantyId')
  findOne(@Param('warrantyId') warrantyId: string, @Query('brandId') brandId?: string) {
    if (!brandId) {
      throw new BadRequestException('brandId query parameter is required');
    }
    return this.adminWarrantyService.findOne(brandId as TenantSchema, warrantyId);
  }

  /** Update warranty status (e.g. void an invalid registration). */
  @Patch(':warrantyId/status')
  @RequirePolicy({ obj: 'warranties', act: 'update', field: '*' })
  updateStatus(
    @Param('warrantyId') warrantyId: string,
    @Query('brandId') brandId: string,
    @Body() dto: UpdateWarrantyStatusDto,
  ) {
    if (!brandId) {
      throw new BadRequestException('brandId query parameter is required');
    }
    return this.adminWarrantyService.updateStatus(brandId as TenantSchema, warrantyId, dto.status);
  }
}
