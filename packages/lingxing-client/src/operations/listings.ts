import Redis from 'ioredis';
import { HttpTransport } from '../client/http-transport';
import { RateLimiter } from '../decorators/rate-limiter';
import { withRetry } from '../decorators/retry';
import { withCache } from '../decorators/cached';
import {
  LingxingListingRaw,
  LingxingWalmartListingRaw,
  ListingFetchResult,
  MappedListing,
} from '../types/listing.types';

const LISTING_STATUS_MAP: Record<string, string> = {
  Active: 'active',
  Inactive: 'inactive',
  Incomplete: 'draft',
  Suppressed: 'suppressed',
  Deleted: 'archived',
};

export class ListingsOperations {
  constructor(
    private readonly transport: HttpTransport,
    private readonly rateLimiter: RateLimiter,
    private readonly redis: Redis,
    private readonly cachePrefix: string,
  ) {}

  async getByAsin(
    asin: string,
    options?: { cache?: { ttl: number } },
  ): Promise<MappedListing | null> {
    const ttl = options?.cache?.ttl ?? 3600;
    return withCache(
      this.redis,
      'listings.getByAsin',
      [asin],
      async () => {
        return withRetry(async () => {
          await this.rateLimiter.acquire();
          const response = await this.transport.request<{
            code: number;
            data: LingxingListingRaw[];
          }>('GET', '/erp/sc/mws/listing', { asin });
          if (!response.data || response.data.length === 0) {
            return null;
          }
          return this.mapListing(response.data[0]);
        });
      },
      { ttlSeconds: ttl, keyPrefix: this.cachePrefix },
    );
  }

  async getListingsForShop(
    shopId: string,
    options?: { page?: number; pageSize?: number },
  ): Promise<ListingFetchResult<LingxingListingRaw>> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 100;

    return withRetry(async () => {
      await this.rateLimiter.acquire();
      const response = await this.transport.request<{
        code: number;
        data: LingxingListingRaw[];
        total?: number;
      }>('GET', '/erp/sc/mws/listing', { shop_id: shopId, page, page_size: pageSize });

      const records = response.data ?? [];
      const total = response.total ?? records.length;

      return {
        records,
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      };
    });
  }

  async getWalmartListingsForShop(
    shopId: string,
    options?: { page?: number; pageSize?: number },
  ): Promise<ListingFetchResult<LingxingWalmartListingRaw>> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 100;

    return withRetry(async () => {
      await this.rateLimiter.acquire();
      const response = await this.transport.request<{
        code: number;
        data: LingxingWalmartListingRaw[];
        total?: number;
      }>('GET', '/erp/sc/walmart/listing', { shop_id: shopId, page, page_size: pageSize });

      const records = response.data ?? [];
      const total = response.total ?? records.length;

      return {
        records,
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      };
    });
  }

  private mapListing(raw: LingxingListingRaw): MappedListing {
    return {
      platformListingId: raw.asin,
      sku: raw.seller_sku,
      marketplaceId: raw.marketplace_id,
      lingxingShopId: raw.shop_id ?? undefined,
      title: raw.title ?? undefined,
      bulletPoints: raw.bullet_points ?? [],
      description: raw.description ?? undefined,
      searchTerms: raw.search_terms ?? [],
      mainImageUrl: raw.main_image_url ?? undefined,
      otherImages: raw.other_images ?? [],
      aPlusContent: raw.a_plus_content ?? undefined,
      status: raw.listing_status
        ? (LISTING_STATUS_MAP[raw.listing_status] ?? 'unknown')
        : 'unknown',
      price: raw.price ? parseFloat(raw.price) : undefined,
      fulfillmentChannel: raw.fulfillment_channel ?? undefined,
      platformCreatedAt: raw.open_date ? new Date(raw.open_date) : undefined,
      lingxingSyncedAt: raw.last_updated_time ? new Date(raw.last_updated_time) : undefined,
    };
  }
}
