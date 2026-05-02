import type { GenerateListingInput } from '@yaemartos/shared-types';
import { WALMART_EN_LIMITS } from '../rules/walmart-en-limits';

/**
 * Assembles the user-turn prompt for Walmart EN listing generation.
 * Mirrors the structure of assembleAmazonEnPrompt but uses Walmart
 * terminology (Key Features, Short Description, Search Keywords) and
 * Walmart-specific character constraints.
 */
export function assembleWalmartEnPrompt(input: GenerateListingInput): string {
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

  return `You are an expert Walmart Marketplace copywriter for the brand "${input.brandId}" (platform: walmart).
Write a complete Walmart EN product listing in valid JSON matching the provided schema.

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

# Walmart EN Constraints (MUST NOT violate)
- title: max ${WALMART_EN_LIMITS.TITLE_MAX_CHARS} characters
- bullets (Key Features): 3–${WALMART_EN_LIMITS.KEY_FEATURES_MAX_COUNT} bullet points, each max ${WALMART_EN_LIMITS.KEY_FEATURE_MAX_CHARS} characters
- description (Short Description): max ${WALMART_EN_LIMITS.SHORT_DESCRIPTION_MAX_CHARS} characters (plain text paragraph, no HTML)
- searchTerms (Search Keywords): space-separated keywords, combined max ${WALMART_EN_LIMITS.SEARCH_KEYWORDS_MAX_CHARS} characters total

# Writing Guidelines
- Title: start with brand name + primary keyword; keep under 75 characters for best display (hard max 200)
- Key Features: each starts with an active verb (e.g. "Holds up to…", "Designed for…", "Compatible with…")
- Short Description: concise paragraph highlighting top 2-3 benefits; no bullet formatting, no HTML tags
- Search Keywords: space-separated single words or short phrases; no brand name; no commas in output array elements
- Do NOT include any markdown formatting in the JSON string values`;
}
