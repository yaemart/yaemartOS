import { HttpTransport } from '../client/http-transport';
import { RateLimiter } from '../decorators/rate-limiter';
import { withRetry } from '../decorators/retry';
import { LingxingShopRaw, MappedShop } from '../types/shop.types';

export class ShopsOperations {
  constructor(
    private readonly transport: HttpTransport,
    private readonly rateLimiter: RateLimiter,
  ) {}

  async list(): Promise<MappedShop[]> {
    return withRetry(async () => {
      await this.rateLimiter.acquire();
      const response = await this.transport.request<{
        code: number;
        data: LingxingShopRaw[];
      }>('GET', '/erp/sc/shops');
      if (!response.data || response.data.length === 0) {
        return [];
      }
      return response.data.map((raw) => this.mapShop(raw));
    });
  }

  private mapShop(raw: LingxingShopRaw): MappedShop {
    return {
      shopId: raw.shop_id,
      shopName: raw.shop_name,
      marketplaceId: raw.marketplace_id,
      isActive: raw.status === 1,
    };
  }
}
