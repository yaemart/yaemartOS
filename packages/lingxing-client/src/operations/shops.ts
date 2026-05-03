import { HttpTransport } from '../client/http-transport';
import { RateLimiter } from '../decorators/rate-limiter';
import { withRetry } from '../decorators/retry';
import { LingxingShopRaw, MappedShop } from '../types/shop.types';

interface SellerListsResponse {
  code: number;
  message: string;
  data: LingxingShopRaw[];
}

export class ShopsOperations {
  constructor(
    private readonly transport: HttpTransport,
    private readonly rateLimiter: RateLimiter,
  ) {}

  /**
   * Fetch all shops from Lingxing via GET /erp/sc/data/seller/lists.
   *
   * Note: The Lingxing API returns the full list in a single response and
   * does not honour offset-based pagination — all shops are always returned
   * regardless of offset/length parameters.  One request is sufficient.
   */
  async list(): Promise<MappedShop[]> {
    return withRetry(async () => {
      await this.rateLimiter.acquire();

      const response = await this.transport.request<SellerListsResponse>(
        'GET',
        '/erp/sc/data/seller/lists',
        { offset: 0, length: 1000 },
      );

      const shops = response.data ?? [];
      return shops.map((raw) => this.mapShop(raw));
    });
  }

  private mapShop(raw: LingxingShopRaw): MappedShop {
    return {
      shopId: String(raw.sid),
      shopName: raw.name,
      marketplaceId: raw.marketplace_id,
      region: raw.region,
      country: raw.country,
      sellerId: raw.seller_id,
      accountName: raw.account_name,
      isActive: raw.status === 1,
      status: raw.status,
    };
  }
}
