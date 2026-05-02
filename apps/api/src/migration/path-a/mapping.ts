import type { LingxingWalmartListingRaw } from '@yaemartos/lingxing-client';
import { pathAExtractionInputSchema, pathAExtractionResultSchema } from './schema';
import type { PathAExtractionInput, PathAExtractionResult } from './types';

export const PATH_A_DEFAULT_MARKETPLACE_ID = 'ATVPDKIKX0DER';
export const PATH_A_DEFAULT_WALMART_MARKETPLACE_ID = 'WALMART_US';
export const PATH_A_DEFAULT_BRAND_NAME = 'Homtone';

export const LINGXING_PATH_A_FIELD_MAP = {
  sku: 'seller_sku',
  asin: 'asin',
  title: 'listing_title',
  bulletPoints: 'bullet_points',
  description: 'description',
  searchTerms: 'search_terms',
  marketplaceId: 'marketplace_id',
  lingxingShopId: 'shop_id',
  brandName: 'brand_name',
  categoryName: 'category_name',
  lingxingUpdatedAt: 'updated_at',
} as const;

function normalizeTextArray(value?: string | string[]): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  return value
    .split(/[\n;|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNullable(value?: string): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function mapLingxingPathAExtraction(input: PathAExtractionInput): PathAExtractionResult {
  const parsedInput = pathAExtractionInputSchema.parse(input);
  const raw = parsedInput.rawListing;

  const result: PathAExtractionResult = {
    runId: parsedInput.runId,
    sourceRecordId: parsedInput.sourceRecordId,
    sku: raw.seller_sku.trim(),
    asin: toNullable(raw.asin),
    title: raw.listing_title?.trim() ?? raw.seller_sku.trim(),
    bulletPoints: normalizeTextArray(raw.bullet_points),
    description: raw.description?.trim() ?? '',
    searchTerms: normalizeTextArray(raw.search_terms),
    marketplaceId: raw.marketplace_id?.trim() ?? PATH_A_DEFAULT_MARKETPLACE_ID,
    lingxingShopId: toNullable(raw.shop_id),
    brandName: raw.brand_name?.trim() ?? PATH_A_DEFAULT_BRAND_NAME,
    categoryName: toNullable(raw.category_name),
    lingxingUpdatedAt: toNullable(raw.updated_at),
  };

  return pathAExtractionResultSchema.parse(result);
}

export function mapLingxingWalmartExtraction(
  runId: string,
  sourceRecordId: string,
  raw: LingxingWalmartListingRaw,
  brandName = PATH_A_DEFAULT_BRAND_NAME,
): PathAExtractionResult {
  const result: PathAExtractionResult = {
    runId,
    sourceRecordId,
    sku: raw.seller_sku.trim(),
    asin: raw.item_id?.trim() ?? null,
    title: raw.product_name?.trim() ?? raw.seller_sku.trim(),
    bulletPoints: normalizeTextArray(raw.key_features),
    description: raw.short_description?.trim() ?? '',
    searchTerms: normalizeTextArray(raw.search_keywords),
    marketplaceId: PATH_A_DEFAULT_WALMART_MARKETPLACE_ID,
    lingxingShopId: toNullable(raw.shop_id),
    brandName: brandName.trim(),
    categoryName: null,
    lingxingUpdatedAt: toNullable(raw.last_updated_time),
  };

  return pathAExtractionResultSchema.parse(result);
}
