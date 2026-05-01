import type { GenerateListingInput } from '@yaemartos/shared-types';
import { AMAZON_EN_LIMITS } from '../rules/amazon-en-limits';

/**
 * Assembles the user-turn prompt for Amazon EN listing generation.
 * Merges all four input channels into a single context block.
 *
 * Keeps system guidance inline for S1 (no external .md file yet).
 * Prompt files will be extracted to packages/ai-services/src/prompts in S2+.
 */
export function assembleAmazonEnPrompt(input: GenerateListingInput): string {
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
- searchTerms: comma-separated backend keywords, combined max ${AMAZON_EN_LIMITS.SEARCH_TERMS_MAX_BYTES} bytes
- aPlus: optional A+ content in plain text, max ${AMAZON_EN_LIMITS.APLUS_MAX_CHARS} characters

# Writing Guidelines
- Lead the title with the brand name + primary keyword + key differentiator
- Each bullet starts with a capitalized feature name followed by an em-dash
- Description must be a coherent paragraph (no bullet formatting)
- searchTerms: space-separated single words or short phrases (no commas in output array elements, no brand name)
- Do NOT include any markdown formatting in the JSON string values`;
}
