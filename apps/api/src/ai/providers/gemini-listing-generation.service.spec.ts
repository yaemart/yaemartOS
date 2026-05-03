import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerateListingInput } from '@yaemartos/shared-types';
import {
  GeminiListingGenerationService,
  UnsupportedPlatformError,
} from './gemini-listing-generation.service';
import { WALMART_EN_LIMITS } from '../../listing/rules/walmart-en-limits';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateObject: vi.fn(),
    generateText: vi.fn(),
  };
});

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn()),
}));

import { generateObject, generateText } from 'ai';

const mockGenerateObject = vi.mocked(generateObject);
const mockGenerateText = vi.mocked(generateText);

function createService(apiKey?: string) {
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'GEMINI_API_KEY') {
        return apiKey;
      }
      if (key === 'GEMINI_PRO_MODEL') {
        return 'gemini-2.5-pro';
      }
      if (key === 'GEMINI_FLASH_MODEL') {
        return 'gemini-2.0-flash';
      }
      return undefined;
    }),
  } as unknown as ConfigService;

  const mockCostTracking = { record: vi.fn().mockResolvedValue(undefined) } as any;
  return new GeminiListingGenerationService(config, mockCostTracking);
}

const baseInput: GenerateListingInput = {
  brandId: 'homtone',
  platform: 'amazon',
  productTitle: 'Stainless Steel Slow Cooker',
  productCategory: 'Kitchen Appliances',
  targetLocale: 'en',
  keywords: ['slow cooker', 'crockpot'],
};

