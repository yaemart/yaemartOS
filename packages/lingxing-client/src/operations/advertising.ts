import { HttpTransport } from '../client/http-transport';
import { RateLimiter } from '../decorators/rate-limiter';
import { withRetry } from '../decorators/retry';
import type {
  LingxingAdReportRaw,
  MappedAdReport,
  AdReportFetchResult,
} from '../types/advertising.types';

export class AdvertisingOperations {
  constructor(
    private readonly transport: HttpTransport,
    private readonly rateLimiter: RateLimiter,
  ) {}

  async getSpCampaignReport(shopId: string, date: string): Promise<AdReportFetchResult> {
    return withRetry(async () => {
      await this.rateLimiter.acquire();
      const response = await this.transport.request<{ code: number; data: LingxingAdReportRaw[] }>(
        'GET',
        '/erp/sc/mws/ad/sp/report',
        { shop_id: shopId, date },
      );
      return {
        records: (response.data ?? []).map(this.mapAdReport),
        shopId,
        date,
        adType: 'sp',
      };
    });
  }

  async getSdCampaignReport(shopId: string, date: string): Promise<AdReportFetchResult> {
    return withRetry(async () => {
      await this.rateLimiter.acquire();
      const response = await this.transport.request<{ code: number; data: LingxingAdReportRaw[] }>(
        'GET',
        '/erp/sc/mws/ad/sd/report',
        { shop_id: shopId, date },
      );
      return {
        records: (response.data ?? []).map(this.mapAdReport),
        shopId,
        date,
        adType: 'sd',
      };
    });
  }

  async getSbCampaignReport(shopId: string, date: string): Promise<AdReportFetchResult> {
    return withRetry(async () => {
      await this.rateLimiter.acquire();
      const response = await this.transport.request<{ code: number; data: LingxingAdReportRaw[] }>(
        'GET',
        '/erp/sc/mws/ad/sb/report',
        { shop_id: shopId, date },
      );
      return {
        records: (response.data ?? []).map(this.mapAdReport),
        shopId,
        date,
        adType: 'sb',
      };
    });
  }

  async getWalmartCampaignReport(shopId: string, date: string): Promise<AdReportFetchResult> {
    return withRetry(async () => {
      await this.rateLimiter.acquire();
      const response = await this.transport.request<{ code: number; data: LingxingAdReportRaw[] }>(
        'GET',
        '/erp/sc/walmart/ad/report',
        { shop_id: shopId, date },
      );
      return {
        records: (response.data ?? []).map(this.mapAdReport),
        shopId,
        date,
        adType: 'walmart_sp',
      };
    });
  }

  private readonly mapAdReport = (raw: LingxingAdReportRaw): MappedAdReport => ({
    campaignId: raw.campaign_id ?? 'unknown',
    campaignName: raw.campaign_name,
    impressions: Number(raw.impressions ?? 0),
    clicks: Number(raw.clicks ?? 0),
    spend: Number(raw.spend ?? 0),
    sales: Number(raw.sales ?? 0),
    orders: Number(raw.orders ?? 0),
  });
}
