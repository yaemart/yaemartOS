import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CostTrackingService } from './cost-tracking.service';
import type { PrismaClientManager } from '../database/prisma.service';

function makeService(createImpl?: (data: unknown) => Promise<unknown>) {
  const mockCreate = createImpl ?? vi.fn().mockResolvedValue({ id: 'log-1' });
  const mockPrisma = { aiCallLog: { create: mockCreate } };
  const mockPrismaManager = {
    getPublicClient: vi.fn().mockReturnValue(mockPrisma),
  } as unknown as PrismaClientManager;

  const service = new CostTrackingService(mockPrismaManager);
  return { service, mockCreate, mockPrisma };
}

describe('CostTrackingService', () => {
  describe('record() - happy path', () => {
    it('writes an AiCallLog record to the DB', async () => {
      const { service, mockCreate } = makeService();
      await service.record({
        model: 'glm-4-flash',
        taskType: 'faq',
        brandId: 'homtone',
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 1200,
      });
      expect(mockCreate).toHaveBeenCalledOnce();
      const data = (mockCreate as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
      expect(data.model).toBe('glm-4-flash');
      expect(data.taskType).toBe('faq');
      expect(data.brandId).toBe('homtone');
      expect(data.promptTokens).toBe(100);
      expect(data.completionTokens).toBe(50);
    });

    it('calculates estimatedCostUsd for known model (glm-4-flash)', async () => {
      const { service, mockCreate } = makeService();
      await service.record({
        model: 'glm-4-flash',
        taskType: 'faq',
        promptTokens: 1000,
        completionTokens: 1000,
        durationMs: 500,
      });
      const data = (mockCreate as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
      // 1000 tokens: input 0.0001 + output 0.0001 = 0.0002
      expect(Number(data.estimatedCostUsd)).toBeCloseTo(0.0002, 6);
    });

    it('uses default pricing for unknown model', async () => {
      const { service, mockCreate } = makeService();
      await service.record({
        model: 'unknown-model-v99',
        taskType: 'extraction',
        promptTokens: 1000,
        completionTokens: 1000,
        durationMs: 200,
      });
      const data = (mockCreate as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
      expect(Number(data.estimatedCostUsd)).toBeGreaterThan(0);
    });

    it('records zero-cost calls (estimatedCostUsd=0 when tokens=0)', async () => {
      const { service, mockCreate } = makeService();
      await service.record({
        model: 'glm-4-flash',
        taskType: 'faq',
        promptTokens: 0,
        completionTokens: 0,
        durationMs: 0,
      });
      const data = (mockCreate as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
      expect(Number(data.estimatedCostUsd)).toBe(0);
    });
  });

  describe('record() - error path (best-effort)', () => {
    it('does NOT throw when DB write fails', async () => {
      const { service } = makeService(vi.fn().mockRejectedValue(new Error('DB down')));
      await expect(
        service.record({
          model: 'gemini-2.5-pro',
          taskType: 'listing',
          promptTokens: 500,
          completionTokens: 200,
          durationMs: 3000,
        }),
      ).resolves.not.toThrow();
    });

    it('caller receives no error signal when DB write fails', async () => {
      const { service } = makeService(vi.fn().mockRejectedValue(new Error('Connection timeout')));
      const result = await service.record({
        model: 'glm-4-flash',
        taskType: 'faq',
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 400,
      });
      expect(result).toBeUndefined();
    });
  });
});
