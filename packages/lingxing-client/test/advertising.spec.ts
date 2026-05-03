import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdvertisingOperations } from '../src/operations/advertising';

function createMockTransport() {
  return { request: vi.fn() } as any;
}

function createMockRateLimiter() {
  return { acquire: vi.fn().mockResolvedValue(undefined) } as any;
}

describe('AdvertisingOperations', () => {
  let transport: ReturnType<typeof createMockTransport>;
  let rateLimiter: ReturnType<typeof createMockRateLimiter>;
  let advertising: AdvertisingOperations;

  beforeEach(() => {
    vi.restoreAllMocks();
    transport = createMockTransport();
    rateLimiter = createMockRateLimiter();
    advertising = new AdvertisingOperations(transport, rateLimiter);
  });

  describe('getSpCampaignReport', () => {
    it('happy path: returns mapped MappedAdReport records', async () => {
      transport.request.mockResolvedValue({
        code: 0,
        data: [
          {
            campaign_id: 'camp-001',
            campaign_name: 'Test SP Campaign',
            impressions: 1000,
            clicks: 50,
            spend: 25.0,
            sales: 300.0,
            orders: 10,
          },
        ],
      });

      const result = await advertising.getSpCampaignReport('shop-1', '2026-05-03');

      expect(result.shopId).toBe('shop-1');
      expect(result.date).toBe('2026-05-03');
      expect(result.adType).toBe('sp');
      expect(result.records).toHaveLength(1);

      const record = result.records[0];
      expect(record.campaignId).toBe('camp-001');
      expect(record.campaignName).toBe('Test SP Campaign');
      expect(record.impressions).toBe(1000);
      expect(record.clicks).toBe(50);
      expect(record.spend).toBe(25.0);
      expect(record.sales).toBe(300.0);
      expect(record.orders).toBe(10);
    });

    it('edge case: API returns empty array → records is []', async () => {
      transport.request.mockResolvedValue({ code: 0, data: [] });

      const result = await advertising.getSpCampaignReport('shop-1', '2026-05-03');

      expect(result.records).toEqual([]);
      expect(result.adType).toBe('sp');
    });

    it('number coercion: spend/sales as strings are converted to numbers', async () => {
      transport.request.mockResolvedValue({
        code: 0,
        data: [
          {
            campaign_id: 'camp-002',
            impressions: 500,
            clicks: 20,
            spend: '10.50',
            sales: '99.99',
            orders: 3,
          },
        ],
      });

      const result = await advertising.getSpCampaignReport('shop-1', '2026-05-03');
      const record = result.records[0];

      expect(record.spend).toBe(10.5);
      expect(record.sales).toBe(99.99);
    });

    it('missing campaign_id falls back to "unknown"', async () => {
      transport.request.mockResolvedValue({
        code: 0,
        data: [{ impressions: 100, clicks: 5, spend: 1.0, sales: 10.0, orders: 1 }],
      });

      const result = await advertising.getSpCampaignReport('shop-1', '2026-05-03');

      expect(result.records[0].campaignId).toBe('unknown');
    });

    it('passes correct endpoint and params to transport', async () => {
      transport.request.mockResolvedValue({ code: 0, data: [] });

      await advertising.getSpCampaignReport('shop-42', '2026-04-01');

      expect(transport.request).toHaveBeenCalledWith('GET', '/erp/sc/mws/ad/sp/report', {
        shop_id: 'shop-42',
        date: '2026-04-01',
      });
    });
  });

  describe('getSdCampaignReport', () => {
    it('returns adType "sd" and calls correct endpoint', async () => {
      transport.request.mockResolvedValue({ code: 0, data: [] });

      const result = await advertising.getSdCampaignReport('shop-1', '2026-05-03');

      expect(result.adType).toBe('sd');
      expect(transport.request).toHaveBeenCalledWith(
        'GET',
        '/erp/sc/mws/ad/sd/report',
        expect.any(Object),
      );
    });
  });

  describe('getSbCampaignReport', () => {
    it('returns adType "sb" and calls correct endpoint', async () => {
      transport.request.mockResolvedValue({ code: 0, data: [] });

      const result = await advertising.getSbCampaignReport('shop-1', '2026-05-03');

      expect(result.adType).toBe('sb');
      expect(transport.request).toHaveBeenCalledWith(
        'GET',
        '/erp/sc/mws/ad/sb/report',
        expect.any(Object),
      );
    });
  });

  describe('getWalmartCampaignReport', () => {
    it('returns adType "walmart_sp" and calls correct endpoint', async () => {
      transport.request.mockResolvedValue({ code: 0, data: [] });

      const result = await advertising.getWalmartCampaignReport('shop-1', '2026-05-03');

      expect(result.adType).toBe('walmart_sp');
      expect(transport.request).toHaveBeenCalledWith(
        'GET',
        '/erp/sc/walmart/ad/report',
        expect.any(Object),
      );
    });
  });

  describe('zero-value defaults', () => {
    it('missing numeric fields default to 0', async () => {
      transport.request.mockResolvedValue({
        code: 0,
        data: [{ campaign_id: 'camp-003' }],
      });

      const result = await advertising.getSpCampaignReport('shop-1', '2026-05-03');
      const record = result.records[0];

      expect(record.impressions).toBe(0);
      expect(record.clicks).toBe(0);
      expect(record.spend).toBe(0);
      expect(record.sales).toBe(0);
      expect(record.orders).toBe(0);
    });
  });
});
