import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { TenantSchema } from '@yaemartos/db';
import { PrismaClientManager } from '../../database/prisma.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';

export interface AdminManualRecord {
  id: string;
  productSku: string;
  locale: string;
  filename: string;
  publicId: string;
  secureUrl: string;
  uploadedAt: Date;
}

@Injectable()
export class AdminManualService {
  private readonly logger = new Logger(AdminManualService.name);

  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async upsertManual(
    brandId: TenantSchema,
    productSku: string,
    locale: string,
    fileBuffer: Buffer,
    filename: string,
  ): Promise<AdminManualRecord> {
    const db = this.prismaManager.getTenantClient(brandId) as any;

    // Delete old Cloudinary asset if one exists
    const existing = await db.productManual.findUnique({
      where: { productSku_locale: { productSku, locale } },
    });
    if (existing?.publicId) {
      await this.cloudinary
        .deleteRaw(existing.publicId)
        .catch((err: unknown) =>
          this.logger.warn(`Failed to delete old manual asset: ${String(err)}`),
        );
    }

    const uploadId = `${productSku}-${locale}-${Date.now()}`;
    const result = await this.cloudinary.uploadPublicRaw(
      fileBuffer,
      brandId,
      'manuals',
      uploadId,
      filename,
    );

    const record = await db.productManual.upsert({
      where: { productSku_locale: { productSku, locale } },
      create: {
        productSku,
        locale,
        filename,
        publicId: result.publicId,
        secureUrl: result.secureUrl,
      },
      update: {
        filename,
        publicId: result.publicId,
        secureUrl: result.secureUrl,
        uploadedAt: new Date(),
      },
    });

    return record as AdminManualRecord;
  }

  async deleteManual(brandId: TenantSchema, productSku: string, locale: string): Promise<void> {
    const db = this.prismaManager.getTenantClient(brandId) as any;
    const record = await db.productManual.findUnique({
      where: { productSku_locale: { productSku, locale } },
    });
    if (!record) {
      throw new NotFoundException(`Manual not found for sku=${productSku} locale=${locale}`);
    }

    await this.cloudinary
      .deleteRaw(record.publicId)
      .catch((err: unknown) =>
        this.logger.warn(`Cloudinary delete failed for ${record.publicId}: ${String(err)}`),
      );

    await db.productManual.delete({
      where: { productSku_locale: { productSku, locale } },
    });
  }
}
