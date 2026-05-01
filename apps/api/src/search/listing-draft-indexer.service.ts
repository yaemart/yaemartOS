import { Injectable, Logger } from '@nestjs/common';
import { PrismaClientManager } from '../database/prisma.service';
import { SearchService } from './search.service';
import { OPS_LISTING_DRAFT, indexName } from './es-index-registry';

export type ListingDraftDoc = {
  id: string;
  listing_id: string;
  version_number: number;
  brand_id: string;
  market_id: string;
  platform_id: string;
  shop_id: string;
  language: string;
  listing_status: string;
  version_status: string;
  title: string;
  body_excerpt: string;
  published_at: string | null;
  source_table: string;
  source_id: string;
  version: number;
  synced_at: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class ListingDraftIndexerService {
  private readonly logger = new Logger(ListingDraftIndexerService.name);

  constructor(
    private readonly search: SearchService,
    private readonly prismaManager: PrismaClientManager,
  ) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  private get index() {
    return indexName(OPS_LISTING_DRAFT, this.search.getIndexEnv());
  }

  /** Index (or re-index) a single ListingVersion identified by its DB id. */
  async indexVersion(versionId: string): Promise<void> {
    const version = await this.prisma.listingVersion.findUnique({
      where: { id: versionId },
      include: {
        listing: {
          select: {
            brandId: true,
            marketId: true,
            platformId: true,
            shopId: true,
            language: true,
            status: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!version) {
      this.logger.warn(`indexVersion: version not found ${versionId}`);
      return;
    }

    const snapshot = (version.contentSnapshot ?? {}) as Record<string, unknown>;
    const title = (snapshot['title'] as string | undefined) ?? '';
    const bullets = ((snapshot['bullets'] as string[] | undefined) ?? []).join(' ');
    const description = (snapshot['description'] as string | undefined) ?? '';
    const bodyExcerpt = `${bullets} ${description}`.trim().slice(0, 2000);

    const now = new Date().toISOString();
    const doc: ListingDraftDoc = {
      id: version.id,
      listing_id: version.listingId,
      version_number: version.versionNumber,
      brand_id: version.listing.brandId,
      market_id: version.listing.marketId,
      platform_id: version.listing.platformId,
      shop_id: version.listing.shopId,
      language: version.listing.language,
      listing_status: version.listing.status,
      version_status: version.status,
      title,
      body_excerpt: bodyExcerpt,
      published_at: version.publishedAt?.toISOString() ?? null,
      source_table: 'ListingVersion',
      source_id: version.id,
      version: version.versionNumber,
      synced_at: now,
      deleted_at: null,
      created_at: version.createdAt.toISOString(),
      updated_at: version.listing.updatedAt.toISOString(),
    };

    const client = this.search.getClient();
    await client.index({ index: this.index, id: version.id, body: doc, refresh: true });
    this.logger.log(`Indexed listing version ${versionId} (v${version.versionNumber})`);
  }

  /** Soft-delete all ES documents for a given listing. */
  async removeListing(listingId: string): Promise<void> {
    const client = this.search.getClient();
    await client.updateByQuery({
      index: this.index,
      body: {
        script: {
          source: `ctx._source.deleted_at = params.now`,
          params: { now: new Date().toISOString() },
        },
        query: { term: { listing_id: listingId } },
      },
    });
    this.logger.log(`Soft-deleted ES docs for listing ${listingId}`);
  }
}
