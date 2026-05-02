import type { ListingContent } from '@yaemartos/shared-types';
import { amazonEnRules } from './amazon-en-limits';
import type { PlatformListingRules } from './platform-listing-rules.interface';

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
 * Validates a ListingContent object against the supplied platform rules.
 *
 * When `rules` is omitted, Amazon EN limits are used as the default, preserving
 * backward-compatible behaviour for all existing callers.
 *
 * Search-terms measurement:
 *  - If `rules.searchTermsMaxBytes` is set → bytes (Amazon behaviour)
 *  - If `rules.searchTermsMaxChars` is set → characters (Walmart behaviour)
 */
export function validateListingContent(
  content: ListingContent,
  rules: PlatformListingRules = amazonEnRules,
): ValidationResult {
  const violations: ListingViolation[] = [];

  // ── Title ──────────────────────────────────────────────────────────────────
  if (content.title.length > rules.titleMaxChars) {
    violations.push({
      field: 'title',
      message: `Title exceeds ${rules.titleMaxChars} characters`,
      actual: content.title.length,
      limit: rules.titleMaxChars,
    });
  }

  // ── Bullets / Key Features ─────────────────────────────────────────────────
  if (content.bullets.length > rules.bulletsMaxCount) {
    violations.push({
      field: 'bullets',
      message: `Too many ${rules.bulletFieldLabel}: ${content.bullets.length} > ${rules.bulletsMaxCount}`,
      actual: content.bullets.length,
      limit: rules.bulletsMaxCount,
    });
  }

  content.bullets.forEach((bullet, i) => {
    if (bullet.length > rules.bulletMaxChars) {
      violations.push({
        field: `bullets[${i}]`,
        message: `${rules.bulletFieldLabel} ${i + 1} exceeds ${rules.bulletMaxChars} characters`,
        actual: bullet.length,
        limit: rules.bulletMaxChars,
      });
    }
  });

  // ── Description / Short Description ───────────────────────────────────────
  if (content.description.length > rules.descriptionMaxChars) {
    violations.push({
      field: 'description',
      message: `${rules.descriptionFieldLabel} exceeds ${rules.descriptionMaxChars} characters`,
      actual: content.description.length,
      limit: rules.descriptionMaxChars,
    });
  }

  // ── Search Terms / Search Keywords ─────────────────────────────────────────
  if (rules.searchTermsMaxBytes !== undefined) {
    const bytes = Buffer.byteLength(content.searchTerms.join(' '), 'utf8');
    if (bytes > rules.searchTermsMaxBytes) {
      violations.push({
        field: 'searchTerms',
        message: `${rules.searchTermsFieldLabel} exceed ${rules.searchTermsMaxBytes} bytes`,
        actual: bytes,
        limit: rules.searchTermsMaxBytes,
      });
    }
  } else if (rules.searchTermsMaxChars !== undefined) {
    const chars = content.searchTerms.join(' ').length;
    if (chars > rules.searchTermsMaxChars) {
      violations.push({
        field: 'searchTerms',
        message: `${rules.searchTermsFieldLabel} exceed ${rules.searchTermsMaxChars} characters`,
        actual: chars,
        limit: rules.searchTermsMaxChars,
      });
    }
  }

  // ── A+ content (Amazon-only, optional) ────────────────────────────────────
  if (
    rules.aPlusMaxChars !== undefined &&
    content.aPlus !== undefined &&
    content.aPlus.length > rules.aPlusMaxChars
  ) {
    violations.push({
      field: 'aPlus',
      message: `A+ content exceeds ${rules.aPlusMaxChars} characters`,
      actual: content.aPlus.length,
      limit: rules.aPlusMaxChars,
    });
  }

  return { valid: violations.length === 0, violations };
}
