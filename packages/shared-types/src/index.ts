export type BrandId = 'homtone' | 'spoonlemon' | 'davivy' | 'tysun';

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'it';

export type Platform = 'amazon' | 'walmart' | 'shopify' | 'tiktok';

export type ListingStatus = 'draft' | 'review' | 'approved' | 'published' | 'paused' | 'archived';

export type ListingVersionStatus = 'draft' | 'active' | 'archived';

export type TrafficStrategy =
  | 'primary'
  | 'variant'
  | 'bundle'
  | 'keyword_grab'
  | 'seasonal'
  | 'cohort_test';

export type ProductContentSource = 'manual' | 'category_inherit' | 'ai_generated' | 'erp_import';

export type ProductContentStatus = 'draft' | 'review' | 'approved' | 'active' | 'archived';

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface GenerateListingInput {
  brandId: BrandId;
  platform: Platform;
  productTitle: string;
  productCategory: string;
  targetLocale: Locale;
  keywords?: string[];
  /** Competitor product URLs for reference (optional, for prompt enrichment) */
  competitorUrls?: string[];
  /** Manually written selling points from the operator */
  manualSellingPoints?: string;
  /** Category lexicon / keyword terms from the category template */
  categoryLexicon?: string[];
  /** Keyword seeds pulled from Lingxing MCP (readonly, shop-scoped) */
  lingxingKeywordSeed?: string[];
  /** Brand terminology entries to inject into the prompt for vocabulary consistency */
  terminology?: { term: string; definition: string }[];
}

export interface ListingContent {
  title: string;
  bullets: string[];
  description: string;
  /** A+ content / enhanced brand content (markdown or plain text) */
  aPlus?: string;
  /** Backend search terms (Amazon: comma-separated, ≤ 249 bytes) */
  searchTerms: string[];
}

export type { ImageBrief, ImageBriefStatus, ImageAssetType, ImageAssetSpec } from './image-brief';
export { AMAZON_EN_ASSET_SPECS } from './image-brief';
