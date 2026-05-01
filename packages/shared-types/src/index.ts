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

// ─── Image Brief ─────────────────────────────────────────────────────────────

export type ImageBriefStatus = 'draft' | 'in_review' | 'approved' | 'delivered';

export type ImageAssetType = 'main' | 'secondary' | 'aplus' | 'infographic';

export interface ImageAssetSlot {
  type: ImageAssetType;
  /** Cloudinary Public ID for the delivered asset (empty until delivered) */
  cloudinaryPublicId?: string;
  /** Width in pixels */
  widthPx: number;
  /** Height in pixels */
  heightPx: number;
  /** Intended quantity */
  quantity: number;
  notes?: string;
}

export interface ImageBrief {
  /** Matches PostgreSQL Product.id */
  productId: string;
  brandId: BrandId;
  platform: Platform;
  /** Amazon ASIN or Walmart Item ID */
  platformListingId: string;
  status: ImageBriefStatus;
  operator: string;
  /** ISO date string YYYY-MM-DD */
  deadline?: string;
  assets: ImageAssetSlot[];
  /** Free-form selling points per secondary image (index-aligned) */
  secondaryImageCopy?: Array<{ headline: string; subtext?: string }>;
  /** Key product specs to display in infographic */
  specs?: Record<string, string>;
  createdAt: string;
  updatedAt?: string;
}