describe('GeminiListingGenerationService', () => {
  describe('helloWorld', () => {
    it('returns mock message when no API key is configured', async () => {
      const service = createService(undefined);
      const result = await service.helloWorld();
      expect(result).toContain('mock');
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it('calls generateText when API key is present', async () => {
      mockGenerateText.mockResolvedValue({ text: 'Hello yaemartOS\n' } as any);
      const service = createService('fake-key');
      const result = await service.helloWorld();
      expect(result).toBe('Hello yaemartOS');
      expect(mockGenerateText).toHaveBeenCalledOnce();
    });
  });

  describe('generateListing', () => {
    it('returns mock content when no API key is configured', async () => {
      const service = createService(undefined);
      const result = await service.generateListing(baseInput);
      expect(result.title).toBeTruthy();
      expect(result.bullets).toHaveLength(5);
      expect(result.description).toBeTruthy();
      expect(mockGenerateObject).not.toHaveBeenCalled();
    });

    it('calls generateObject with API key and returns valid content', async () => {
      const mockContent = {
        title: 'Homtone Stainless Steel Slow Cooker 6-Quart',
        bullets: [
          'Durable Build — Stainless steel exterior resists scratches',
          'Large Capacity — 6-quart pot fits a whole chicken',
          'Easy Controls — One-touch digital settings',
          'Keep Warm — Automatically switches after cooking',
          'Dishwasher Safe — Removable ceramic insert cleans easily',
        ],
        description: 'The Homtone Slow Cooker delivers professional-grade cooking at home.',
        searchTerms: ['slow cooker', 'crockpot', 'stainless steel'],
      };
      mockGenerateObject.mockResolvedValue({ object: mockContent } as any);

      const service = createService('fake-key');
      const result = await service.generateListing(baseInput);

      expect(result.title).toBe(mockContent.title);
      expect(result.bullets).toHaveLength(5);
      expect(mockGenerateObject).toHaveBeenCalledOnce();
    });

    it('throws when AI returns content that fails character validation', async () => {
      const oversizedContent = {
        title: 'X'.repeat(250),
        bullets: ['A', 'B', 'C', 'D', 'E'],
        description: 'Short',
        searchTerms: ['keyword'],
      };
      mockGenerateObject.mockResolvedValue({ object: oversizedContent } as any);

      const service = createService('fake-key');
      await expect(service.generateListing(baseInput)).rejects.toThrow(/character rules/i);
    });

    it('includes four input channels in the assembled prompt', async () => {
      const enrichedInput: GenerateListingInput = {
        ...baseInput,
        competitorUrls: ['https://amazon.com/dp/B123456'],
        manualSellingPoints: 'Energy efficient, quiet motor',
        categoryLexicon: ['slow cook', 'braising'],
        lingxingKeywordSeed: ['instant pot', 'rice cooker'],
      };

      const mockContent = {
        title: 'Homtone Premium Slow Cooker',
        bullets: ['A — one', 'B — two', 'C — three', 'D — four', 'E — five'],
        description: 'Great slow cooker for home use.',
        searchTerms: ['slow cooker'],
      };
      mockGenerateObject.mockResolvedValue({ object: mockContent } as any);

      const service = createService('fake-key');
      await service.generateListing(enrichedInput);

      const lastCall = mockGenerateObject.mock.calls[mockGenerateObject.mock.calls.length - 1];
      expect((lastCall[0] as any).prompt).toContain('Energy efficient');
      expect((lastCall[0] as any).prompt).toContain('slow cook');
      expect((lastCall[0] as any).prompt).toContain('instant pot');
    });

    it('backward compatible — minimal input (original fields only) still works', async () => {
      const service = createService(undefined);
      const minimalInput: GenerateListingInput = {
        brandId: 'davivy',
        platform: 'amazon',
        productTitle: 'Wireless Earbuds',
        productCategory: 'Electronics',
        targetLocale: 'en',
      };
      const result = await service.generateListing(minimalInput);
      expect(result.title).toBeTruthy();
      expect(result.bullets).toHaveLength(5);
    });
  });

  // ── Walmart platform ───────────────────────────────────────────────────────

  describe('generateListing (Walmart platform, mock mode)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    const walmartInput: GenerateListingInput = {
      brandId: 'homtone',
      platform: 'walmart',
      productTitle: '6QT Programmable Slow Cooker',
      productCategory: 'Kitchen Appliances',
      targetLocale: 'en',
      keywords: ['slow cooker', 'crockpot'],
    };

    it('returns mock content with ≤ 10 bullets (Key Features) when no API key', async () => {
      const service = createService(undefined);
      const result = await service.generateListing(walmartInput);
      expect(result.title).toBeTruthy();
      expect(result.bullets.length).toBeLessThanOrEqual(WALMART_EN_LIMITS.KEY_FEATURES_MAX_COUNT);
      expect(result.description).toBeTruthy();
      expect(mockGenerateObject).not.toHaveBeenCalled();
    });

    it('uses Walmart prompt (contains "Key Features") when API key is set', async () => {
      const mockContent = {
        title: 'Homtone 6QT Programmable Slow Cooker',
        bullets: [
          'Holds up to 6 quarts for family-sized meals',
          'Digital timer keeps cooking on schedule',
          'Keep-warm mode activates automatically',
        ],
        description: 'The Homtone slow cooker delivers perfectly cooked meals every time.',
        searchTerms: ['slow cooker', 'crockpot'],
      };
      mockGenerateObject.mockResolvedValue({ object: mockContent } as any);

      const service = createService('fake-key');
      await service.generateListing(walmartInput);

      const lastCall = mockGenerateObject.mock.calls[mockGenerateObject.mock.calls.length - 1];
      expect((lastCall[0] as any).prompt).toContain('Key Features');
      expect((lastCall[0] as any).prompt).not.toContain('Bullet Points');
    });

    it('throws when Walmart AI output exceeds key-feature count limit', async () => {
      const oversized = {
        title: 'Homtone Cooker',
        bullets: Array.from(
          { length: WALMART_EN_LIMITS.KEY_FEATURES_MAX_COUNT + 1 },
          (_, i) => `Feature ${i}`,
        ),
        description: 'Good product.',
        searchTerms: ['cooker'],
      };
      mockGenerateObject.mockResolvedValue({ object: oversized } as any);

      const service = createService('fake-key');
      await expect(service.generateListing(walmartInput)).rejects.toThrow(/character rules/i);
    });

    it('does NOT apply Amazon 5-bullet limit to Walmart content', async () => {
      const walmartContent = {
        title: 'Homtone Cooker',
        bullets: Array.from(
          { length: 8 },
          (_, i) => `Feature ${i + 1} — detailed description here`,
        ),
        description: 'Quality slow cooker for busy families.',
        searchTerms: ['cooker'],
      };
      mockGenerateObject.mockResolvedValue({ object: walmartContent } as any);

      const service = createService('fake-key');
      const result = await service.generateListing(walmartInput);
      expect(result.bullets).toHaveLength(8);
    });
  });

  // ── Unsupported platform ───────────────────────────────────────────────────

  describe('generateListing (unsupported platform)', () => {
    it('throws UnsupportedPlatformError for platform shopify', async () => {
      const service = createService(undefined);
      const input: GenerateListingInput = {
        ...baseInput,
        platform: 'shopify' as any,
      };
      await expect(service.generateListing(input)).rejects.toThrow(UnsupportedPlatformError);
    });

    it('error message contains the unsupported platform name', async () => {
      const service = createService(undefined);
      const input: GenerateListingInput = {
        ...baseInput,
        platform: 'tiktok' as any,
      };
      await expect(service.generateListing(input)).rejects.toThrow(/tiktok/i);
    });
  });
});
