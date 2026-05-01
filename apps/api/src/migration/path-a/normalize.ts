import type { PathAExtractionResult, PathANormalizedRecord } from './types';
import { shouldMarkNeedsManualReview } from './conflict-rules';

const PATH_A_BRAND_ID = 'homtone' as const;
const PATH_A_MARKET_CODE = 'US' as const;
const PATH_A_PLATFORM_CODE = 'amazon' as const;

export function normalizePathARecord(record: PathAExtractionResult): PathANormalizedRecord {
  const needsManualReview = shouldMarkNeedsManualReview(record);

  return {
    runId: record.runId,
    sourceRecordId: record.sourceRecordId,
    brandId: PATH_A_BRAND_ID,
    marketCode: PATH_A_MARKET_CODE,
    platformCode: PATH_A_PLATFORM_CODE,
    sku: record.sku.trim(),
    asin: record.asin,
    title: record.title.trim(),
    bulletPoints: record.bulletPoints.map((item) => item.trim()).filter(Boolean),
    description: record.description.trim(),
    searchTerms: record.searchTerms.map((item) => item.trim()).filter(Boolean),
    marketplaceId: record.marketplaceId,
    lingxingShopId: record.lingxingShopId,
    categoryName: record.categoryName,
    source: 'erp_import',
    needsManualReview,
    dedupeKey: `${PATH_A_BRAND_ID}:${record.sku.trim()}`,
    lingxingUpdatedAt: record.lingxingUpdatedAt,
  };
}
