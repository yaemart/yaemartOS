import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
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
const mockUpdateMany = vi.fn();
const mockShopFindUnique = vi.fn();
const mockChangeFindUnique = vi.fn();
const mockChangeFindUniqueOrThrow = vi.fn();
const mockChangeFindMany = vi.fn();
const mockChangeCount = vi.fn();
const mockChangeUpdateMany = vi.fn();
const mockChangeCreate = vi.fn();
const mockTransaction = vi.fn();

const prismaClient = {
  shop: { findUnique: mockShopFindUnique },
  adDailyStat: { groupBy: mockGroupBy },
  adSuggestion: {
    createMany: mockCreateMany,
    findMany: mockFindMany,
    count: mockCount,
    findUnique: mockFindUnique,
    updateMany: mockUpdateMany,
  },
  adChange: {
    findUnique: mockChangeFindUnique,
    findUniqueOrThrow: mockChangeFindUniqueOrThrow,
    findMany: mockChangeFindMany,
    count: mockChangeCount,
    updateMany: mockChangeUpdateMany,
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

const config = {
  get: vi.fn().mockReturnValue('glm-4-flash'),
} as unknown as ConfigService;

const realtimeBus = {
  publish: vi.fn().mockResolvedValue(undefined),
  // The service only calls .publish, but we expose the others so the mock
  // satisfies the constructor type without an `as any`.
  subscribeForBrand: vi.fn(),
  emitLocalForTest: vi.fn(),
} as unknown as import('../realtime/realtime-bus.service').RealtimeBusService;

const VALID_GLM_SUGGESTION = {
  campaignId: 'c-bad-acos',
  campaignName: 'Bad ACOS',
  actionType: 'decrease_bid',
  field: 'bid',
  currentValue: 1.5,
  suggestedValue: 1.2,
  reason: 'ACOS 62.5% 高于阈值 39%，建议降低出价',
};

const BREACHING_GROUPBY_ROW = {
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
};

describe('AdSuggestionService', () => {
  let service: AdSuggestionService;

  beforeEach(() => {
    [
      mockGroupBy,
      mockCreateMany,
      mockFindMany,
      mockCount,
      mockFindUnique,
      mockUpdateMany,
      mockShopFindUnique,
      mockChangeFindUnique,
      mockChangeFindUniqueOrThrow,
      mockChangeFindMany,
      mockChangeCount,
      mockChangeUpdateMany,
      mockChangeCreate,
      mockTransaction,
    ].forEach((m) => m.mockReset());
    mockTransaction.mockImplementation(async (fn: (tx: typeof prismaClient) => unknown) =>
      fn(prismaClient),
    );
    // Default: shop belongs to the brand under test.
    mockShopFindUnique.mockResolvedValue({ brandId: 'homtone' });
    (glm.generateJson as ReturnType<typeof vi.fn>).mockReset();
    (costTracking.record as ReturnType<typeof vi.fn>).mockClear();
    (costTracking.record as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (audit.logWrite as ReturnType<typeof vi.fn>).mockClear();
    (realtimeBus.publish as ReturnType<typeof vi.fn>).mockClear();
    service = new AdSuggestionService(prismaManager, glm, costTracking, audit, config, realtimeBus);
  });

  describe('generate — cross-brand isolation (P0)', () => {
    it('rejects shopId belonging to another brand (Forbidden)', async () => {
      mockShopFindUnique.mockResolvedValue({ brandId: 'spoonlemon' });
      await expect(
        service.generate({ shopId: 'shop-spoonlemon', brandId: 'homtone' }),
      ).rejects.toThrow(/does not belong/);
      expect(mockGroupBy).not.toHaveBeenCalled();
      expect(glm.generateJson).not.toHaveBeenCalled();
    });

    it('throws NotFound when shopId does not exist', async () => {
      mockShopFindUnique.mockResolvedValue(null);
      await expect(service.generate({ shopId: 'nope', brandId: 'homtone' })).rejects.toThrow(
        /Shop nope not found/,
      );
    });
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
      mockGroupBy.mockResolvedValue([BREACHING_GROUPBY_ROW]);
      (glm.generateJson as ReturnType<typeof vi.fn>).mockResolvedValue({
        suggestions: [VALID_GLM_SUGGESTION],
      });
      mockCreateMany.mockResolvedValue({ count: 1 });

      const result = await service.generate({ shopId: 'shop-1', brandId: 'homtone' });

      expect(glm.generateJson).toHaveBeenCalledTimes(1);
      expect(mockCreateMany).toHaveBeenCalledTimes(1);
      expect(result.count).toBe(1);
      expect(result.batchId).toBeDefined();
      expect(costTracking.record).toHaveBeenCalled();
    });

    it('triggers breach branch when CTR is low and impressions > 1000', async () => {
      mockGroupBy.mockResolvedValue([
        {
          campaignId: 'c-low-ctr',
          campaignName: 'Low CTR',
          adType: 'sp',
          _sum: {
            spend: makeDecimal(10),
            sales: makeDecimal(500),
            impressions: 5000, // > 1000
            clicks: 1, // CTR = 0.02% < 0.1%
            orders: 1,
          },
        },
      ]);
      (glm.generateJson as ReturnType<typeof vi.fn>).mockResolvedValue({ suggestions: [] });

      const result = await service.generate({ shopId: 'shop-1', brandId: 'homtone' });

      expect(glm.generateJson).toHaveBeenCalledTimes(1);
      expect(result.count).toBe(0);
    });

    it('returns count=0 when GLM returns empty array', async () => {
      mockGroupBy.mockResolvedValue([BREACHING_GROUPBY_ROW]);
      (glm.generateJson as ReturnType<typeof vi.fn>).mockResolvedValue({ suggestions: [] });

      const result = await service.generate({ shopId: 'shop-1', brandId: 'homtone' });

      expect(result.count).toBe(0);
      expect(mockCreateMany).not.toHaveBeenCalled();
    });

    it('records cost tracking even when GLM throws and rethrows the original error', async () => {
      mockGroupBy.mockResolvedValue([BREACHING_GROUPBY_ROW]);
      (glm.generateJson as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('glm down'));

      await expect(service.generate({ shopId: 'shop-1', brandId: 'homtone' })).rejects.toThrow(
        'glm down',
      );
      expect(costTracking.record).toHaveBeenCalled();
    });

    it('does not shadow GLM success when costTracking throws', async () => {
      mockGroupBy.mockResolvedValue([BREACHING_GROUPBY_ROW]);
      (glm.generateJson as ReturnType<typeof vi.fn>).mockResolvedValue({
        suggestions: [VALID_GLM_SUGGESTION],
      });
      mockCreateMany.mockResolvedValue({ count: 1 });
      (costTracking.record as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('cost db down'),
      );

      const result = await service.generate({ shopId: 'shop-1', brandId: 'homtone' });

      expect(result.count).toBe(1);
    });

    it('filters GLM suggestions with invalid actionType / negative values', async () => {
      mockGroupBy.mockResolvedValue([BREACHING_GROUPBY_ROW]);
      (glm.generateJson as ReturnType<typeof vi.fn>).mockResolvedValue({
        suggestions: [
          { ...VALID_GLM_SUGGESTION, actionType: 'unknown_action' }, // bad enum
          { ...VALID_GLM_SUGGESTION, suggestedValue: -1 }, // negative
          { ...VALID_GLM_SUGGESTION, field: 'unknown_field' }, // bad field
        ],
      });

      const result = await service.generate({ shopId: 'shop-1', brandId: 'homtone' });

      expect(result.count).toBe(0);
      expect(mockCreateMany).not.toHaveBeenCalled();
    });

    it('handles non-array suggestions response gracefully', async () => {
      mockGroupBy.mockResolvedValue([BREACHING_GROUPBY_ROW]);
      (glm.generateJson as ReturnType<typeof vi.fn>).mockResolvedValue({
        suggestions: { not: 'an array' },
      });

      const result = await service.generate({ shopId: 'shop-1', brandId: 'homtone' });

      expect(result.count).toBe(0);
    });
  });

  describe('list — total/expiry consistency (P1)', () => {
    it('lazy-expires suggestions whose expiresAt is in the past (no status filter)', async () => {
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

    it("excludes lazy-expired pending rows when caller asks for status='pending'", async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await service.list({ brandId: 'homtone', status: 'pending' as never });

      const whereArg = mockFindMany.mock.calls[0]?.[0]?.where;
      expect(whereArg.status).toBe('pending');
      expect(whereArg.expiresAt).toEqual({ gt: expect.any(Date) });
      // total query must use the same WHERE so counts stay consistent
      expect(mockCount.mock.calls[0]?.[0]?.where).toEqual(whereArg);
    });

    it("includes pending+expired rows when caller asks for status='expired'", async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await service.list({ brandId: 'homtone', status: 'expired' as never });

      const whereArg = mockFindMany.mock.calls[0]?.[0]?.where;
      expect(whereArg.OR).toBeDefined();
      expect(whereArg.OR).toHaveLength(2);
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

  describe('execute — atomic CAS (P0)', () => {
    const pendingSuggestion = {
      id: 's1',
      brandId: 'homtone',
      status: 'pending',
      expiresAt: new Date(Date.now() + 86_400_000),
      shopId: 'shop-1',
      campaignId: 'c1',
      actionType: 'decrease_bid',
      field: 'bid',
      currentValue: makeDecimal(1.5),
      suggestedValue: makeDecimal(1.2),
      adType: 'sp',
      campaignName: 'C1',
      reason: 'r',
    };

    it('marks pending suggestion as executed via atomic CAS and creates an AdChange', async () => {
      mockFindUnique.mockResolvedValue(pendingSuggestion);
      mockUpdateMany.mockResolvedValue({ count: 1 });
      mockChangeCreate.mockResolvedValue({ id: 'ch1' });

      const result = await service.execute('s1', 'homtone', 'user-1');

      expect(mockUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 's1',
            brandId: 'homtone',
            status: 'pending',
            expiresAt: { gt: expect.any(Date) },
          }),
        }),
      );
      expect(mockChangeCreate).toHaveBeenCalled();
      expect(audit.logWrite).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ads.suggestion.execute' }),
      );
      expect(result.change.id).toBe('ch1');
    });

    it('throws ConflictException when concurrent update wins (CAS count=0)', async () => {
      mockFindUnique.mockResolvedValue(pendingSuggestion);
      mockUpdateMany.mockResolvedValue({ count: 0 });

      await expect(service.execute('s1', 'homtone')).rejects.toThrow(/concurrent update/);
      expect(mockChangeCreate).not.toHaveBeenCalled();
      expect(audit.logWrite).not.toHaveBeenCalled();
    });

    it('rejects execution if suggestion is not pending', async () => {
      mockFindUnique.mockResolvedValue({
        ...pendingSuggestion,
        status: 'executed',
      });
      await expect(service.execute('s1', 'homtone')).rejects.toThrow(/cannot execute/);
    });

    it('rejects execution if suggestion has expired', async () => {
      mockFindUnique.mockResolvedValue({
        ...pendingSuggestion,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.execute('s1', 'homtone')).rejects.toThrow(/expired/);
    });
  });

  describe('reject — atomic CAS', () => {
    it('marks pending suggestion as rejected via atomic CAS', async () => {
      mockFindUnique.mockResolvedValue({
        id: 's1',
        brandId: 'homtone',
        status: 'pending',
        expiresAt: new Date(Date.now() + 86_400_000),
      });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const result = await service.reject('s1', 'homtone', 'user-1');

      expect(result.status).toBe('rejected');
      expect(audit.logWrite).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ads.suggestion.reject' }),
      );
    });

    it('throws ConflictException when CAS count=0', async () => {
      mockFindUnique.mockResolvedValue({
        id: 's1',
        brandId: 'homtone',
        status: 'pending',
        expiresAt: new Date(Date.now() + 86_400_000),
      });
      mockUpdateMany.mockResolvedValue({ count: 0 });

      await expect(service.reject('s1', 'homtone')).rejects.toThrow(/concurrent update/);
      expect(audit.logWrite).not.toHaveBeenCalled();
    });
  });

  describe('rollback — atomic CAS (P1)', () => {
    const reversibleChange = {
      id: 'ch1',
      brandId: 'homtone',
      status: 'executed',
      suggestionId: 's1',
      reversibleBefore: new Date(Date.now() + 3600_000),
      valueBefore: makeDecimal(1.5),
      valueAfter: makeDecimal(1.2),
    };

    it('rolls back an executed change within the 24h window via atomic CAS', async () => {
      mockChangeFindUnique.mockResolvedValue(reversibleChange);
      mockChangeUpdateMany.mockResolvedValue({ count: 1 });
      mockChangeFindUniqueOrThrow.mockResolvedValue({ id: 'ch1', status: 'rolled_back' });
      mockFindUnique.mockResolvedValue({ expiresAt: new Date(Date.now() + 86_400_000) });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const result = await service.rollback('ch1', 'homtone', 'user-1');

      expect(result.status).toBe('rolled_back');
      expect(mockChangeUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'ch1',
            brandId: 'homtone',
            status: 'executed',
            reversibleBefore: { gt: expect.any(Date) },
          }),
        }),
      );
      expect(mockUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'pending' }) }),
      );
      expect(audit.logWrite).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ads.change.rollback' }),
      );
    });

    it('reverts suggestion to expired (not pending) when its TTL has passed', async () => {
      mockChangeFindUnique.mockResolvedValue(reversibleChange);
      mockChangeUpdateMany.mockResolvedValue({ count: 1 });
      mockChangeFindUniqueOrThrow.mockResolvedValue({ id: 'ch1', status: 'rolled_back' });
      // Suggestion TTL elapsed during the change's lifetime — must not become pending.
      mockFindUnique.mockResolvedValue({ expiresAt: new Date(Date.now() - 1000) });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const result = await service.rollback('ch1', 'homtone', 'user-1');

      expect(result.status).toBe('rolled_back');
      expect(mockUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'expired' }) }),
      );
    });

    it('throws ConflictException when concurrent rollback wins (CAS count=0)', async () => {
      mockChangeFindUnique.mockResolvedValue(reversibleChange);
      mockChangeUpdateMany.mockResolvedValue({ count: 0 });

      await expect(service.rollback('ch1', 'homtone')).rejects.toThrow(/no longer reversible/);
      expect(audit.logWrite).not.toHaveBeenCalled();
    });

    it('succeeds even when source suggestion was deleted (no-op updateMany)', async () => {
      mockChangeFindUnique.mockResolvedValue(reversibleChange);
      mockChangeUpdateMany.mockResolvedValue({ count: 1 });
      mockChangeFindUniqueOrThrow.mockResolvedValue({ id: 'ch1', status: 'rolled_back' });
      mockFindUnique.mockResolvedValue(null); // suggestion already deleted
      mockUpdateMany.mockResolvedValue({ count: 0 });

      const result = await service.rollback('ch1', 'homtone', 'user-1');

      expect(result.status).toBe('rolled_back');
    });

    it('rejects rollback past the 24h window', async () => {
      mockChangeFindUnique.mockResolvedValue({
        ...reversibleChange,
        reversibleBefore: new Date(Date.now() - 1000),
      });
      await expect(service.rollback('ch1', 'homtone')).rejects.toThrow(/24h rollback window/);
    });

    it('rejects rollback when already rolled back', async () => {
      mockChangeFindUnique.mockResolvedValue({ ...reversibleChange, status: 'rolled_back' });
      await expect(service.rollback('ch1', 'homtone')).rejects.toThrow(/cannot rollback/);
    });

    it('throws NotFound when brand mismatches', async () => {
      mockChangeFindUnique.mockResolvedValue({ id: 'ch1', brandId: 'spoonlemon' });
      await expect(service.rollback('ch1', 'homtone')).rejects.toThrow();
    });
  });

  describe('realtime publish (P0-C)', () => {
    const flushMicrotasks = () => new Promise((r) => setImmediate(r));

    it('publishes ad-suggestion create event after generate succeeds', async () => {
      mockGroupBy.mockResolvedValue([BREACHING_GROUPBY_ROW]);
      (glm.generateJson as ReturnType<typeof vi.fn>).mockResolvedValue({
        suggestions: [VALID_GLM_SUGGESTION],
      });
      mockCreateMany.mockResolvedValue({ count: 1 });

      await service.generate({ shopId: 'shop-1', brandId: 'homtone', userId: 'u1' });
      await flushMicrotasks();

      expect(realtimeBus.publish).toHaveBeenCalledTimes(1);
      const evt = (realtimeBus.publish as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(evt).toMatchObject({
        entity: 'ad-suggestion',
        action: 'create',
        brandId: 'homtone',
        actorType: 'user',
        actorId: 'u1',
      });
      expect(evt.metadata).toMatchObject({ shopId: 'shop-1', count: 1 });
    });

    it('skips publish when generate produces zero suggestions', async () => {
      mockGroupBy.mockResolvedValue([]);
      const result = await service.generate({ shopId: 'shop-1', brandId: 'homtone' });
      await flushMicrotasks();
      expect(result.count).toBe(0);
      expect(realtimeBus.publish).not.toHaveBeenCalled();
    });

    it('publishes ad-suggestion update + ad-change create after execute', async () => {
      const now = Date.now();
      mockFindUnique.mockResolvedValue({
        id: 's1',
        brandId: 'homtone',
        shopId: 'shop-1',
        status: 'pending',
        expiresAt: new Date(now + 86_400_000),
        currentValue: makeDecimal(1.5),
        suggestedValue: makeDecimal(1.2),
        actionType: 'decrease_bid',
        field: 'bid',
        campaignId: 'c1',
        adType: 'sp',
        reason: 'test',
      });
      mockUpdateMany.mockResolvedValue({ count: 1 });
      mockChangeCreate.mockResolvedValue({ id: 'ch1' });

      await service.execute('s1', 'homtone', 'user-1');
      await flushMicrotasks();

      expect(realtimeBus.publish).toHaveBeenCalledTimes(2);
      const calls = (realtimeBus.publish as ReturnType<typeof vi.fn>).mock.calls;
      const entities = calls.map((c: any[]) => c[0].entity);
      expect(entities).toEqual(expect.arrayContaining(['ad-suggestion', 'ad-change']));
    });

    it('publishes ad-suggestion update on reject', async () => {
      mockFindUnique.mockResolvedValue({
        id: 's1',
        brandId: 'homtone',
        shopId: 'shop-1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 86_400_000),
      });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      await service.reject('s1', 'homtone', 'user-1');
      await flushMicrotasks();

      expect(realtimeBus.publish).toHaveBeenCalledTimes(1);
      expect((realtimeBus.publish as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject({
        entity: 'ad-suggestion',
        action: 'update',
        brandId: 'homtone',
      });
    });

    it('publishes ad-change update + ad-suggestion update on rollback', async () => {
      mockChangeFindUnique.mockResolvedValue({
        id: 'ch1',
        brandId: 'homtone',
        shopId: 'shop-1',
        status: 'executed',
        suggestionId: 's1',
        reversibleBefore: new Date(Date.now() + 3600_000),
        valueBefore: makeDecimal(1.5),
        valueAfter: makeDecimal(1.2),
      });
      mockChangeUpdateMany.mockResolvedValue({ count: 1 });
      mockChangeFindUniqueOrThrow.mockResolvedValue({ id: 'ch1', status: 'rolled_back' });
      mockFindUnique.mockResolvedValue({ expiresAt: new Date(Date.now() + 86_400_000) });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      await service.rollback('ch1', 'homtone', 'user-1');
      await flushMicrotasks();

      const calls = (realtimeBus.publish as ReturnType<typeof vi.fn>).mock.calls;
      const entities = calls.map((c: any[]) => c[0].entity);
      expect(entities).toEqual(expect.arrayContaining(['ad-change', 'ad-suggestion']));
    });
  });
});
