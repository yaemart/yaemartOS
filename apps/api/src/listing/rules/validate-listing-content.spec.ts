import { describe, expect, it } from 'vitest';
import { AMAZON_EN_LIMITS } from './amazon-en-limits';
import { WALMART_EN_LIMITS, walmartEnRules } from './walmart-en-limits';
import { validateListingContent } from './validate-listing-content';
import type { ListingContent } from '@yaemartos/shared-types';

function validContent(): ListingContent {
  return {
    title: 'Premium Stainless Steel Slow Cooker 6-Quart',
    bullets: [
      'Easy one-touch controls for simple operation',
      'Dishwasher-safe removable stoneware insert',
      'Keep-warm function maintains perfect temperature',
      'Fits a 4-pound chicken or a 3-pound roast',
      'Locking lid for safe, easy transport',
    ],
    description: 'This slow cooker features a 6-quart capacity, ideal for families of up to 7.',
    searchTerms: ['slow cooker', 'crockpot', 'stainless steel'],
  };
}

describe('validateListingContent', () => {
  it('passes for a fully valid content object', () => {
    const result = validateListingContent(validContent());
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  describe('title', () => {
    it('passes at exact TITLE_MAX_CHARS limit', () => {
      const content = validContent();
      content.title = 'A'.repeat(AMAZON_EN_LIMITS.TITLE_MAX_CHARS);
      const result = validateListingContent(content);
      const titleViolations = result.violations.filter((v) => v.field === 'title');
      expect(titleViolations).toHaveLength(0);
    });

    it('fails when title is one character over the limit', () => {
      const content = validContent();
      content.title = 'A'.repeat(AMAZON_EN_LIMITS.TITLE_MAX_CHARS + 1);
      const result = validateListingContent(content);
      const violation = result.violations.find((v) => v.field === 'title');
      expect(violation).toBeDefined();
      expect(violation!.actual).toBe(AMAZON_EN_LIMITS.TITLE_MAX_CHARS + 1);
      expect(violation!.limit).toBe(AMAZON_EN_LIMITS.TITLE_MAX_CHARS);
      expect(result.valid).toBe(false);
    });

    it('records actual and limit numbers in violation', () => {
      const content = validContent();
      content.title = 'T'.repeat(250);
      const result = validateListingContent(content);
      const violation = result.violations.find((v) => v.field === 'title');
      expect(violation!.actual).toBe(250);
      expect(violation!.limit).toBe(AMAZON_EN_LIMITS.TITLE_MAX_CHARS);
    });
  });

  describe('bullets', () => {
    it('passes with exactly BULLETS_MAX_COUNT bullets', () => {
      const content = validContent();
      content.bullets = Array.from(
        { length: AMAZON_EN_LIMITS.BULLETS_MAX_COUNT },
        (_, i) => `Bullet ${i + 1}`,
      );
      const result = validateListingContent(content);
      const countViolation = result.violations.find((v) => v.field === 'bullets');
      expect(countViolation).toBeUndefined();
    });

    it('fails when bullet count exceeds BULLETS_MAX_COUNT', () => {
      const content = validContent();
      content.bullets = Array.from(
        { length: AMAZON_EN_LIMITS.BULLETS_MAX_COUNT + 1 },
        (_, i) => `Bullet ${i + 1}`,
      );
      const result = validateListingContent(content);
      const violation = result.violations.find((v) => v.field === 'bullets');
      expect(violation).toBeDefined();
      expect(result.valid).toBe(false);
    });

    it('passes when individual bullet is exactly BULLET_MAX_CHARS', () => {
      const content = validContent();
      content.bullets = ['A'.repeat(AMAZON_EN_LIMITS.BULLET_MAX_CHARS)];
      const result = validateListingContent(content);
      const bulletViolations = result.violations.filter((v) => v.field.startsWith('bullets['));
      expect(bulletViolations).toHaveLength(0);
    });

    it('fails for individual bullet over BULLET_MAX_CHARS', () => {
      const content = validContent();
      content.bullets = ['A'.repeat(AMAZON_EN_LIMITS.BULLET_MAX_CHARS + 1)];
      const result = validateListingContent(content);
      const violation = result.violations.find((v) => v.field === 'bullets[0]');
      expect(violation).toBeDefined();
      expect(violation!.actual).toBe(AMAZON_EN_LIMITS.BULLET_MAX_CHARS + 1);
      expect(result.valid).toBe(false);
    });

    it('reports correct index for second oversized bullet', () => {
      const content = validContent();
      content.bullets = ['OK bullet', 'A'.repeat(AMAZON_EN_LIMITS.BULLET_MAX_CHARS + 5)];
      const result = validateListingContent(content);
      const violation = result.violations.find((v) => v.field === 'bullets[1]');
      expect(violation).toBeDefined();
    });
  });

  describe('description', () => {
    it('passes at exact DESCRIPTION_MAX_CHARS limit', () => {
      const content = validContent();
      content.description = 'D'.repeat(AMAZON_EN_LIMITS.DESCRIPTION_MAX_CHARS);
      const result = validateListingContent(content);
      const violation = result.violations.find((v) => v.field === 'description');
      expect(violation).toBeUndefined();
    });

    it('fails when description exceeds DESCRIPTION_MAX_CHARS', () => {
      const content = validContent();
      content.description = 'D'.repeat(AMAZON_EN_LIMITS.DESCRIPTION_MAX_CHARS + 1);
      const result = validateListingContent(content);
      const violation = result.violations.find((v) => v.field === 'description');
      expect(violation).toBeDefined();
      expect(violation!.actual).toBe(AMAZON_EN_LIMITS.DESCRIPTION_MAX_CHARS + 1);
      expect(result.valid).toBe(false);
    });
  });

  describe('searchTerms', () => {
    it('passes when search terms are within byte limit', () => {
      const content = validContent();
      content.searchTerms = ['a', 'b', 'c'];
      const result = validateListingContent(content);
      const violation = result.violations.find((v) => v.field === 'searchTerms');
      expect(violation).toBeUndefined();
    });

    it('fails when combined search terms exceed SEARCH_TERMS_MAX_BYTES', () => {
      const content = validContent();
      content.searchTerms = ['a'.repeat(AMAZON_EN_LIMITS.SEARCH_TERMS_MAX_BYTES + 1)];
      const result = validateListingContent(content);
      const violation = result.violations.find((v) => v.field === 'searchTerms');
      expect(violation).toBeDefined();
      expect(violation!.limit).toBe(AMAZON_EN_LIMITS.SEARCH_TERMS_MAX_BYTES);
      expect(result.valid).toBe(false);
    });

    it('measures search terms as bytes not character count', () => {
      const content = validContent();
      // exactly at limit (249 bytes) → passes
      content.searchTerms = ['a'.repeat(AMAZON_EN_LIMITS.SEARCH_TERMS_MAX_BYTES)];
      const atLimit = validateListingContent(content);
      expect(atLimit.violations.find((v) => v.field === 'searchTerms')).toBeUndefined();

      // one byte over → fails
      content.searchTerms = ['a'.repeat(AMAZON_EN_LIMITS.SEARCH_TERMS_MAX_BYTES + 1)];
      const overLimit = validateListingContent(content);
      expect(overLimit.violations.find((v) => v.field === 'searchTerms')).toBeDefined();
    });
  });

  describe('aPlus (optional)', () => {
    it('passes when aPlus is absent', () => {
      const content = validContent();
      delete content.aPlus;
      const result = validateListingContent(content);
      const violation = result.violations.find((v) => v.field === 'aPlus');
      expect(violation).toBeUndefined();
    });

    it('passes when aPlus is within limit', () => {
      const content = validContent();
      content.aPlus = 'Short A+ content';
      const result = validateListingContent(content);
      const violation = result.violations.find((v) => v.field === 'aPlus');
      expect(violation).toBeUndefined();
    });

    it('fails when aPlus exceeds APLUS_MAX_CHARS', () => {
      const content = validContent();
      content.aPlus = 'X'.repeat(AMAZON_EN_LIMITS.APLUS_MAX_CHARS + 1);
      const result = validateListingContent(content);
      const violation = result.violations.find((v) => v.field === 'aPlus');
      expect(violation).toBeDefined();
      expect(violation!.actual).toBe(AMAZON_EN_LIMITS.APLUS_MAX_CHARS + 1);
      expect(result.valid).toBe(false);
    });
  });

  describe('multiple violations', () => {
    it('collects violations from multiple fields simultaneously', () => {
      const content: ListingContent = {
        title: 'T'.repeat(AMAZON_EN_LIMITS.TITLE_MAX_CHARS + 10),
        bullets: ['B'.repeat(AMAZON_EN_LIMITS.BULLET_MAX_CHARS + 10)],
        description: 'D'.repeat(AMAZON_EN_LIMITS.DESCRIPTION_MAX_CHARS + 10),
        searchTerms: ['a'.repeat(AMAZON_EN_LIMITS.SEARCH_TERMS_MAX_BYTES)],
        aPlus: 'A'.repeat(AMAZON_EN_LIMITS.APLUS_MAX_CHARS + 10),
      };
      const result = validateListingContent(content);
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(4);
    });
  });
});

// ─── Walmart EN rules ─────────────────────────────────────────────────────────

function validWalmartContent(): ListingContent {
  return {
    title: 'Homtone 6-Quart Programmable Slow Cooker with Digital Timer',
    bullets: Array.from({ length: 5 }, (_, i) => `Key Feature ${i + 1} — short text`),
    description: 'A high-quality slow cooker designed for everyday family meals.',
    searchTerms: ['slow cooker', 'crockpot', 'programmable'],
  };
}

describe('validateListingContent (Walmart EN rules)', () => {
  it('passes for a fully valid Walmart content object', () => {
    const result = validateListingContent(validWalmartContent(), walmartEnRules);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  describe('title', () => {
    it('passes at exact Walmart TITLE_MAX_CHARS (200)', () => {
      const content = validWalmartContent();
      content.title = 'A'.repeat(WALMART_EN_LIMITS.TITLE_MAX_CHARS);
      expect(validateListingContent(content, walmartEnRules).valid).toBe(true);
    });

    it('fails when title exceeds 200 characters', () => {
      const content = validWalmartContent();
      content.title = 'A'.repeat(WALMART_EN_LIMITS.TITLE_MAX_CHARS + 1);
      const result = validateListingContent(content, walmartEnRules);
      const v = result.violations.find((x) => x.field === 'title');
      expect(v).toBeDefined();
      expect(v!.actual).toBe(WALMART_EN_LIMITS.TITLE_MAX_CHARS + 1);
      expect(v!.limit).toBe(WALMART_EN_LIMITS.TITLE_MAX_CHARS);
    });
  });

  describe('Key Features (bullets)', () => {
    it('passes with exactly 10 key features', () => {
      const content = validWalmartContent();
      content.bullets = Array.from(
        { length: WALMART_EN_LIMITS.KEY_FEATURES_MAX_COUNT },
        (_, i) => `Feature ${i + 1}`,
      );
      const result = validateListingContent(content, walmartEnRules);
      expect(result.violations.find((v) => v.field === 'bullets')).toBeUndefined();
    });

    it('fails when key feature count exceeds 10', () => {
      const content = validWalmartContent();
      content.bullets = Array.from(
        { length: WALMART_EN_LIMITS.KEY_FEATURES_MAX_COUNT + 1 },
        (_, i) => `Feature ${i + 1}`,
      );
      const result = validateListingContent(content, walmartEnRules);
      const v = result.violations.find((x) => x.field === 'bullets');
      expect(v).toBeDefined();
      expect(result.valid).toBe(false);
    });

    it('passes when a single key feature is exactly 1000 characters', () => {
      const content = validWalmartContent();
      content.bullets = ['A'.repeat(WALMART_EN_LIMITS.KEY_FEATURE_MAX_CHARS)];
      const result = validateListingContent(content, walmartEnRules);
      expect(result.violations.find((v) => v.field === 'bullets[0]')).toBeUndefined();
    });

    it('fails when a key feature exceeds 1000 characters', () => {
      const content = validWalmartContent();
      content.bullets = ['A'.repeat(WALMART_EN_LIMITS.KEY_FEATURE_MAX_CHARS + 1)];
      const result = validateListingContent(content, walmartEnRules);
      const v = result.violations.find((x) => x.field === 'bullets[0]');
      expect(v).toBeDefined();
      expect(v!.actual).toBe(WALMART_EN_LIMITS.KEY_FEATURE_MAX_CHARS + 1);
      expect(v!.limit).toBe(WALMART_EN_LIMITS.KEY_FEATURE_MAX_CHARS);
    });
  });

  describe('Short Description', () => {
    it('passes at exact 4000 character limit', () => {
      const content = validWalmartContent();
      content.description = 'D'.repeat(WALMART_EN_LIMITS.SHORT_DESCRIPTION_MAX_CHARS);
      expect(validateListingContent(content, walmartEnRules).valid).toBe(true);
    });

    it('fails when short description exceeds 4000 characters', () => {
      const content = validWalmartContent();
      content.description = 'D'.repeat(WALMART_EN_LIMITS.SHORT_DESCRIPTION_MAX_CHARS + 1);
      const result = validateListingContent(content, walmartEnRules);
      const v = result.violations.find((x) => x.field === 'description');
      expect(v).toBeDefined();
      expect(v!.actual).toBe(WALMART_EN_LIMITS.SHORT_DESCRIPTION_MAX_CHARS + 1);
      expect(v!.limit).toBe(WALMART_EN_LIMITS.SHORT_DESCRIPTION_MAX_CHARS);
    });
  });

  describe('Search Keywords (character-based, not byte-based)', () => {
    it('passes when combined search keywords are within 1000 characters', () => {
      const content = validWalmartContent();
      content.searchTerms = ['a'.repeat(500)];
      expect(validateListingContent(content, walmartEnRules).valid).toBe(true);
    });

    it('passes at exactly 1000 characters', () => {
      const content = validWalmartContent();
      content.searchTerms = ['a'.repeat(WALMART_EN_LIMITS.SEARCH_KEYWORDS_MAX_CHARS)];
      expect(validateListingContent(content, walmartEnRules).valid).toBe(true);
    });

    it('fails when search keywords exceed 1000 characters', () => {
      const content = validWalmartContent();
      content.searchTerms = ['a'.repeat(WALMART_EN_LIMITS.SEARCH_KEYWORDS_MAX_CHARS + 1)];
      const result = validateListingContent(content, walmartEnRules);
      const v = result.violations.find((x) => x.field === 'searchTerms');
      expect(v).toBeDefined();
      expect(v!.limit).toBe(WALMART_EN_LIMITS.SEARCH_KEYWORDS_MAX_CHARS);
    });

    it('measures keywords in characters, not bytes', () => {
      // 1000 ASCII chars = 1000 bytes — at limit, should pass
      const content = validWalmartContent();
      content.searchTerms = ['a'.repeat(1000)];
      const atLimit = validateListingContent(content, walmartEnRules);
      expect(atLimit.violations.find((v) => v.field === 'searchTerms')).toBeUndefined();
    });
  });

  describe('aPlus (should be ignored for Walmart)', () => {
    it('does not report a violation when aPlus content is very long', () => {
      const content = validWalmartContent();
      content.aPlus = 'X'.repeat(10_000);
      const result = validateListingContent(content, walmartEnRules);
      expect(result.violations.find((v) => v.field === 'aPlus')).toBeUndefined();
    });
  });

  describe('multiple violations', () => {
    it('collects title + bullets count + description violations simultaneously', () => {
      const content: ListingContent = {
        title: 'T'.repeat(WALMART_EN_LIMITS.TITLE_MAX_CHARS + 10),
        bullets: Array.from(
          { length: WALMART_EN_LIMITS.KEY_FEATURES_MAX_COUNT + 1 },
          (_, i) => `F${i}`,
        ),
        description: 'D'.repeat(WALMART_EN_LIMITS.SHORT_DESCRIPTION_MAX_CHARS + 10),
        searchTerms: ['ok'],
      };
      const result = validateListingContent(content, walmartEnRules);
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(3);
    });
  });
});
