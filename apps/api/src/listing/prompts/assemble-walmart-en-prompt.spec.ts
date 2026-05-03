import { describe, expect, it } from 'vitest';
import { WALMART_EN_LIMITS } from '../rules/walmart-en-limits';
import { assembleWalmartEnPrompt } from './assemble-walmart-en-prompt';
import type { GenerateListingInput } from '@yaemartos/shared-types';

function baseInput(overrides?: Partial<GenerateListingInput>): GenerateListingInput {
  return {
    brandId: 'homtone',
    platform: 'walmart',
    productTitle: '6QT Programmable Slow Cooker',
    productCategory: 'Kitchen Appliances',
    targetLocale: 'en',
    ...overrides,
  };
}

describe('assembleWalmartEnPrompt', () => {
  it('uses Walmart-specific field label "Key Features" (not "Bullet Points")', () => {
    const prompt = assembleWalmartEnPrompt(baseInput());
    expect(prompt).toContain('Key Features');
    expect(prompt).not.toContain('Bullet Points');
  });

  it('uses "Short Description" label (not "product description")', () => {
    const prompt = assembleWalmartEnPrompt(baseInput());
    expect(prompt).toContain('Short Description');
  });

  it('uses "Search Keywords" label (not "Search Terms")', () => {
    const prompt = assembleWalmartEnPrompt(baseInput());
    expect(prompt).toContain('Search Keywords');
  });

  it('states the correct max Key Features count', () => {
    const prompt = assembleWalmartEnPrompt(baseInput());
    expect(prompt).toContain(String(WALMART_EN_LIMITS.KEY_FEATURES_MAX_COUNT));
  });

  it('states the correct Short Description character limit', () => {
    const prompt = assembleWalmartEnPrompt(baseInput());
    expect(prompt).toContain(String(WALMART_EN_LIMITS.SHORT_DESCRIPTION_MAX_CHARS));
  });

  it('states the correct Search Keywords character limit', () => {
    const prompt = assembleWalmartEnPrompt(baseInput());
    expect(prompt).toContain(String(WALMART_EN_LIMITS.SEARCH_KEYWORDS_MAX_CHARS));
  });

  it('includes competitor URLs when provided', () => {
    const prompt = assembleWalmartEnPrompt(
      baseInput({ competitorUrls: ['https://www.walmart.com/ip/12345'] }),
    );
    expect(prompt).toContain('https://www.walmart.com/ip/12345');
  });

  it('omits competitor section when no URLs provided', () => {
    const prompt = assembleWalmartEnPrompt(baseInput());
    expect(prompt).toContain('No competitor URLs provided.');
  });

  it('includes manual selling points when provided', () => {
    const prompt = assembleWalmartEnPrompt(
      baseInput({ manualSellingPoints: 'Dishwasher-safe parts' }),
    );
    expect(prompt).toContain('Dishwasher-safe parts');
  });

  it('includes keyword seeds from lingxingKeywordSeed when provided', () => {
    const prompt = assembleWalmartEnPrompt(
      baseInput({ lingxingKeywordSeed: ['slow cooker', 'crockpot'] }),
    );
    expect(prompt).toContain('slow cooker');
    expect(prompt).toContain('crockpot');
  });

  it('includes brand name in the prompt preamble', () => {
    const prompt = assembleWalmartEnPrompt(baseInput({ brandId: 'spoonlemon' }));
    expect(prompt).toContain('spoonlemon');
  });

  it('specifies the platform as walmart', () => {
    const prompt = assembleWalmartEnPrompt(baseInput());
    expect(prompt).toContain('platform: walmart');
  });

  describe('Brand Voice injection', () => {
    it('injects homtone voice guide for homtone brand', () => {
      const prompt = assembleWalmartEnPrompt(baseInput({ brandId: 'homtone' }));
      expect(prompt).toContain('Brand Voice Guide');
      expect(prompt.toLowerCase()).toContain('warm');
    });

    it('injects spoonlemon voice guide', () => {
      const prompt = assembleWalmartEnPrompt(baseInput({ brandId: 'spoonlemon' }));
      expect(prompt).toContain('Brand Voice Guide');
      expect(prompt.toLowerCase()).toContain('playful');
    });

    it('injects davivy voice guide', () => {
      const prompt = assembleWalmartEnPrompt(baseInput({ brandId: 'davivy' }));
      expect(prompt).toContain('Brand Voice Guide');
      expect(prompt.toLowerCase()).toContain('sophisticated');
    });

    it('injects tysun voice guide', () => {
      const prompt = assembleWalmartEnPrompt(baseInput({ brandId: 'tysun' }));
      expect(prompt).toContain('Brand Voice Guide');
      expect(prompt.toLowerCase()).toContain('energetic');
    });

    it('uses professional fallback for an unknown brand', () => {
      const prompt = assembleWalmartEnPrompt({ ...baseInput(), brandId: 'acme' as any });
      expect(prompt).toContain('no specific voice guide');
    });
  });
});
