import { describe, expect, it } from 'vitest';
import { AMAZON_EN_LIMITS } from '../rules/amazon-en-limits';
import { assembleAmazonEnPrompt } from './assemble-listing-prompt';
import type { GenerateListingInput } from '@yaemartos/shared-types';

function baseInput(overrides?: Partial<GenerateListingInput>): GenerateListingInput {
  return {
    brandId: 'homtone',
    platform: 'amazon',
    productTitle: 'Wireless Bluetooth Speaker',
    productCategory: 'Electronics',
    targetLocale: 'en',
    ...overrides,
  };
}

describe('assembleAmazonEnPrompt', () => {
  describe('Brand Voice injection', () => {
    it('injects homtone voice guide into prompt', () => {
      const prompt = assembleAmazonEnPrompt(baseInput({ brandId: 'homtone' }));
      expect(prompt).toContain('Brand Voice Guide');
      expect(prompt.toLowerCase()).toContain('warm');
    });

    it('injects spoonlemon voice guide into prompt', () => {
      const prompt = assembleAmazonEnPrompt(baseInput({ brandId: 'spoonlemon' }));
      expect(prompt).toContain('Brand Voice Guide');
      expect(prompt.toLowerCase()).toContain('playful');
    });

    it('injects davivy voice guide into prompt', () => {
      const prompt = assembleAmazonEnPrompt(baseInput({ brandId: 'davivy' }));
      expect(prompt).toContain('Brand Voice Guide');
      expect(prompt.toLowerCase()).toContain('sophisticated');
    });

    it('injects tysun voice guide into prompt', () => {
      const prompt = assembleAmazonEnPrompt(baseInput({ brandId: 'tysun' }));
      expect(prompt).toContain('Brand Voice Guide');
      expect(prompt.toLowerCase()).toContain('energetic');
    });

    it('uses a fallback voice hint for an unknown brand', () => {
      const prompt = assembleAmazonEnPrompt(baseInput({ brandId: 'homtone' as any }));
      // Override after construction to simulate unknown brand
      const unknownInput = { ...baseInput(), brandId: 'acme' as any };
      const unknownPrompt = assembleAmazonEnPrompt(unknownInput);
      expect(unknownPrompt).toContain('no specific voice guide');
      expect(unknownPrompt).toContain('professional');
    });

    it('handles undefined brandId gracefully', () => {
      const prompt = assembleAmazonEnPrompt({ ...baseInput(), brandId: undefined as any });
      expect(prompt).toContain('no specific voice guide');
    });
  });

  describe('Amazon EN constraints', () => {
    it('states the correct title character limit', () => {
      const prompt = assembleAmazonEnPrompt(baseInput());
      expect(prompt).toContain(String(AMAZON_EN_LIMITS.TITLE_MAX_CHARS));
    });

    it('states the correct bullet character limit', () => {
      const prompt = assembleAmazonEnPrompt(baseInput());
      expect(prompt).toContain(String(AMAZON_EN_LIMITS.BULLET_MAX_CHARS));
    });

    it('states the correct description character limit', () => {
      const prompt = assembleAmazonEnPrompt(baseInput());
      expect(prompt).toContain(String(AMAZON_EN_LIMITS.DESCRIPTION_MAX_CHARS));
    });

    it('states the correct searchTerms byte limit', () => {
      const prompt = assembleAmazonEnPrompt(baseInput());
      expect(prompt).toContain(String(AMAZON_EN_LIMITS.SEARCH_TERMS_MAX_BYTES));
    });

    it('searchTerms constraint is "space-separated" (not "comma-separated")', () => {
      const prompt = assembleAmazonEnPrompt(baseInput());
      // Verify the fixed inconsistency: must say space-separated, not comma-separated
      const searchTermsLine = prompt
        .split('\n')
        .find((l) => l.toLowerCase().includes('searchterms'));
      expect(searchTermsLine).toBeDefined();
      expect(searchTermsLine!.toLowerCase()).toContain('space-separated');
      expect(searchTermsLine!.toLowerCase()).not.toContain('comma-separated');
    });
  });

  describe('Input channel injection', () => {
    it('includes competitor URLs when provided', () => {
      const prompt = assembleAmazonEnPrompt(
        baseInput({ competitorUrls: ['https://amazon.com/dp/B001'] }),
      );
      expect(prompt).toContain('https://amazon.com/dp/B001');
    });

    it('includes fallback when no competitor URLs', () => {
      const prompt = assembleAmazonEnPrompt(baseInput());
      expect(prompt).toContain('No competitor URLs provided.');
    });

    it('includes manual selling points when provided', () => {
      const prompt = assembleAmazonEnPrompt(
        baseInput({ manualSellingPoints: 'Waterproof, 20h battery' }),
      );
      expect(prompt).toContain('Waterproof, 20h battery');
    });

    it('uses lingxingKeywordSeed over keywords when both provided', () => {
      const prompt = assembleAmazonEnPrompt(
        baseInput({
          lingxingKeywordSeed: ['lingxing-kw'],
          keywords: ['fallback-kw'],
        }),
      );
      expect(prompt).toContain('lingxing-kw');
      expect(prompt).not.toContain('fallback-kw');
    });
  });

  describe('Output structure guidance', () => {
    it('instructs to output valid JSON', () => {
      const prompt = assembleAmazonEnPrompt(baseInput());
      expect(prompt).toContain('valid JSON');
    });

    it('instructs to avoid markdown formatting in JSON values', () => {
      const prompt = assembleAmazonEnPrompt(baseInput());
      expect(prompt).toContain('markdown formatting');
    });

    it('includes platform and brandId in the system persona line', () => {
      const prompt = assembleAmazonEnPrompt(baseInput({ brandId: 'davivy', platform: 'amazon' }));
      expect(prompt).toContain('"davivy"');
      expect(prompt).toContain('amazon');
    });
  });

  describe('Multi-locale direct writing strategy', () => {
    it('EN prompt contains English writing guidelines and no "Do NOT translate" directive', () => {
      const prompt = assembleAmazonEnPrompt(baseInput({ targetLocale: 'en' }));
      expect(prompt).toContain('Lead the title with the brand name');
      expect(prompt).not.toContain('Do NOT translate from English');
    });

    it('ES prompt contains Spanish writing guidelines and direct-write directive', () => {
      const prompt = assembleAmazonEnPrompt(baseInput({ targetLocale: 'es' }));
      expect(prompt).toContain('Do NOT translate from English');
      expect(prompt).toContain('Write ALL content directly in Spanish');
      expect(prompt).toContain('español');
    });

    it('FR prompt contains French writing guidelines and direct-write directive', () => {
      const prompt = assembleAmazonEnPrompt(baseInput({ targetLocale: 'fr' }));
      expect(prompt).toContain('Do NOT translate from English');
      expect(prompt).toContain('Write ALL content directly in French');
      expect(prompt).toContain('français');
    });

    it('unknown locale falls back to EN guidelines without throwing', () => {
      const prompt = assembleAmazonEnPrompt(baseInput({ targetLocale: 'zh' as any }));
      expect(prompt).toContain('Lead the title with the brand name');
    });
  });

  describe('Terminology injection', () => {
    it('injects terminology entries into Brand Voice section', () => {
      const terminology = [{ term: 'HomPure', definition: 'flagship purification line' }];
      const prompt = assembleAmazonEnPrompt(baseInput(), terminology);
      expect(prompt).toContain('Brand Terminology');
      expect(prompt).toContain('HomPure');
      expect(prompt).toContain('flagship purification line');
    });

    it('does not inject terminology block when array is empty', () => {
      const prompt = assembleAmazonEnPrompt(baseInput(), []);
      expect(prompt).not.toContain('Brand Terminology');
    });

    it('does not inject terminology block when parameter is undefined', () => {
      const prompt = assembleAmazonEnPrompt(baseInput());
      expect(prompt).not.toContain('Brand Terminology');
    });
  });
});
