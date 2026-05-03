import type { GenerateListingInput } from '@yaemartos/shared-types';
import { AMAZON_EN_LIMITS } from '../rules/amazon-en-limits';
import { getLocaleGuidelines, isNonEnglishLocale } from './locale-writing-guidelines';

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

/**
 * Per-brand voice & tone guidelines injected into the prompt.
 * Static for S1/S2; will be sourced from DB (SystemConfig/BrandGuidelineService) in S3+.
 */
const BRAND_VOICE: Record<string, string> = {
  homtone:
    'Brand voice: warm, approachable, and trustworthy. Write in a friendly, confident tone. ' +
    'Emphasize ease of use, family-friendly design, and reliable performance. Avoid technical jargon.',
  spoonlemon:
    'Brand voice: playful, cheerful, and practical. Write with a light, upbeat tone. ' +
    'Emphasize everyday convenience, clever design, and value for money. Use simple, vivid language.',
  davivy:
    'Brand voice: sophisticated, aspirational, and quality-focused. Write with a refined, confident tone. ' +
    'Emphasize premium materials, craftsmanship, and lifestyle elevation. Avoid casual phrasing.',
  tysun:
    'Brand voice: energetic, adventurous, and performance-driven. Write with an active, bold tone. ' +
    'Emphasize durability, outdoor performance, and an active lifestyle. Use action-oriented language.',
};

export function assembleAmazonEnPrompt(
  input: GenerateListingInput,
  terminology?: TermEntry[],
): string {
  const locale = (input.targetLocale as string) || 'en';
  const langName = localeDisplayName(locale);
  const isNonEn = isNonEnglishLocale(locale as any);

  const voiceGuide = BRAND_VOICE[input.brandId?.toLowerCase() ?? ''];
  const brandVoiceSection = voiceGuide
    ? `Brand Voice Guide:\n${voiceGuide}`
    : `Brand: ${input.brandId} (no specific voice guide; write in a professional, benefit-focused tone).`;

  const terminologySection =
    terminology && terminology.length > 0
      ? `\nBrand Terminology (use these terms accurately in the target language):\n${terminology.map((t) => `  - ${t.term}: ${t.definition}`).join('\n')}`
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

# ${brandVoiceSection}${terminologySection}

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
