/**
 * Amazon EN (US/CA) listing field character / count limits.
 * Source: Amazon Seller Central style guide (2024).
 *
 * All byte limits are measured as UTF-8 bytes (relevant for search terms).
 * All character limits are measured as Unicode code points (consistent with
 * String.prototype.length for BMP characters, which covers all ASCII).
 */
export const AMAZON_EN_LIMITS = {
  /** Max characters for the product title */
  TITLE_MAX_CHARS: 200,

  /** Max number of bullet points */
  BULLETS_MAX_COUNT: 5,

  /** Max characters per bullet point */
  BULLET_MAX_CHARS: 500,

  /** Max characters for the product description */
  DESCRIPTION_MAX_CHARS: 2000,

  /**
   * Max bytes for backend search terms (the combined "Search Terms" field).
   * Amazon enforces 249 bytes (not characters) to account for multi-byte
   * characters in international SKUs; we keep the same limit for EN.
   */
  SEARCH_TERMS_MAX_BYTES: 249,

  /** Max characters for A+ / EBC content (plain-text representation) */
  APLUS_MAX_CHARS: 5000,
} as const;

export type AmazonEnField = keyof typeof AMAZON_EN_LIMITS;
