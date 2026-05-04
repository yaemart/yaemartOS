import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdSuggestionService } from './ad-suggestion.service';
import { PrismaClientManager } from '../database/prisma.service';
import { GlmGenerationService } from '../ai/providers/glm-generation.service';
import { CostTrackingService } from '../ai/cost-tracking.service';

const makeDecimal = (value: number) =>
  ({ toNumber: () => value }) as unknown as ReturnType<typeof Number> & {
    toNumber: () => number;
  };

const mockGroupBy = vi.fn();
const mockCreateMany = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockFindUnique = vi.fn();

const prismaManager = {
  getPublicClient: () => ({
    adDailyStat: { groupBy: mockGroupBy },
    adSuggestion: {
      createMany: mockCreateMany,
      findMany: mockFindMany,
      count: mockCount,
      findUnique: mockFindUnique,
    },
  }),
} as unknown as PrismaClientManager;

const glm = {
  generateJson: vi.fn(),
} as unknown as GlmGenerationService;

const costTracking = {
  record: vi.fn().mockResolvedValue(undefined),
} as unknown as CostTrackingService;

describe('AdSuggestionService', () => {
  let service: AdSuggestionService;

  beforeEach(() => {
    mockGroupBy.mockReset();
    mockCreateMany.mockReset();
    mockFindMany.mockReset();
    mockCount.mockReset();
    mockFindUnique.mockReset();
    (glm.generateJson as ReturnType<typeof vi.fn>).mockReset();
    (costTracking.record as ReturnType<typeof vi.fn>).mockClear();
    service = new AdSuggestionService(prismaManager, glm, costTracking);
  });

  describe('generate', () => {
    it('returns count=0 when no campaigns breach thresholds', async () => {
      mockGroupBy.mockResolvedValue([
        {
          campaignId: 'c1',
          campaignName: 'OK Campaign',
          adType: 'sp',
          _sum: {
            spend: makeDecimal(20),
            sales: makeDecimal(200),
            impressions: 5000,
            clicks: 100,
            orders: 10,
          },
        },
      ]);

      const result = await service.generate({ shopId: 'shop-1', brandId: 'homtone' });

      expect(result.count).toBe(0);
      expect(glm.generateJson).not.toHaveBeenCalled();
      expect(mockCreateMany).not.toHaveBeenCalled();
    });

    it('calls GLM and persists suggestions when ACOS breaches threshold', async () => {
      mockGroupBy.mockResolvedValue([
        {
          campaignId: 'c-bad-acos',
          campaignName: 'Bad ACOS',
          adType: 'sp',
          _sum: {
            spend: makeDecimal(500),
            sales: makeDecimal(800), // ACOS = 62.5%
            impressions: 5000,
            clicks: 200,
            orders: 20,
          },
        },
      ]);
      (glm.generateJson as ReturnType<typeof vi.fn>).mockResolvedValue({
        suggestions: [
          {
            campaignId: 'c-bad-acos',
            campaignName: 'Bad ACOS',
            actionType: 'decrease_bid',
            field: 'bid',
            currentValue: 1.5,
            suggestedValue: 1.2,
            reason: 'ACOS 62.5% 高于阈值 39%，建议降低出价',
          },
        ],
      });
      mockCreateMany.mockResolvedValue({ count: 1 });

      const result = await service.generate({ shopId: 'shop-1', brandId: 'homtone' });

      expect(glm.generateJson).toHaveBeenCalledTimes(1);
      expect(mockCreateMany).toHaveBeenCalledTimes(1);
      expect(result.count).toBe(1);
      expect(result.batchId).toBeDefined();
      expect(costTracking.record).toHaveBeenCalled();
    });

    it('returns count=0 when GLM returns empty array', async () => {
      mockGroupBy.mockResolvedValue([
        {
          campaignId: 'c-bad',
          campaignName: 'Bad',
          adType: 'sp',
          _sum: {
            spend: makeDecimal(500),
            sales: makeDecimal(800),
            impressions: 5000,
            clicks: 200,
            orders: 20,
          },
        },
      ]);
      (glm.generateJson as ReturnType<typeof vi.fn>).mockResolvedValue({ suggestions: [] });

      const result = await service.generate({ shopId: 'shop-1', brandId: 'homtone' });

      expect(result.count).toBe(0);
      expect(mockCreateMany).not.toHaveBeenCalled();
    });

    it('records cost tracking even when GLM throws', async () => {
      mockGroupBy.mockResolvedValue([
        {
          campaignId: 'c-bad',
          campaignName: 'Bad',
          adType: 'sp',
          _sum: {
            spend: makeDecimal(500),
            sales: makeDecimal(800),
            impressions: 5000,
            clicks: 200,
            orders: 20,
          },
        },
      ]);
      (glm.generateJson as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('glm down'));

      await expect(service.generate({ shopId: 'shop-1', brandId: 'homtone' })).rejects.toThrow(
        'glm down',
      );
      expect(costTracking.record).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('lazy-expires suggestions whose expiresAt is in the past', async () => {
      const past = new Date(Date.now() - 1000);
      const future = new Date(Date.now() + 86_400_000);
      mockFindMany.mockResolvedValue([
        { id: 's1', status: 'pending', expiresAt: past, brandId: 'homtone' },
        { id: 's2', status: 'pending', expiresAt: future, brandId: 'homtone' },
      ]);
      mockCount.mockResolvedValue(2);

      const result = await service.list({ brandId: 'homtone' });

      expect(result.records[0]?.status).toBe('expired');
      expect(result.records[1]?.status).toBe('pending');
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when suggestion brand mismatches', async () => {
      mockFindUnique.mockResolvedValue({ id: 's1', brandId: 'spoonlemon' });
      await expect(service.findOne('s1', 'homtone')).rejects.toThrow();
    });

    it('returns suggestion when brand matches', async () => {
      mockFindUnique.mockResolvedValue({ id: 's1', brandId: 'homtone' });
      const result = await service.findOne('s1', 'homtone');
      expect(result.id).toBe('s1');
    });
  });
});
