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
}

export interface ListingContent {
  title: string;
  bullets: string[];
  description: string;
  searchTerms: string[];
}
