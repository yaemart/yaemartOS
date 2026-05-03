import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TENANT_SCHEMAS, type TenantSchema } from '@yaemartos/db';
import { PrismaClientManager } from '../../database/prisma.service';

export interface WarrantyRegistrationRow {
  id: string;
  customerId: string;
  productSku: string;
  serialNumber: string;
  purchaseDate: Date;
  warrantyExpiresAt: Date | null;
  status: string;
  registeredAt: Date;
  brand: string;
}

export interface AdminWarrantyListResult {
  results: WarrantyRegistrationRow[];
  total: number;
  page: number;
  limit: number;
  partialFailures: string[];
}

interface FilterOptions {
  brandId?: string;
  status?: string;
  productSku?: string;
  customerId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AdminWarrantyService {
  private readonly logger = new Logger(AdminWarrantyService.name);

  constructor(private readonly prismaManager: PrismaClientManager) {}

  async findAll(filters: FilterOptions = {}): Promise<AdminWarrantyListResult> {
    const { brandId, status, productSku, customerId, page = 1, limit = 50 } = filters;
    const clampedLimit = Math.min(limit, 100);
    const PER_SCHEMA_MAX = Math.min(clampedLimit * page * 2, 500);

    const schemas = brandId ? TENANT_SCHEMAS.filter((s) => s === brandId) : [...TENANT_SCHEMAS];

    const schemaResults = await Promise.allSettled(
      schemas.map(async (schema) => {
        const db = this.prismaManager.getTenantClient(schema as TenantSchema) as any;
        const rows = await db.warrantyRegistration.findMany({
          where: {
            ...(status ? { status } : {}),
            ...(productSku ? { productSku } : {}),
            ...(customerId ? { customerId } : {}),
          },
          orderBy: { registeredAt: 'desc' },
          take: PER_SCHEMA_MAX,
          select: {
            id: true,
            customerId: true,
            productSku: true,
            serialNumber: true,
            purchaseDate: true,
            warrantyExpiresAt: true,
            status: true,
            registeredAt: true,
          },
        });
        return { schema, rows };
      }),
    );

    const all: WarrantyRegistrationRow[] = [];
    const partialFailures: string[] = [];

    for (const result of schemaResults) {
      if (result.status === 'fulfilled') {
        all.push(...result.value.rows.map((r: any) => ({ ...r, brand: result.value.schema })));
      } else {
        const failedSchema = schemas[schemaResults.indexOf(result)];
        const reason =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        this.logger.error(`Warranty aggregation failed for schema ${failedSchema}: ${reason}`);
        partialFailures.push(failedSchema);
      }
    }

    all.sort((a, b) => b.registeredAt.getTime() - a.registeredAt.getTime());

    const total = all.length;
    const skip = (page - 1) * clampedLimit;
    const results = all.slice(skip, skip + clampedLimit);

    return { results, total, page, limit: clampedLimit, partialFailures };
  }

  async findOne(brandId: TenantSchema, warrantyId: string): Promise<WarrantyRegistrationRow> {
    const db = this.prismaManager.getTenantClient(brandId) as any;
    const row = await db.warrantyRegistration.findUnique({
      where: { id: warrantyId },
    });
    if (!row) {
      throw new NotFoundException(`Warranty ${warrantyId} not found in brand ${brandId}`);
    }
    return { ...row, brand: brandId };
  }

  async updateStatus(
    brandId: TenantSchema,
    warrantyId: string,
    status: string,
  ): Promise<WarrantyRegistrationRow> {
    const db = this.prismaManager.getTenantClient(brandId) as any;
    const existing = await db.warrantyRegistration.findUnique({ where: { id: warrantyId } });
    if (!existing) {
      throw new NotFoundException(`Warranty ${warrantyId} not found in brand ${brandId}`);
    }
    const updated = await db.warrantyRegistration.update({
      where: { id: warrantyId },
      data: { status },
    });
    return { ...updated, brand: brandId };
  }
}
