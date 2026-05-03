/**
 * Unified description of listing field rules for a given platform.
 *
 * Each platform (Amazon, Walmart, …) exports a const that satisfies this
 * interface. The validator, prompt assembler, and generation service all
 * accept a `PlatformListingRules` value so they stay platform-agnostic.
 */
export interface PlatformListingRules {
  /** Canonical platform code matching the Platform type in shared-types */
  platformCode: 'amazon' | 'walmart';

  /** Maximum characters for the product title */
  titleMaxChars: number;

  /** Maximum number of bullet / key-feature points */
  bulletsMaxCount: number;

  /** Maximum characters per bullet / key-feature point */
  bulletMaxChars: number;

  /** Maximum characters for the product description / short description */
  descriptionMaxChars: number;

  /**
   * Maximum bytes for the combined search-terms field.
   * Used by Amazon (249 bytes). Mutually exclusive with searchTermsMaxChars.
   */
  searchTermsMaxBytes?: number;

  /**
   * Maximum characters for the combined search-keywords field.
   * Used by Walmart (1000 chars). Mutually exclusive with searchTermsMaxBytes.
   */
  searchTermsMaxChars?: number;

  /** Maximum characters for A+ / EBC content. Absent if the platform has no A+. */
  aPlusMaxChars?: number;

  /**
   * Optional list of prohibited words. Validation of this list is deferred;
   * the field is reserved so rule objects can carry the data when available.
   */
  prohibitedWords?: string[];

  // ── UI / prompt labels ─────────────────────────────────────────────────────

  /** Human-readable label for the bullets field (e.g. 'Bullet Points', 'Key Features') */
  bulletFieldLabel: string;

  /** Human-readable label for the description field (e.g. 'Description', 'Short Description') */
  descriptionFieldLabel: string;

  /** Human-readable label for the search-terms field (e.g. 'Search Terms', 'Search Keywords') */
  searchTermsFieldLabel: string;
}
