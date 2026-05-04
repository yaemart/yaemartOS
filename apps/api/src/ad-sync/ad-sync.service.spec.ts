import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PrismaClientManager } from '../database/prisma.service';
import type { LingxingClient } from '@yaemartos/lingxing-client';
import type { AdReportFetchResult } from '@yaemartos/lingxing-client';
import { AdSyncService } from './ad-sync.service';

const makeAdReportResult = (
  adType: AdReportFetchResult['adType'],
  records: AdReportFetchResult['records'] = [
    {
      campaignId: 'c1',
      campaignName: 'Campaign 1',
      impressions: 100,
      clicks: 10,
      spend: 5.5,
      sales: 20,
      orders: 2,
    },
  ],
): AdReportFetchResult => ({
  records,
  shopId: 'shop-1',
  date: '2026-05-03',
  adType,
});

const makeService = () => {
  const adDailyStatUpsert = vi.fn().mockResolvedValue({});
  const metricCreate = vi.fn().mockResolvedValue({});
  const metricDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const shopFindUnique = vi.fn();

  // $transaction receives an array of promises; resolve them all so individual mocks are tracked
  const mockTransaction = vi
    .fn()
    .mockImplementation((ops: unknown) => Promise.all(ops as Promise<unknown>[]));

  const prismaPublicClient = {
    adDailyStat: { upsert: adDailyStatUpsert },
    metric: { create: metricCreate, deleteMany: metricDeleteMany },
    shop: { findUnique: shopFindUnique },
    $transaction: mockTransaction,
  };

  const prismaManager = {
    getPublicClient: vi.fn().mockReturnValue(prismaPublicClient),
  } as unknown as PrismaClientManager;

  const getSpCampaignReport = vi.fn();
  const getSdCampaignReport = vi.fn();
  const getSbCampaignReport = vi.fn();
  const getWalmartCampaignReport = vi.fn();

  const lingxingClient = {
    advertising: {
      getSpCampaignReport,
      getSdCampaignReport,
      getSbCampaignReport,
      getWalmartCampaignReport,
    },
  } as unknown as LingxingClient;

  const service = new AdSyncService(prismaManager, lingxingClient);

  return {
    service,
    mocks: {
      shopFindUnique,
      adDailyStatUpsert,
      metricCreate,
      metricDeleteMany,
      mockTransaction,
      getSpCampaignReport,
      getSdCampaignReport,
      getSbCampaignReport,
      getWalmartCampaignReport,
    },
  };
};

