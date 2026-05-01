import type { ListingContent } from '@yaemartos/shared-types';
import { AMAZON_EN_LIMITS } from './amazon-en-limits';

export interface ListingViolation {
  field: string;
  message: string;
  actual: number;
  limit: number;
}

export interface ValidationResult {
  valid: boolean;
  violations: ListingViolation[];
}

/**
 * Validates a ListingContent object against Amazon EN character limits.
 * Returns structured violations so callers can surface specific field errors.
 */
export function validateListingContent(content: ListingContent): ValidationResult {
  const violations: ListingViolation[] = [];

  if (content.title.length > AMAZON_EN_LIMITS.TITLE_MAX_CHARS) {
    violations.push({
      field: 'title',
      message: `Title exceeds ${AMAZON_EN_LIMITS.TITLE_MAX_CHARS} characters`,
      actual: content.title.length,
      limit: AMAZON_EN_LIMITS.TITLE_MAX_CHARS,
    });
  }

  if (content.bullets.length > AMAZON_EN_LIMITS.BULLETS_MAX_COUNT) {
    violations.push({
      field: 'bullets',
      message: `Too many bullet points: ${content.bullets.length} > ${AMAZON_EN_LIMITS.BULLETS_MAX_COUNT}`,
      actual: content.bullets.length,
      limit: AMAZON_EN_LIMITS.BULLETS_MAX_COUNT,
    });
  }

  content.bullets.forEach((bullet, i) => {
    if (bullet.length > AMAZON_EN_LIMITS.BULLET_MAX_CHARS) {
      violations.push({
        field: `bullets[${i}]`,
        message: `Bullet ${i + 1} exceeds ${AMAZON_EN_LIMITS.BULLET_MAX_CHARS} characters`,
        actual: bullet.length,
        limit: AMAZON_EN_LIMITS.BULLET_MAX_CHARS,
      });
    }
  });

  if (content.description.length > AMAZON_EN_LIMITS.DESCRIPTION_MAX_CHARS) {
    violations.push({
      field: 'description',
      message: `Description exceeds ${AMAZON_EN_LIMITS.DESCRIPTION_MAX_CHARS} characters`,
      actual: content.description.length,
      limit: AMAZON_EN_LIMITS.DESCRIPTION_MAX_CHARS,
    });
  }

  const searchTermsBytes = Buffer.byteLength(content.searchTerms.join(' '), 'utf8');
  if (searchTermsBytes > AMAZON_EN_LIMITS.SEARCH_TERMS_MAX_BYTES) {
    violations.push({
      field: 'searchTerms',
      message: `Search terms exceed ${AMAZON_EN_LIMITS.SEARCH_TERMS_MAX_BYTES} bytes`,
      actual: searchTermsBytes,
      limit: AMAZON_EN_LIMITS.SEARCH_TERMS_MAX_BYTES,
    });
  }

  if (content.aPlus !== undefined && content.aPlus.length > AMAZON_EN_LIMITS.APLUS_MAX_CHARS) {
    violations.push({
      field: 'aPlus',
      message: `A+ content exceeds ${AMAZON_EN_LIMITS.APLUS_MAX_CHARS} characters`,
      actual: content.aPlus.length,
      limit: AMAZON_EN_LIMITS.APLUS_MAX_CHARS,
    });
  }

  return { valid: violations.length === 0, violations };
}
