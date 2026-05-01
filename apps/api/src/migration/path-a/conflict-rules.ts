import type { PathAExtractionResult } from './types';

function toTimestamp(value: string | null): number {
  if (!value) {
    return 0;
  }
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
}

export function pickLatestBySku(records: PathAExtractionResult[]): PathAExtractionResult[] {
  const latestBySku = new Map<string, PathAExtractionResult>();
  for (const record of records) {
    const existing = latestBySku.get(record.sku);
    if (!existing) {
      latestBySku.set(record.sku, record);
      continue;
    }

    const currentTs = toTimestamp(record.lingxingUpdatedAt);
    const existingTs = toTimestamp(existing.lingxingUpdatedAt);
    if (currentTs >= existingTs) {
      latestBySku.set(record.sku, record);
    }
  }

  return [...latestBySku.values()];
}

export function shouldMarkNeedsManualReview(record: PathAExtractionResult): boolean {
  return record.title.trim().length === 0 || record.bulletPoints.length === 0;
}
