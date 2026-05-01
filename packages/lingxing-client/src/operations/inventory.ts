import Redis from 'ioredis';
import { HttpTransport } from '../client/http-transport';
import { RateLimiter } from '../decorators/rate-limiter';
import { withRetry } from '../decorators/retry';
import { withCache } from '../decorators/cached';
import { LingxingInventoryRaw, MappedInventory } from '../types/inventory.types';

export class InventoryOperations {
  constructor(
    private readonly transport: HttpTransport,
    private readonly rateLimiter: RateLimiter,
    private readonly redis: Redis,
    private readonly cachePrefix: string,
  ) {}

  async getSnapshot(
    marketplaceId: string,
    options?: { cache?: { ttl: number } },
  ): Promise<MappedInventory[]> {
    const ttl = options?.cache?.ttl ?? 900;
    return withCache(
      this.redis,
      'inventory.getSnapshot',
      [marketplaceId],
      async () => {
        return withRetry(async () => {
          await this.rateLimiter.acquire();
          const response = await this.transport.request<{
            code: number;
            data: LingxingInventoryRaw[];
          }>('GET', '/erp/sc/fba/inventory', { marketplace_id: marketplaceId });
          if (!response.data || response.data.length === 0) {
            return [];
          }
          return response.data.map((raw) => this.mapInventory(raw));
        });
      },
      { ttlSeconds: ttl, keyPrefix: this.cachePrefix },
    );
  }

  private mapInventory(raw: LingxingInventoryRaw): MappedInventory {
    return {
      sku: raw.seller_sku,
      asin: raw.asin ?? undefined,
      marketplaceId: raw.marketplace_id,
      fbaAvailable: raw.fulfillable_quantity ?? 0,
      fbaInbound: raw.inbound_quantity ?? 0,
      fbaReserved: raw.reserved_quantity ?? 0,
      fbaUnfulfillable: raw.unfulfillable_quantity ?? 0,
      fbaTotal: raw.total_quantity ?? 0,
      daysOfSupply: raw.days_of_supply ?? 0,
      snapshotAt: new Date(),
    };
  }
}
