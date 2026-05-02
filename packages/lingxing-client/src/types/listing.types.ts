export interface LingxingListingRaw {
  asin: string;
  seller_sku: string;
  marketplace_id: string;
  shop_id?: string;
  title?: string;
  bullet_points?: string[];
  description?: string;
  search_terms?: string[];
  main_image_url?: string;
  other_images?: string[];
  a_plus_content?: unknown;
  listing_status?: string;
  price?: string;
  fulfillment_channel?: string;
  open_date?: string;
  last_updated_time?: string;
}

export interface LingxingWalmartListingRaw {
  item_id: string;
  seller_sku: string;
  shop_id?: string;
  product_name?: string;
  key_features?: string[];
  short_description?: string;
  search_keywords?: string[];
  main_image_url?: string;
  listing_status?: string;
  price?: string;
  publish_status?: string;
  last_updated_time?: string;
}

export interface ListingFetchResult<T> {
  records: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface MappedListing {
  platformListingId: string;
  sku: string;
  marketplaceId: string;
  lingxingShopId?: string;
  title?: string;
  bulletPoints: string[];
  description?: string;
  searchTerms: string[];
  mainImageUrl?: string;
  otherImages: string[];
  aPlusContent?: unknown;
  status: string;
  price?: number;
  fulfillmentChannel?: string;
  platformCreatedAt?: Date;
  lingxingSyncedAt?: Date;
}
