import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ListingController } from './listing.controller';

function makeController(overrides?: {
  featureFlagValues?: Record<string, boolean>;
  generateListing?: () => Promise<unknown>;
  terminology?: unknown[];
}) {
  const listingService = {
    resolvePlatformId: vi.fn().mockResolvedValue('plat1'),
    findOrCreateDraft: vi
      .fn()
      .mockResolvedValue({ id: 'lst1', brandId: 'homtone', language: 'en' }),
    findAll: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20 }),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  } as any;

  const versionService = {
    createVersion: vi.fn().mockResolvedValue({ id: 'v1', versionNumber: 1 }),
    listVersions: vi.fn().mockResolvedValue([]),
    activateVersion: vi.fn(),
  } as any;

  const listingGeneration = {
    generateListing:
      overrides?.generateListing ??
      vi.fn().mockResolvedValue({
        title: 'Test',
        bullets: [],
        description: '',
        searchTerms: [],
      }),
  } as any;

  const featureFlag = {
    isEnabled: vi.fn().mockImplementation(async (flag: string) => {
      return overrides?.featureFlagValues?.[flag] ?? true;
    }),
  } as any;

  const terminologyService = {
    findByBrandAndLocale: vi.fn().mockResolvedValue(overrides?.terminology ?? []),
  } as any;

  const controller = new ListingController(
    listingService,
    versionService,
    listingGeneration,
    featureFlag,
    terminologyService,
  );

  return {
    controller,
    listingService,
    versionService,
    listingGeneration,
    featureFlag,
    terminologyService,
  };
}

const BASE_BODY = {
  productId: 'prod1',
  brandId: 'homtone',
  marketId: 'mkt1',
  productTitle: 'Test Speaker',
  productCategory: 'Electronics',
  targets: [{ shopId: 'shop1', platformCode: 'amazon', platformListingId: 'ASIN1' }],
};

describe('ListingController.batchGenerate', () => {
  it('generates one result for single language (backward compat language field)', async () => {
    const { controller } = makeController();
    const result = await controller.batchGenerate({ ...BASE_BODY, language: 'en' }, {
      user: { role: 'operator', brandId: 'homtone' },
    } as any);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].language).toBe('en');
    expect(result.results[0].status).toBe('completed');
  });

  it('generates 2 results for languages: ["en", "es"] × 1 target', async () => {
    const { controller } = makeController();
    const result = await controller.batchGenerate({ ...BASE_BODY, languages: ['en', 'es'] }, {
      user: { role: 'operator', brandId: 'homtone' },
    } as any);
    expect(result.results).toHaveLength(2);
    const langs = result.results.map((r) => r.language);
    expect(langs).toContain('en');
    expect(langs).toContain('es');
  });

  it('generates 6 results for languages: ["en","es","fr"] × 2 targets', async () => {
    const { controller, listingService } = makeController();
    listingService.findOrCreateDraft.mockResolvedValue({
      id: 'lst1',
      brandId: 'homtone',
      language: 'en',
    });
    const result = await controller.batchGenerate(
      {
        ...BASE_BODY,
        languages: ['en', 'es', 'fr'],
        targets: [
          { shopId: 'shop1', platformCode: 'amazon', platformListingId: 'ASIN1' },
          { shopId: 'shop2', platformCode: 'walmart', platformListingId: 'W1' },
        ],
      },
      { user: { role: 'operator', brandId: 'homtone' } } as any,
    );
    expect(result.results).toHaveLength(6);
  });

  it('throws BadRequestException when neither language nor languages is provided', async () => {
    const { controller } = makeController();
    await expect(
      controller.batchGenerate({ ...BASE_BODY } as any, { user: { role: 'operator' } } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws ForbiddenException when LISTING_AI feature flag is off', async () => {
    const { controller } = makeController({ featureFlagValues: { LISTING_AI: false } });
    await expect(
      controller.batchGenerate({ ...BASE_BODY, language: 'en' }, {
        user: { role: 'operator' },
      } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('restricts to EN only when MULTILINGUAL_LISTING_GENERATION flag is off', async () => {
    const { controller } = makeController({
      featureFlagValues: { LISTING_AI: true, MULTILINGUAL_LISTING_GENERATION: false },
    });
    const result = await controller.batchGenerate({ ...BASE_BODY, languages: ['en', 'es', 'fr'] }, {
      user: { role: 'operator', brandId: 'homtone' },
    } as any);
    // Should only generate EN (multilingual disabled)
    expect(result.results).toHaveLength(1);
    expect(result.results[0].language).toBe('en');
  });

  it('injects terminology into generateListing call', async () => {
    const terms = [
      {
        term: 'HomPure',
        definition: 'flagship line',
        locale: 'es',
        brandId: 'homtone',
        id: 't1',
        createdAt: new Date(),
        updatedAt: new Date(),
        category: null,
        example: null,
      },
    ];
    const { controller, listingGeneration } = makeController({ terminology: terms });
    await controller.batchGenerate({ ...BASE_BODY, language: 'es' }, {
      user: { role: 'operator', brandId: 'homtone' },
    } as any);
    expect(listingGeneration.generateListing).toHaveBeenCalledWith(
      expect.objectContaining({
        terminology: [{ term: 'HomPure', definition: 'flagship line' }],
      }),
    );
  });

  it('degrades to empty terminology array when terminology service throws', async () => {
    const { controller, terminologyService, listingGeneration } = makeController();
    terminologyService.findByBrandAndLocale.mockRejectedValue(new Error('DB down'));
    const result = await controller.batchGenerate({ ...BASE_BODY, language: 'en' }, {
      user: { role: 'operator', brandId: 'homtone' },
    } as any);
    expect(result.results[0].status).toBe('completed');
    expect(listingGeneration.generateListing).toHaveBeenCalledWith(
      expect.objectContaining({ terminology: [] }),
    );
  });

  it('throws BadRequestException when all targets fail', async () => {
    const { controller } = makeController({
      generateListing: vi.fn().mockRejectedValue(new Error('LLM down')),
    });
    await expect(
      controller.batchGenerate({ ...BASE_BODY, language: 'en' }, {
        user: { role: 'operator' },
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
