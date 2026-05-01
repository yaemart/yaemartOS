export interface LingxingPathARawListing {
  product_id?: string;
  seller_sku: string;
  asin?: string;
  listing_title?: string;
  bullet_points?: string[] | string;
  description?: string;
  search_terms?: string[] | string;
  marketplace_id?: string;
  shop_id?: string;
  brand_name?: string;
  category_name?: string;
  status?: string;
  updated_at?: string;
}

export interface PathAExtractionInput {
  runId: string;
  sourceRecordId: string;
  rawListing: LingxingPathARawListing;
}

export interface PathAExtractionResult {
  runId: string;
  sourceRecordId: string;
  sku: string;
  asin: string | null;
  title: string;
  bulletPoints: string[];
  description: string;
  searchTerms: string[];
  marketplaceId: string;
  lingxingShopId: string | null;
  brandName: string;
  categoryName: string | null;
  lingxingUpdatedAt: string | null;
}

export interface PathANormalizedRecord {
  runId: string;
  sourceRecordId: string;
  brandId: 'homtone';
  marketCode: 'US';
  platformCode: 'amazon';
  sku: string;
  asin: string | null;
  title: string;
  bulletPoints: string[];
  description: string;
  searchTerms: string[];
  marketplaceId: string;
  lingxingShopId: string | null;
  categoryName: string | null;
  source: 'erp_import';
  needsManualReview: boolean;
  dedupeKey: string;
  lingxingUpdatedAt: string | null;
}
