import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { FaqGenerationService } from './faq-generation.service';
import type { GlmGenerationService } from './glm-generation.service';
import type { PrismaClientManager } from '../../database/prisma.service';

const GLM_JSON_RESPONSE = {
  faqs: [
    {
      question: 'What material is this product made of?',
      answer: 'This product is made from high-grade stainless steel for maximum durability.',
    },
    {
      question: 'Is this dishwasher safe?',
      answer: 'Yes, all components are dishwasher safe on the top rack.',
    },
    {
      question: 'What warranty does Homtone offer?',
      answer: 'Homtone provides a 2-year limited warranty covering manufacturing defects.',
    },
  ],
};

function makeService(opts: {
  product?: object | null;
  glmJson?: object;
  glmThrows?: boolean;
  upsertResult?: object;
}) {
  const mockPrisma = {
    product: {
      findUnique: vi.fn().mockResolvedValue(
        opts.product !== undefined
          ? opts.product
          : {
              id: 'prod-1',
              title: 'Stainless Steel Slow Cooker',
              sku: 'SKU-001',
              brand: { name: 'Homtone', slug: 'homtone' },
              category: { name: 'Kitchen', slug: 'kitchen' },
              contents: [],
            },
      ),
    },
    productContent: {
      upsert: vi.fn().mockResolvedValue(opts.upsertResult ?? { id: 'pc-1' }),
    },
  };

  const mockPrismaManager = {
    getPublicClient: vi.fn().mockReturnValue(mockPrisma),
  } as unknown as PrismaClientManager;

  const mockGlm = {
    generateJson: opts.glmThrows
      ? vi.fn().mockRejectedValue(new Error('GLM unreachable'))
      : vi.fn().mockResolvedValue(opts.glmJson ?? GLM_JSON_RESPONSE),
  } as unknown as GlmGenerationService;

  const mockCostTracking = { record: vi.fn().mockResolvedValue(undefined) } as any;
  const mockConfig = { get: vi.fn().mockReturnValue(undefined) } as any;
  const service = new FaqGenerationService(
    mockPrismaManager,
    mockGlm,
    mockCostTracking,
    mockConfig,
  );
  return { service, mockPrisma, mockGlm };
}

describe('FaqGenerationService', () => {
  describe('generateFaq() - happy path', () => {
    it('returns payload with 3 parsed FAQs from GLM response', async () => {
      const { service } = makeService({});
      const result = await service.generateFaq('prod-1', 'en');

      expect(result.faqs).toHaveLength(3);
      expect(result.faqs[0].question).toContain('material');
      expect(result.faqs[0].answer).toBeTruthy();
      expect(result.generatedAt).toBeTruthy();
      expect(result.model).toBe('glm-4-flash');
    });

    it('upserts ProductContent with source=ai_generated', async () => {
      const { service, mockPrisma } = makeService({});
      await service.generateFaq('prod-1', 'en');

      expect(mockPrisma.productContent.upsert).toHaveBeenCalledOnce();
      const upsertCall = mockPrisma.productContent.upsert.mock.calls[0][0];
      expect(upsertCall.where.productId_locale_source.source).toBe('ai_generated');
      expect(upsertCall.where.productId_locale_source.productId).toBe('prod-1');
    });

    it('includes product title and brand in the prompt sent to GLM', async () => {
      const { service, mockGlm } = makeService({});
      await service.generateFaq('prod-1', 'en');

      // generateJson(systemPrompt, userPrompt) — product info is in the second arg
      const userPromptArg = (mockGlm.generateJson as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(userPromptArg).toContain('Stainless Steel Slow Cooker');
      expect(userPromptArg).toContain('Homtone');
    });
  });

  describe('generateFaq() - error paths', () => {
    it('throws NotFoundException when product does not exist', async () => {
      const { service } = makeService({ product: null });
      await expect(service.generateFaq('nonexistent', 'en')).rejects.toThrow(NotFoundException);
    });

    it('throws ServiceUnavailableException when GLM call fails', async () => {
      const { service } = makeService({ glmThrows: true });
      await expect(service.generateFaq('prod-1', 'en')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('does NOT fallback to Gemini when GLM is unavailable', async () => {
      const { service, mockPrisma } = makeService({ glmThrows: true });
      await expect(service.generateFaq('prod-1', 'en')).rejects.toThrow();
      expect(mockPrisma.productContent.upsert).not.toHaveBeenCalled();
    });
  });

  describe('FAQ parsing', () => {
    it('parses up to 5 FAQ items even if GLM returns more', async () => {
      const manyFaqs = {
        faqs: Array.from({ length: 7 }, (_, i) => ({
          question: `Question ${i + 1}`,
          answer: `Answer ${i + 1}`,
        })),
      };
      const { service } = makeService({ glmJson: manyFaqs });
      const result = await service.generateFaq('prod-1', 'en');
      expect(result.faqs.length).toBeLessThanOrEqual(5);
    });

    it('handles empty GLM response gracefully (returns empty faqs array)', async () => {
      const { service } = makeService({ glmJson: { faqs: [] } });
      const result = await service.generateFaq('prod-1', 'en');
      expect(result.faqs).toEqual([]);
    });
  });
});