describe('AdSyncService', () => {
  describe('syncShopDate', () => {
    it('Happy path: Amazon shop calls SP/SD/SB, upserts AdDailyStat, creates Metric', async () => {
      const { service, mocks } = makeService();

      mocks.shopFindUnique.mockResolvedValue({
        id: 'shop-1',
        brandId: 'homtone',
        platform: { code: 'amazon' },
      });
      mocks.getSpCampaignReport.mockResolvedValue(makeAdReportResult('sp'));
      mocks.getSdCampaignReport.mockResolvedValue(makeAdReportResult('sd'));
      mocks.getSbCampaignReport.mockResolvedValue(makeAdReportResult('sb'));

      const result = await service.syncShopDate('shop-1', 'homtone', '2026-05-03');

      expect(mocks.getSpCampaignReport).toHaveBeenCalledWith('shop-1', '2026-05-03');
      expect(mocks.getSdCampaignReport).toHaveBeenCalledWith('shop-1', '2026-05-03');
      expect(mocks.getSbCampaignReport).toHaveBeenCalledWith('shop-1', '2026-05-03');
      expect(mocks.getWalmartCampaignReport).not.toHaveBeenCalled();

      expect(mocks.adDailyStatUpsert).toHaveBeenCalledTimes(3);
      expect(mocks.adDailyStatUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            shopId_date_adType_campaignId: {
              shopId: 'shop-1',
              date: new Date('2026-05-03'),
              adType: 'sp',
              campaignId: 'c1',
            },
          },
        }),
      );

      // Metric write is idempotent: deleteMany (remove stale) + create (fresh value) in one transaction
      expect(mocks.metricDeleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { name: 'ad.spend.shop-1.2026-05-03' } }),
      );
      expect(mocks.metricCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'ad.spend.shop-1.2026-05-03',
            unit: 'USD',
            brandId: 'homtone',
          }),
        }),
      );

      expect(result.sp).toBe('ok');
      expect(result.sd).toBe('ok');
      expect(result.sb).toBe('ok');
      expect(result.walmart_sp).toBe('skipped');
    });

    it('Edge case: all ad reports return empty arrays → no upsert called', async () => {
      const { service, mocks } = makeService();

      mocks.shopFindUnique.mockResolvedValue({
        id: 'shop-1',
        brandId: 'homtone',
        platform: { code: 'amazon' },
      });
      mocks.getSpCampaignReport.mockResolvedValue(makeAdReportResult('sp', []));
      mocks.getSdCampaignReport.mockResolvedValue(makeAdReportResult('sd', []));
      mocks.getSbCampaignReport.mockResolvedValue(makeAdReportResult('sb', []));

      const result = await service.syncShopDate('shop-1', 'homtone', '2026-05-03');

      expect(mocks.adDailyStatUpsert).not.toHaveBeenCalled();
      expect(result.sp).toBe('ok');
      expect(result.sd).toBe('ok');
      expect(result.sb).toBe('ok');
    });

    it('Error path: getSdCampaignReport throws → SD is error, SP and SB continue', async () => {
      const { service, mocks } = makeService();

      mocks.shopFindUnique.mockResolvedValue({
        id: 'shop-1',
        brandId: 'homtone',
        platform: { code: 'amazon' },
      });
      mocks.getSpCampaignReport.mockResolvedValue(makeAdReportResult('sp'));
      mocks.getSdCampaignReport.mockRejectedValue(new Error('API timeout'));
      mocks.getSbCampaignReport.mockResolvedValue(makeAdReportResult('sb'));

      const result = await service.syncShopDate('shop-1', 'homtone', '2026-05-03');

      expect(result.sp).toBe('ok');
      expect(result.sd).toBe('error');
      expect(result.sb).toBe('ok');
      expect(mocks.adDailyStatUpsert).toHaveBeenCalledTimes(2); // sp + sb only
      expect(mocks.metricDeleteMany).toHaveBeenCalled(); // metric idempotent write
      expect(mocks.metricCreate).toHaveBeenCalled();
    });

    it('Walmart shop: only calls getWalmartCampaignReport, skips SP/SD/SB', async () => {
      const { service, mocks } = makeService();

      mocks.shopFindUnique.mockResolvedValue({
        id: 'shop-walmart',
        brandId: 'spoonlemon',
        platform: { code: 'walmart' },
      });
      mocks.getWalmartCampaignReport.mockResolvedValue(makeAdReportResult('walmart_sp'));

      const result = await service.syncShopDate('shop-walmart', 'spoonlemon', '2026-05-03');

      expect(mocks.getWalmartCampaignReport).toHaveBeenCalledWith('shop-walmart', '2026-05-03');
      expect(mocks.getSpCampaignReport).not.toHaveBeenCalled();
      expect(mocks.getSdCampaignReport).not.toHaveBeenCalled();
      expect(mocks.getSbCampaignReport).not.toHaveBeenCalled();

      expect(result.walmart_sp).toBe('ok');
      expect(result.sp).toBe('skipped');
      expect(result.sd).toBe('skipped');
      expect(result.sb).toBe('skipped');

      expect(mocks.adDailyStatUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            shopId_date_adType_campaignId: expect.objectContaining({
              adType: 'walmart_sp',
            }),
          }),
        }),
      );
    });
  });
});
