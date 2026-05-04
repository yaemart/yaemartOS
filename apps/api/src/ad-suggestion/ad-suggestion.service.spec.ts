import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdSuggestionService } from './ad-suggestion.service';
import { PrismaClientManager } from '../database/prisma.service';
import { GlmGenerationService } from '../ai/providers/glm-generation.service';
import { CostTrackingService } from '../ai/cost-tracking.service';
import { AuditService } from '../common/audit/audit.service';

const makeDecimal = (value: number) =>
  ({ toNumber: () => value, toString: () => String(value) }) as unknown as ReturnType<
    typeof Number
  > & {
    toNumber: () => number;
  };

const mockGroupBy = vi.fn();
const mockCreateMany = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockChangeFindUnique = vi.fn();
const mockChangeFindMany = vi.fn();
const mockChangeCount = vi.fn();
const mockChangeUpdate = vi.fn();
const mockChangeCreate = vi.fn();
const mockTransaction = vi.fn();

const prismaClient = {
  adDailyStat: { groupBy: mockGroupBy },
  adSuggestion: {
    createMany: mockCreateMany,
    findMany: mockFindMany,
    count: mockCount,
    findUnique: mockFindUnique,
    update: mockUpdate,
  },
  adChange: {
    findUnique: mockChangeFindUnique,
    findMany: mockChangeFindMany,
    count: mockChangeCount,
    update: mockChangeUpdate,
    create: mockChangeCreate,
  },
  $transaction: mockTransaction,
};

const prismaManager = {
  getPublicClient: () => prismaClient,
} as unknown as PrismaClientManager;

const glm = {
  generateJson: vi.fn(),
} as unknown as GlmGenerationService;

const costTracking = {
  record: vi.fn().mockResolvedValue(undefined),
} as unknown as CostTrackingService;

const audit = {
  logWrite: vi.fn().mockResolvedValue(undefined),
} as unknown as AuditService;

describe('AdSuggestionService', () => {
  let service: AdSuggestionService;

  beforeEach(() => {
    mockGroupBy.mockReset();
    mockCreateMany.mockReset();
    mockFindMany.mockReset();
    mockCount.mockReset();
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    mockChangeFindUnique.mockReset();
    mockChangeFindMany.mockReset();
    mockChangeCount.mockReset();
    mockChangeUpdate.mockReset();
    mockChangeCreate.mockReset();
    mockTransaction.mockReset();
    mockTransaction.mockImplementation(async (fn: (tx: typeof prismaClient) => unknown) =>
      fn(prismaClient),
    );
    (glm.generateJson as ReturnType<typeof vi.fn>).mockReset();
    (costTracking.record as ReturnType<typeof vi.fn>).mockClear();
    (audit.logWrite as ReturnType<typeof vi.fn>).mockClear();
    service = new AdSuggestionService(prismaManager, glm, costTracking, audit);
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

  describe('execute', () => {
    it('marks pending suggestion as executed and creates an AdChange', async () => {
      const future = new Date(Date.now() + 86_400_000);
      mockFindUnique.mockResolvedValue({
        id: 's1',
        brandId: 'homtone',
        status: 'pending',
        expiresAt: future,
        shopId: 'shop-1',
        campaignId: 'c1',
        actionType: 'decrease_bid',
        field: 'bid',
        currentValue: makeDecimal(1.5),
        suggestedValue: makeDecimal(1.2),
        adType: 'sp',
        campaignName: 'C1',
        reason: 'r',
      });
      mockUpdate.mockResolvedValue({ status: 'executed' });
      mockChangeCreate.mockResolvedValue({ id: 'ch1' });

      const result = await service.execute('s1', 'homtone', 'user-1');

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockChangeCreate).toHaveBeenCalled();
      expect(audit.logWrite).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ads.suggestion.execute' }),
      );
      expect(result.change.id).toBe('ch1');
    });

    it('rejects execution if suggestion is not pending', async () => {
      mockFindUnique.mockResolvedValue({
        id: 's1',
        brandId: 'homtone',
        status: 'executed',
        expiresAt: new Date(Date.now() + 86_400_000),
      });
      await expect(service.execute('s1', 'homtone')).rejects.toThrow(/cannot execute/);
    });

    it('rejects execution if suggestion has expired', async () => {
      mockFindUnique.mockResolvedValue({
        id: 's1',
        brandId: 'homtone',
        status: 'pending',
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.execute('s1', 'homtone')).rejects.toThrow(/expired/);
    });
  });

  describe('reject', () => {
    it('marks pending suggestion as rejected', async () => {
      mockFindUnique.mockResolvedValue({
        id: 's1',
        brandId: 'homtone',
        status: 'pending',
        expiresAt: new Date(Date.now() + 86_400_000),
      });
      mockUpdate.mockResolvedValue({ id: 's1', status: 'rejected' });

      const result = await service.reject('s1', 'homtone', 'user-1');

      expect(result.status).toBe('rejected');
      expect(audit.logWrite).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ads.suggestion.reject' }),
      );
    });
  });

  describe('rollback', () => {
    it('rolls back an executed change within the 24h window', async () => {
      mockChangeFindUnique.mockResolvedValue({
        id: 'ch1',
        brandId: 'homtone',
        status: 'executed',
        suggestionId: 's1',
        reversibleBefore: new Date(Date.now() + 3600_000),
        valueBefore: makeDecimal(1.5),
        valueAfter: makeDecimal(1.2),
      });
      mockChangeUpdate.mockResolvedValue({ id: 'ch1', status: 'rolled_back' });
      mockUpdate.mockResolvedValue({ id: 's1', status: 'pending' });

      const result = await service.rollback('ch1', 'homtone', 'user-1');

      expect(result.status).toBe('rolled_back');
      expect(audit.logWrite).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ads.change.rollback' }),
      );
    });

    it('rejects rollback past the 24h window', async () => {
      mockChangeFindUnique.mockResolvedValue({
        id: 'ch1',
        brandId: 'homtone',
        status: 'executed',
        reversibleBefore: new Date(Date.now() - 1000),
      });
      await expect(service.rollback('ch1', 'homtone')).rejects.toThrow(/24h rollback window/);
    });

    it('rejects rollback when already rolled back', async () => {
      mockChangeFindUnique.mockResolvedValue({
        id: 'ch1',
        brandId: 'homtone',
        status: 'rolled_back',
        reversibleBefore: new Date(Date.now() + 3600_000),
      });
      await expect(service.rollback('ch1', 'homtone')).rejects.toThrow(/cannot rollback/);
    });

    it('throws NotFound when brand mismatches', async () => {
      mockChangeFindUnique.mockResolvedValue({ id: 'ch1', brandId: 'spoonlemon' });
      await expect(service.rollback('ch1', 'homtone')).rejects.toThrow();
    });
  });
});
