import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, TrafficStrategy, Prisma } from '../generated/prisma';
import { AuditService } from '../common/audit/audit.service';
import { PrismaClientManager } from '../database/prisma.service';
import { EmbeddingService } from '../ai/embedding.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

type Actor = {
  id?: string;
  brandId?: string;
};

/** Auditable field snapshot — excludes large text fields (bullets/description) to keep metadata compact. */
type ListingSnapshot = {
  id: string;
  status: string;
  title: string | null;
  isPrimary: boolean;
  trafficStrategy: string;
  updatedAt: Date;
};

type ListListingsQuery = {
  page?: number;
  pageSize?: number;
  productId?: string;
  brandId?: string;
  status?: string;
  shopId?: string;
  platformId?: string;
};

/**
 * Valid forward-only status transitions.
 * Published listings can also be paused or archived; archived is terminal.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['review', 'archived'],
  review: ['approved', 'draft', 'archived'],
  approved: ['published', 'review', 'archived'],
  published: ['paused', 'archived'],
  paused: ['published', 'archived'],
  archived: [],
};

@Injectable()
export class ListingService {
  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly auditService: AuditService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  async list(query: ListListingsQuery) {
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100);

    const where: Prisma.ListingWhereInput = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.status ? { status: query.status as ListingStatus } : {}),
      ...(query.shopId ? { shopId: query.shopId } : {}),
      ...(query.platformId ? { platformId: query.platformId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: {
          product: { select: { id: true, sku: true, title: true } },
          _count: { select: { versions: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getById(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        product: true,
        platform: { select: { code: true } },
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });
    if (!listing) {
      throw new NotFoundException(`Listing not found: ${id}`);
    }
    return listing;
  }

  async create(input: CreateListingDto, actor?: Actor) {
    try {
      const listing = await this.prisma.$transaction(async (tx) => {
        const created = await tx.listing.create({
          data: {
            productId: input.productId,
            brandId: input.brandId,
            marketId: input.marketId,
            platformId: input.platformId,
            shopId: input.shopId,
            language: input.language as any,
            platformListingId: input.platformListingId,
            isPrimary: input.isPrimary ?? false,
            trafficStrategy: (input.trafficStrategy as TrafficStrategy) ?? TrafficStrategy.primary,
          },
        });

        if (input.isPrimary) {
          await this.demoteOtherPrimaries(tx, created.id, {
            productId: input.productId,
            brandId: input.brandId,
            marketId: input.marketId,
            platformId: input.platformId,
            shopId: input.shopId,
            language: input.language,
          });
        }

        return created;
      });

      await this.auditService.logWrite({
        userId: actor?.id,
        tenant: actor?.brandId ?? input.brandId,
        action: 'listing.create',
        entity: 'Listing',
        entityId: listing.id,
        metadata: {
          before: null,
          after: this.snapshotListing(listing),
          productId: input.productId,
          brandId: input.brandId,
        },
      });

      return this.getById(listing.id);
    } catch (error) {
      this.rethrowConflict(error, 'platformListingId already exists for this platform/shop');
    }
  }

  async update(id: string, input: UpdateListingDto, actor?: Actor) {
    const listing = await this.assertExists(id);
    const before = this.snapshotListing(listing);

    if (input.status !== undefined) {
      const allowed = ALLOWED_TRANSITIONS[listing.status] ?? [];
      if (!allowed.includes(input.status)) {
        throw new BadRequestException(
          `Cannot transition listing status from "${listing.status}" to "${input.status}"`,
        );
      }
    }

    let demotedIds: string[] = [];

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.listing.update({
        where: { id },
        data: {
          ...(input.status !== undefined ? { status: input.status as ListingStatus } : {}),
          ...(input.trafficStrategy !== undefined
            ? { trafficStrategy: input.trafficStrategy as TrafficStrategy }
            : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.bullets !== undefined ? { bullets: input.bullets } : {}),
          ...(input.searchTerms !== undefined ? { searchTerms: input.searchTerms } : {}),
          ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
        },
      });

      if (input.isPrimary === true) {
        demotedIds = await this.demoteOtherPrimaries(tx, id, {
          productId: listing.productId,
          brandId: listing.brandId,
          marketId: listing.marketId,
          platformId: listing.platformId,
          shopId: listing.shopId,
          language: listing.language,
        });
      }

      return result;
    });

    await this.auditService.logWrite({
      userId: actor?.id,
      tenant: actor?.brandId,
      action: 'listing.update',
      entity: 'Listing',
      entityId: id,
      metadata: {
        before,
        after: this.snapshotListing(updated),
        changedFields: Object.keys(input),
        ...(demotedIds.length > 0 ? { demotedIds } : {}),
      },
    });

    return updated;
  }

  async remove(id: string, actor?: Actor) {
    const listing = await this.assertExists(id);

    if (listing.status !== ListingStatus.archived) {
      throw new BadRequestException('Only archived listings can be deleted');
    }

    const before = this.snapshotListing(listing);
    await this.prisma.listing.delete({ where: { id } });

    await this.auditService.logWrite({
      userId: actor?.id,
      tenant: actor?.brandId,
      action: 'listing.delete',
      entity: 'Listing',
      entityId: id,
      metadata: { before, after: null },
    });

    return { id, deleted: true };
  }

  async getMatrix(productId: string, brandId: string) {
    const listings = await this.prisma.listing.findMany({
      where: { productId, brandId, status: { not: ListingStatus.archived } },
      include: {
        platform: { select: { code: true, name: true } },
        shop: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const items = listings.filter((l) => !!l.title).map((l) => ({ id: l.id, text: l.title! }));

    const similarityMatrix =
      items.length >= 2 ? await this.embeddingService.pairwiseSimilarity(items) : {};

    const strategyDistribution = listings.reduce<Record<string, number>>((acc, l) => {
      acc[l.trafficStrategy] = (acc[l.trafficStrategy] ?? 0) + 1;
      return acc;
    }, {});

    return {
      listings: listings.map((l) => ({
        id: l.id,
        title: l.title,
        platformCode: l.platform.code,
        platformName: l.platform.name,
        shopName: l.shop.name,
        trafficStrategy: l.trafficStrategy,
        isPrimary: l.isPrimary,
        status: l.status,
        language: l.language,
      })),
      similarityMatrix,
      strategyDistribution,
      salesAvailableFrom: 'S4' as const,
    };
  }

  async resolvePlatformId(platformCode: string): Promise<string> {
    const platform = await this.prisma.platform.findUnique({
      where: { code: platformCode as any },
      select: { id: true },
    });
    if (!platform) {
      throw new NotFoundException(`Platform not found: ${platformCode}`);
    }
    return platform.id;
  }

  /**
   * Finds an existing draft Listing for the given scope, or creates one.
   * Used by batch-generate to avoid duplicate records.
   */
  async findOrCreateDraft(input: {
    productId: string;
    brandId: string;
    marketId: string;
    platformId: string;
    shopId: string;
    language: string;
    platformListingId: string;
  }): Promise<{ id: string; brandId: string; language: string; isNew: boolean }> {
    const existing = await this.prisma.listing.findFirst({
      where: {
        productId: input.productId,
        shopId: input.shopId,
        platformId: input.platformId,
        language: input.language as any,
      },
      select: { id: true, brandId: true, language: true },
    });

    if (existing) {
      return { ...existing, isNew: false };
    }

    const created = await this.prisma.listing.create({
      data: {
        productId: input.productId,
        brandId: input.brandId,
        marketId: input.marketId,
        platformId: input.platformId,
        shopId: input.shopId,
        language: input.language as any,
        platformListingId: input.platformListingId,
        isPrimary: false,
        trafficStrategy: TrafficStrategy.primary,
      },
      select: { id: true, brandId: true, language: true },
    });

    return { ...created, isNew: true };
  }

  private snapshotListing(
    listing: Pick<
      ListingSnapshot,
      'id' | 'status' | 'title' | 'isPrimary' | 'trafficStrategy' | 'updatedAt'
    >,
  ): ListingSnapshot {
    return {
      id: listing.id,
      status: listing.status,
      title: listing.title,
      isPrimary: listing.isPrimary,
      trafficStrategy: listing.trafficStrategy,
      updatedAt: listing.updatedAt,
    };
  }

  private async assertExists(id: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      throw new NotFoundException(`Listing not found: ${id}`);
    }
    return listing;
  }

  private async demoteOtherPrimaries(
    tx: Prisma.TransactionClient,
    excludeId: string,
    scope: {
      productId: string;
      brandId: string;
      marketId: string;
      platformId: string;
      shopId: string;
      language: string;
    },
  ): Promise<string[]> {
    const where = {
      id: { not: excludeId },
      productId: scope.productId,
      brandId: scope.brandId,
      marketId: scope.marketId,
      platformId: scope.platformId,
      shopId: scope.shopId,
      language: scope.language as any,
      isPrimary: true,
    };

    const toBedemoted = await tx.listing.findMany({ where, select: { id: true } });
    if (toBedemoted.length > 0) {
      await tx.listing.updateMany({ where, data: { isPrimary: false } });
    }
    return toBedemoted.map((l) => l.id);
  }

  private rethrowConflict(error: unknown, fallback: string): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      throw new ConflictException(fallback);
    }
    throw error;
  }
}
