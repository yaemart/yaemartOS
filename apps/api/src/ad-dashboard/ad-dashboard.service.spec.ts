import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdDashboardService } from './ad-dashboard.service';
import { PrismaClientManager } from '../database/prisma.service';

const makeDecimal = (value: number) =>
  ({ toNumber: () => value }) as unknown as ReturnType<typeof Number> & { toNumber: () => number };

const mockGroupBy = vi.fn();
const mockShopFindMany = vi.fn();

const mockPrismaManager = {
  getPublicClient: () => ({
    adDailyStat: { groupBy: mockGroupBy },
    shop: { findMany: mockShopFindMany },
  }),
} as unknown as PrismaClientManager;

describe('AdDashboardService', () => {
  let service: AdDashboardService;

  beforeEach(() => {
    mockGroupBy.mockReset();
    mockShopFindMany.mockReset();
    service = new AdDashboardService(mockPrismaManager);
  });

  describe('queryDashboard', () => {
    it('happy path: returns 3 daily buckets with correct totals and acos', async () => {
      const rows = [
        {
          date: new Date('2026-04-01'),
          adType: 'sp',
          _sum: {
            spend: makeDecimal(100),
            sales: makeDecimal(500),
            impressions: 1000,
            clicks: 50,
            orders: 10,
          },
        },
        {
          date: new Date('2026-04-02'),
          adType: 'sp',
          _sum: {
            spend: makeDecimal(80),
            sales: makeDecimal(400),
            impressions: 800,
            clicks: 40,
            orders: 8,
          },
        },
        {
          date: new Date('2026-04-03'),
          adType: 'sd',
          _sum: {
            spend: makeDecimal(60),
            sales: makeDecimal(300),
            impressions: 600,
            clicks: 30,
            orders: 6,
          },
        },
      ];
      mockGroupBy.mockResolvedValue(rows);

      const result = await service.queryDashboard({
        startDate: '2026-04-01',
        endDate: '2026-04-03',
      });

      expect(result.daily).toHaveLength(3);
      expect(result.daily[0]).toMatchObject({
        date: '2026-04-01',
        adType: 'sp',
        spend: 100,
        sales: 500,
        impressions: 1000,
        clicks: 50,
        orders: 10,
      });

      expect(result.totals).toEqual({
        totalSpend: 240,
        totalSales: 1200,
        totalClicks: 120,
        totalImpressions: 2400,
        totalOrders: 24,
      });

      // acos = 240 / 1200 * 100 = 20
      expect(result.acos).toBeCloseTo(20, 5);
    });

    it('edge case: empty data returns all zeros and null acos', async () => {
      mockGroupBy.mockResolvedValue([]);

      const result = await service.queryDashboard({
        startDate: '2026-04-01',
        endDate: '2026-04-03',
      });

      expect(result.daily).toEqual([]);
      expect(result.totals).toEqual({
        totalSpend: 0,
        totalSales: 0,
        totalClicks: 0,
        totalImpressions: 0,
        totalOrders: 0,
      });
      expect(result.acos).toBeNull();
    });

    it('error path: totalSales = 0 returns acos = null (not Infinity)', async () => {
      mockGroupBy.mockResolvedValue([
        {
          date: new Date('2026-04-01'),
          adType: 'sp',
          _sum: {
            spend: makeDecimal(50),
            sales: makeDecimal(0),
            impressions: 500,
            clicks: 25,
            orders: 0,
          },
        },
      ]);

      const result = await service.queryDashboard({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
      });

      expect(result.totals.totalSales).toBe(0);
      expect(result.acos).toBeNull();
    });

    it('filters by shopId when provided without brandId', async () => {
      mockGroupBy.mockResolvedValue([]);

      await service.queryDashboard({
        startDate: '2026-04-01',
        endDate: '2026-04-10',
        shopId: 'shop-123',
      });

      expect(mockGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ shopId: 'shop-123' }),
        }),
      );
    });

    it('filters by adType when provided', async () => {
      mockGroupBy.mockResolvedValue([]);

      await service.queryDashboard({
        startDate: '2026-04-01',
        endDate: '2026-04-10',
        adType: 'sp',
      });

      expect(mockGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ adType: 'sp' }),
        }),
      );
    });

    it('brandId with no matching shops returns empty response', async () => {
      mockShopFindMany.mockResolvedValue([]);

      const result = await service.queryDashboard({
        startDate: '2026-04-01',
        endDate: '2026-04-10',
        brandId: 'homtone',
      });

      expect(result.daily).toEqual([]);
      expect(result.acos).toBeNull();
      expect(mockGroupBy).not.toHaveBeenCalled();
    });
  });
});
