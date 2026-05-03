import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { TenantSchema } from '@yaemartos/db';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../iam/casbin.guard';
import { RequirePolicy } from '../../iam/require-policy.decorator';
import { AdminManualService } from './admin-manual.service';

const ALLOWED_MANUAL_MIMES = new Set(['application/pdf', 'application/zip', 'text/html']);
const MAX_MANUAL_BYTES = 50 * 1024 * 1024;

class UploadManualDto {
  productSku!: string;
  locale!: string;
  brandId!: TenantSchema;
}

@Controller('admin/manuals')
@UseGuards(JwtAuthGuard, CasbinGuard)
@RequirePolicy({ obj: 'product_manuals', act: 'update', field: '*' })
export class AdminManualController {
  constructor(private readonly adminManualService: AdminManualService) {}

  /**
   * Upload or replace a product manual for a specific SKU + locale.
   * Idempotent: calling again replaces the existing file and Cloudinary asset.
   */
  @Post()
  @UseInterceptors(FileInterceptor('manualFile'))
  async upsert(@Body() dto: UploadManualDto, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('manualFile is required');
    }
    if (!ALLOWED_MANUAL_MIMES.has(file.mimetype)) {
      throw new BadRequestException('Manual must be PDF, ZIP, or HTML');
    }
    if (file.size > MAX_MANUAL_BYTES) {
      throw new BadRequestException('Manual file size must not exceed 50 MB');
    }
    if (!dto.productSku || !dto.locale || !dto.brandId) {
      throw new BadRequestException('productSku, locale, and brandId are required');
    }

    return this.adminManualService.upsertManual(
      dto.brandId,
      dto.productSku,
      dto.locale,
      file.buffer,
      file.originalname,
    );
  }

  /** Delete a product manual for a specific SKU + locale. */
  @Delete(':sku/:locale')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('sku') sku: string,
    @Param('locale') locale: string,
    @Body('brandId') brandId: TenantSchema,
  ) {
    if (!brandId) {
      throw new BadRequestException('brandId is required in request body');
    }
    await this.adminManualService.deleteManual(brandId, sku, locale);
  }
}
