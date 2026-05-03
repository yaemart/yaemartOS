import type { GenerateListingInput } from '@yaemartos/shared-types';
import { AMAZON_EN_LIMITS } from '../rules/amazon-en-limits';
import { getLocaleGuidelines, isNonEnglishLocale } from './locale-writing-guidelines';
import { getBrandVoiceSection } from './brand-voice';

/**
 * Assembles the user-turn prompt for Amazon listing generation.
 * Supports EN/ES/FR/DE/IT via direct writing strategy — the model writes
 * in the target language directly rather than generating EN and translating.
 *
 * Accepts an optional `terminology` array injected into the Brand Voice section
 * to ensure brand-specific vocabulary consistency across languages.
 */

export interface TermEntry {
  term: string;
  definition: string;
}

export function assembleAmazonEnPrompt(
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
      ? `\n# Workspace Context (existing draft titles for this listing — avoid overlap or contradiction)\n${existingDrafts
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
    ? `You are an expert Amazon copywriter for the brand "${input.brandId}" (platform: ${input.platform}).\nWrite a complete Amazon ${langName} product listing in valid JSON matching the provided schema.\nWrite ALL content directly in ${langName}. Do NOT translate from English.`
    : `You are an expert Amazon copywriter for the brand "${input.brandId}" (platform: ${input.platform}).\nWrite a complete Amazon EN product listing in valid JSON matching the provided schema.`;

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

# Amazon Constraints (MUST NOT violate)
- title: max ${AMAZON_EN_LIMITS.TITLE_MAX_CHARS} characters
- bullets: exactly 5 bullet points, each max ${AMAZON_EN_LIMITS.BULLET_MAX_CHARS} characters
- description: max ${AMAZON_EN_LIMITS.DESCRIPTION_MAX_CHARS} characters
- searchTerms: space-separated single words or short phrases, combined max ${AMAZON_EN_LIMITS.SEARCH_TERMS_MAX_BYTES} bytes; no commas, no brand name
- aPlus: optional A+ content in plain text, max ${AMAZON_EN_LIMITS.APLUS_MAX_CHARS} characters

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
