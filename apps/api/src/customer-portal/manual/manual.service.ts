import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRISMA_TENANT_CLIENT } from '../../database/database.tokens';
import { TenantPrismaClient } from '../../database/tenant-prisma.types';

export interface ManualItem {
  productSku: string;
  locale: string;
  filename: string;
  secureUrl: string;
}

@Injectable()
export class ManualService {
  constructor(@Inject(PRISMA_TENANT_CLIENT) private readonly tenantDb: TenantPrismaClient) {}

  async listManuals(productSku?: string): Promise<ManualItem[]> {
    const where = productSku ? { productSku } : {};
    const rows = await this.tenantDb.productManual.findMany({
      where,
      orderBy: [{ productSku: 'asc' }, { locale: 'asc' }],
      select: { productSku: true, locale: true, filename: true, secureUrl: true },
    });
    return rows;
  }

  async getManual(productSku: string, locale: string): Promise<ManualItem> {
    const row = await this.tenantDb.productManual.findUnique({
      where: { productSku_locale: { productSku, locale } },
      select: { productSku: true, locale: true, filename: true, secureUrl: true },
    });

    if (!row) {
      const fallback = await this.tenantDb.productManual.findFirst({
        where: { productSku, locale: 'en' },
        select: { productSku: true, locale: true, filename: true, secureUrl: true },
      });
      if (!fallback) {
        throw new NotFoundException(`Manual not found for sku=${productSku} locale=${locale}`);
      }
      return fallback;
    }

    return row;
  }
}
