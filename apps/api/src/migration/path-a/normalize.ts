import type { PathAExtractionResult, PathANormalizeContext, PathANormalizedRecord } from './types';
import { shouldMarkNeedsManualReview } from './conflict-rules';

export function normalizePathARecord(
  record: PathAExtractionResult,
  ctx: PathANormalizeContext,
): PathANormalizedRecord {
  const needsManualReview = shouldMarkNeedsManualReview(record);

  return {
    runId: record.runId,
    sourceRecordId: record.sourceRecordId,
    brandId: ctx.brandId,
    marketCode: ctx.marketCode,
    platformCode: ctx.platformCode,
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
    dedupeKey: `${ctx.brandId}:${ctx.platformCode}:${record.sku.trim()}`,
    lingxingUpdatedAt: record.lingxingUpdatedAt,
  };
}
