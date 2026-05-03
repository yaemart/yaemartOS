import { HttpTransport } from '../client/http-transport';
import { RateLimiter } from '../decorators/rate-limiter';
import { withRetry } from '../decorators/retry';

export interface LingxingOrderRaw {
  order_id: string;
  platform_order_id: string;
  shop_id: string;
  status: string;
  tracking_number?: string;
  estimated_delivery_date?: string;
  created_at?: string;
}

export interface OrderStatusResult {
  orderNumber: string;
  status: string;
  trackingNumber: string | null;
  estimatedDelivery: string | null;
}

export interface OrderQueryParams {
  orderNumber: string;
  startDate?: string;
  endDate?: string;
}

export class OrdersOperations {
  constructor(
    private readonly transport: HttpTransport,
    private readonly rateLimiter: RateLimiter,
  ) {}

  /**
   * Query order status by platform order number.
   * Returns null when the order is not found.
   * Only safe-to-expose fields are returned (status, tracking, ETA).
   */
  async queryByNumber(params: OrderQueryParams): Promise<OrderStatusResult | null> {
    return withRetry(async () => {
      await this.rateLimiter.acquire();

      const queryParams: Record<string, string> = {
        platform_order_id: params.orderNumber,
      };
      if (params.startDate) {
        queryParams['start_date'] = params.startDate;
      }
      if (params.endDate) {
        queryParams['end_date'] = params.endDate;
      }

      const response = await this.transport.request<{
        code: number;
        data: LingxingOrderRaw[];
        total?: number;
      }>('GET', '/erp/sc/orders', queryParams);

      if (!response.data || response.data.length === 0) {
        return null;
      }

      const raw = response.data[0];
      return {
        orderNumber: raw.platform_order_id,
        status: this.normalizeStatus(raw.status),
        trackingNumber: raw.tracking_number ?? null,
        estimatedDelivery: raw.estimated_delivery_date ?? null,
      };
    });
  }

  private normalizeStatus(raw: string): string {
    const statusMap: Record<string, string> = {
      Pending: 'Pending',
      Unshipped: 'Pending',
      PartiallyShipped: 'Processing',
      Shipped: 'Shipped',
      Delivered: 'Delivered',
      Canceled: 'Cancelled',
      Unfulfillable: 'Unfulfillable',
    };
    return statusMap[raw] ?? raw;
  }
}
