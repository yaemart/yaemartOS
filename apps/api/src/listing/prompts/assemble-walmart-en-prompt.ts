import type { GenerateListingInput } from '@yaemartos/shared-types';
import { WALMART_EN_LIMITS } from '../rules/walmart-en-limits';
import { getLocaleGuidelines, isNonEnglishLocale } from './locale-writing-guidelines';
import type { TermEntry } from './assemble-listing-prompt';
import { getBrandVoiceSection } from './brand-voice';

/**
 * Assembles the user-turn prompt for Walmart listing generation.
 * Supports EN/ES/FR/DE/IT via direct writing strategy — the model writes
 * in the target language without translation from English.
 *
 * Accepts an optional `terminology` array for brand vocabulary consistency.
 */

export function assembleWalmartEnPrompt(
  input: GenerateListingInput,
  terminology?: TermEntry[],
): string {
  const locale = (input.targetLocale as string) || 'en';
  const langName = localeDisplayName(locale);
  const isNonEn = isNonEnglishLocale(locale as any);

  const brandVoiceSection = getBrandVoiceSection(input.brandId);

  const terminologySection =
    terminology && terminology.length > 0
      ? `\nBrand Terminology (use these terms accurately in the target language):\n${terminology.map((t) => `  - ${t.term}: ${t.definition}`).join('\n')}`
      : '';

  const existingDrafts = input.existingDraftTitles ?? [];
  const workspaceSection =
    existingDrafts.length > 0
      ? `\n# Workspace Context (existing draft titles — avoid overlap or contradiction)\n${existingDrafts
          .slice(0, 5)
          .map((t, i) => `  Draft ${i + 1}: "${t}"`)
          .join('\n')}`
      : '';

  const competitorSection =
    input.competitorUrls && input.competitorUrls.length > 0
      ? `Competitor reference URLs (study style, do NOT copy text):\n${input.competitorUrls.map((u) => `  - ${u}`).join('\n')}`
      : 'No competitor URLs provided.';

  const sellingPointsSection = input.manualSellingPoints
    ? `Operator-provided selling points:\n${input.manualSellingPoints}`
    : 'No manual selling points provided.';

  const lexiconSection =
    input.categoryLexicon && input.categoryLexicon.length > 0
      ? `Category lexicon terms (use relevant ones naturally):\n  ${input.categoryLexicon.join(', ')}`
      : 'No category lexicon provided.';

  const keywordSection =
    (input.lingxingKeywordSeed ?? input.keywords ?? []).length > 0
      ? `Target keywords (weave naturally, do NOT keyword-stuff):\n  ${(input.lingxingKeywordSeed ?? input.keywords ?? []).join(', ')}`
      : 'No keyword seeds provided.';

  const systemLine = isNonEn
    ? `You are an expert Walmart Marketplace copywriter for the brand "${input.brandId}" (platform: walmart).\nWrite a complete Walmart ${langName} product listing in valid JSON matching the provided schema.\nWrite ALL content directly in ${langName}. Do NOT translate from English.`
    : `You are an expert Walmart Marketplace copywriter for the brand "${input.brandId}" (platform: walmart).\nWrite a complete Walmart EN product listing in valid JSON matching the provided schema.`;

  return `${systemLine}

# ${brandVoiceSection}${terminologySection}${workspaceSection}

# Product Information
- Product title: ${input.productTitle}
- Category: ${input.productCategory}
- Brand: ${input.brandId}
- Locale: ${locale}

# Input Channels
${competitorSection}

${sellingPointsSection}

${lexiconSection}

${keywordSection}

# Walmart Constraints (MUST NOT violate)
- title: max ${WALMART_EN_LIMITS.TITLE_MAX_CHARS} characters
- bullets (Key Features): 3–${WALMART_EN_LIMITS.KEY_FEATURES_MAX_COUNT} bullet points, each max ${WALMART_EN_LIMITS.KEY_FEATURE_MAX_CHARS} characters
- description (Short Description): max ${WALMART_EN_LIMITS.SHORT_DESCRIPTION_MAX_CHARS} characters (plain text paragraph, no HTML)
- searchTerms (Search Keywords): space-separated keywords, combined max ${WALMART_EN_LIMITS.SEARCH_KEYWORDS_MAX_CHARS} characters total

# Writing Guidelines
${getLocaleGuidelines(locale as any)}`;
}

function localeDisplayName(locale: string): string {
  const names: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
  };
  return names[locale] ?? 'English';
}
