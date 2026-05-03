export { LingxingErrorCode } from './errors/error-codes';
export {
  LingxingError,
  RateLimitedError,
  AuthFailedError,
  BusinessError,
  NetworkError,
} from './errors/lingxing-error';
export { LingxingClientOptions } from './lingxing-client.options';
export { LINGXING_CLIENT_OPTIONS, REDIS_CLIENT } from './tokens';
export { LingxingClient } from './lingxing-client';
export { LingxingClientModule } from './lingxing-client.module';
export { AuthManager } from './client/auth-manager';
export { HttpTransport } from './client/http-transport';
export { RateLimiter } from './decorators/rate-limiter';
export { withRetry } from './decorators/retry';
export type { RetryOptions } from './decorators/retry';
export { withCache } from './decorators/cached';
export type { CacheOptions } from './decorators/cached';

export { ListingsOperations } from './operations/listings';
export { OrdersOperations } from './operations/orders';
export type { OrderStatusResult, OrderQueryParams } from './operations/orders';
export { InventoryOperations } from './operations/inventory';
export { ShopsOperations } from './operations/shops';
export { AdvertisingOperations } from './operations/advertising';

export type {
  LingxingListingRaw,
  LingxingWalmartListingRaw,
  ListingFetchResult,
  MappedListing,
} from './types/listing.types';
export type { LingxingInventoryRaw, MappedInventory } from './types/inventory.types';
export type { LingxingShopRaw, MappedShop } from './types/shop.types';
export type {
  LingxingAdReportRaw,
  MappedAdReport,
  AdReportFetchResult,
} from './types/advertising.types';

export { LingxingMcpBridge } from './mcp/mcp-bridge';
export type {
  QueryInventoryParams,
  GetListingSummaryParams,
  GetKeywordSuggestionsParams,
} from './mcp/mcp-bridge';
