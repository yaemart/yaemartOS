import type { GenerateListingInput } from '@yaemartos/shared-types';
import { AMAZON_EN_LIMITS } from '../rules/amazon-en-limits';

/**
 * Assembles the user-turn prompt for Amazon EN listing generation.
 * Merges all four input channels into a single context block.
 *
 * Keeps system guidance inline for S1 (no external .md file yet).
 * Prompt files will be extracted to packages/ai-services/src/prompts in S2+.
 * Brand voice guidelines will be moved to SystemConfig (DB) in S2+.
 */

/**
 * Per-brand voice & tone guidelines injected into the prompt.
 * Static for S1; will be sourced from DB (SystemConfig/BrandGuidelineService) in S2+.
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

export function assembleAmazonEnPrompt(input: GenerateListingInput): string {
  const voiceGuide = BRAND_VOICE[input.brandId?.toLowerCase() ?? ''];
  const brandVoiceSection = voiceGuide
    ? `Brand Voice Guide:\n${voiceGuide}`
    : `Brand: ${input.brandId} (no specific voice guide; write in a professional, benefit-focused tone).`;

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

  return `You are an expert Amazon copywriter for the brand "${input.brandId}" (platform: ${input.platform}).
Write a complete Amazon EN product listing in valid JSON matching the provided schema.

# ${brandVoiceSection}

# Product Information
- Product title: ${input.productTitle}
- Category: ${input.productCategory}
- Brand: ${input.brandId}
- Locale: ${input.targetLocale}

# Input Channels
${competitorSection}

${sellingPointsSection}

${lexiconSection}

${keywordSection}

# Amazon EN Constraints (MUST NOT violate)
- title: max ${AMAZON_EN_LIMITS.TITLE_MAX_CHARS} characters
- bullets: exactly 5 bullet points, each max ${AMAZON_EN_LIMITS.BULLET_MAX_CHARS} characters
- description: max ${AMAZON_EN_LIMITS.DESCRIPTION_MAX_CHARS} characters
- searchTerms: space-separated single words or short phrases, combined max ${AMAZON_EN_LIMITS.SEARCH_TERMS_MAX_BYTES} bytes; no commas, no brand name
- aPlus: optional A+ content in plain text, max ${AMAZON_EN_LIMITS.APLUS_MAX_CHARS} characters

# Writing Guidelines
- Lead the title with the brand name + primary keyword + key differentiator
- Each bullet starts with a capitalized feature name followed by an em-dash
- Description must be a coherent paragraph (no bullet formatting)
- Do NOT include any markdown formatting in the JSON string values`;
}
