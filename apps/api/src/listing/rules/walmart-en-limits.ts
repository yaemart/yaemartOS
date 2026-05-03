import type { PlatformListingRules } from './platform-listing-rules.interface';

/**
 * Walmart EN (US) listing field character / count limits.
 * Source: Walmart Seller Center Content Guidelines (2024).
 *
 * Key differences from Amazon EN:
 *  - Bullets are called "Key Features" (up to 10, 1 000 chars each)
 *  - Description is called "Short Description" (4 000 chars)
 *  - Search keywords are measured in characters, not bytes (1 000 chars)
 *  - There is no A+ / Rich Media equivalent in the standard content API
 */
export const WALMART_EN_LIMITS = {
  /** Max characters for the product title */
  TITLE_MAX_CHARS: 200,

  /** Max number of key-feature bullet points */
  KEY_FEATURES_MAX_COUNT: 10,

  /** Max characters per key-feature bullet point */
  KEY_FEATURE_MAX_CHARS: 1000,

  /** Max characters for the short description */
  SHORT_DESCRIPTION_MAX_CHARS: 4000,

  /**
   * Max characters for the combined search-keywords field.
   * Walmart measures keywords in characters (not bytes).
   */
  SEARCH_KEYWORDS_MAX_CHARS: 1000,
} as const;

/**
 * Walmart EN rules object that satisfies PlatformListingRules.
 * Pass this to `validateListingContent`, `buildListingSchema`, and prompt
 * assemblers to get Walmart-specific behaviour.
 */
export const walmartEnRules: PlatformListingRules = {
  platformCode: 'walmart',
  titleMaxChars: WALMART_EN_LIMITS.TITLE_MAX_CHARS,
  bulletsMaxCount: WALMART_EN_LIMITS.KEY_FEATURES_MAX_COUNT,
  bulletMaxChars: WALMART_EN_LIMITS.KEY_FEATURE_MAX_CHARS,
  descriptionMaxChars: WALMART_EN_LIMITS.SHORT_DESCRIPTION_MAX_CHARS,
  searchTermsMaxChars: WALMART_EN_LIMITS.SEARCH_KEYWORDS_MAX_CHARS,
  bulletFieldLabel: 'Key Features',
  descriptionFieldLabel: 'Short Description',
  searchTermsFieldLabel: 'Search Keywords',
};
