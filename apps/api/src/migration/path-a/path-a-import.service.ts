import { Injectable, Logger } from '@nestjs/common';
import { LocaleCode, ListingStatus, Prisma, ProductContentSource } from '../../generated/prisma';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaClientManager } from '../../database/prisma.service';
import { pickLatestBySku } from './conflict-rules';
import { mapLingxingPathAExtraction } from './mapping';
import { normalizePathARecord } from './normalize';
import type { PathAExtractionInput, PathAExtractionResult, PathANormalizedRecord } from './types';

type ImportSummary = {
  runId: string;
  total: number;
  deduplicated: number;
  imported: number;
  failed: number;
  failures: Array<{ sku: string; reason: string }>;
};

@Injectable()
export class PathAImportService {
  private readonly logger = new Logger(PathAImportService.name);

  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly auditService: AuditService,
  ) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  async importFromExtractionInputs(inputs: PathAExtractionInput[]): Promise<ImportSummary> {
    if (inputs.length === 0) {
      return {
        runId: 'empty-run',
        total: 0,
        deduplicated: 0,
        imported: 0,
        failed: 0,
        failures: [],
      };
    }

    const mappedRecords = inputs.map((input) => mapLingxingPathAExtraction(input));
    return this.importMappedRecords(mappedRecords);
  }

  async importMappedRecords(records: PathAExtractionResult[]): Promise<ImportSummary> {
    if (records.length === 0) {
      return {
        runId: 'empty-run',
        total: 0,
        deduplicated: 0,
        imported: 0,
        failed: 0,
        failures: [],
      };
    }

    const runId = records[0].runId;
    const deduplicated = pickLatestBySku(records);
    const summary: ImportSummary = {
      runId,
      total: records.length,
      deduplicated: deduplicated.length,
      imported: 0,
      failed: 0,
      failures: [],
    };

    for (const record of deduplicated) {
      try {
        const normalized = normalizePathARecord(record);
        await this.upsertNormalizedRecord(normalized);
        summary.imported += 1;
      } catch (error) {
        summary.failed += 1;
        summary.failures.push({
          sku: record.sku,
          reason: error instanceof Error ? error.message : 'unknown error',
        });
      }
    }

    await this.auditService.logWrite({
      action: 'path_a.import.run',
      entity: 'PathAImport',
      entityId: runId,
      metadata: summary,
    });

    this.logger.log(
      `Path A import finished run=${runId} imported=${summary.imported} failed=${summary.failed}`,
    );
    return summary;
  }

  protected async upsertNormalizedRecord(record: PathANormalizedRecord): Promise<void> {
    const brandId = record.brandId;
    const market = await this.prisma.market.findUnique({
      where: { brandId_code: { brandId, code: record.marketCode } },
      select: { id: true },
    });
    if (!market) {
      throw new Error(`market not found: ${record.marketCode} for brand ${brandId}`);
    }

    const platform = await this.prisma.platform.findUnique({
      where: { code: record.platformCode },
      select: { id: true },
    });
    if (!platform) {
      throw new Error(`platform not found: ${record.platformCode}`);
    }

    const categoryId = await this.resolveCategoryId(brandId, record.categoryName);

    await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.upsert({
        where: { brandId_sku: { brandId, sku: record.sku } },
        create: {
          brandId,
          categoryId,
          sku: record.sku,
          title: record.title,
          description: record.description || null,
        },
        update: {
          categoryId,
          title: record.title,
          description: record.description || null,
        },
      });

      await tx.productContent.upsert({
        where: {
          productId_locale_source: {
            productId: product.id,
            locale: LocaleCode.en,
            source: ProductContentSource.erp_import,
          },
        },
        create: {
          productId: product.id,
          locale: LocaleCode.en,
          source: ProductContentSource.erp_import,
          payload: {
            title: record.title,
            bullets: record.bulletPoints,
            description: record.description,
            searchTerms: record.searchTerms,
            sourceRecordId: record.sourceRecordId,
            runId: record.runId,
            needsManualReview: record.needsManualReview,
          } satisfies Prisma.InputJsonValue,
        },
        update: {
          payload: {
            title: record.title,
            bullets: record.bulletPoints,
            description: record.description,
            searchTerms: record.searchTerms,
            sourceRecordId: record.sourceRecordId,
            runId: record.runId,
            needsManualReview: record.needsManualReview,
          } satisfies Prisma.InputJsonValue,
        },
      });

      const shop = await this.resolveShop(
        tx,
        brandId,
        market.id,
        platform.id,
        record.lingxingShopId,
      );
      const platformListingId = record.asin ?? `PATHA-${record.sku}`;

      const listing = await tx.listing.upsert({
        where: {
          platformId_shopId_platformListingId: {
            platformId: platform.id,
            shopId: shop.id,
            platformListingId,
          },
        },
        create: {
          productId: product.id,
          brandId,
          marketId: market.id,
          platformId: platform.id,
          shopId: shop.id,
          language: LocaleCode.en,
          platformListingId,
          status: ListingStatus.draft,
          title: record.title,
          bullets: record.bulletPoints as Prisma.InputJsonValue,
          description: record.description || null,
          searchTerms: record.searchTerms.join(' '),
        },
        update: {
          productId: product.id,
          title: record.title,
          bullets: record.bulletPoints as Prisma.InputJsonValue,
          description: record.description || null,
          searchTerms: record.searchTerms.join(' '),
        },
      });

      const latestVersion = await tx.listingVersion.findFirst({
        where: { listingId: listing.id },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });

      await tx.listingVersion.create({
        data: {
          listingId: listing.id,
          versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
          contentSnapshot: {
            title: record.title,
            bullets: record.bulletPoints,
            description: record.description,
            searchTerms: record.searchTerms,
            importedAt: new Date().toISOString(),
            runId: record.runId,
          } satisfies Prisma.InputJsonValue,
        },
      });
    });
  }

  private async resolveCategoryId(brandId: string, categoryName: string | null): Promise<string> {
    if (categoryName) {
      const matched = await this.prisma.category.findFirst({
        where: {
          brandId,
          OR: [
            { name: { equals: categoryName, mode: 'insensitive' } },
            {
              slug: {
                equals: categoryName.toLowerCase().replace(/\s+/g, '-'),
                mode: 'insensitive',
              },
            },
          ],
        },
        select: { id: true },
      });
      if (matched) {
        return matched.id;
      }
    }

    const fallback = await this.prisma.category.findFirst({
      where: { brandId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!fallback) {
      throw new Error(`no category found for brand ${brandId}`);
    }
    return fallback.id;
  }

  private async resolveShop(
    tx: Prisma.TransactionClient,
    brandId: string,
    marketId: string,
    platformId: string,
    lingxingShopId: string | null,
  ) {
    if (lingxingShopId) {
      const bound = await tx.shop.findFirst({
        where: {
          brandId,
          marketId,
          platformId,
          binding: {
            lingxingShopId,
          },
        },
        select: { id: true },
      });
      if (bound) {
        return bound;
      }
    }

    const existing = await tx.shop.findFirst({
      where: { brandId, marketId, platformId, isActive: true },
      select: { id: true },
    });
    if (existing) {
      return existing;
    }

    return tx.shop.create({
      data: {
        brandId,
        marketId,
        platformId,
        name: 'Homtone US Amazon (Path A)',
        externalId: `path-a-${brandId}-${marketId}-${platformId}`,
      },
      select: { id: true },
    });
  }
}
