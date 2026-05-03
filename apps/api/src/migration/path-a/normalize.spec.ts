import { describe, expect, it } from 'vitest';
import { pickLatestBySku } from './conflict-rules';
import { normalizePathARecord } from './normalize';
import type { PathANormalizeContext } from './types';

const homtoneAmazonCtx: PathANormalizeContext = {
  brandId: 'homtone',
  marketCode: 'US',
  platformCode: 'amazon',
};

const spoonlemonWalmartCtx: PathANormalizeContext = {
  brandId: 'spoonlemon',
  marketCode: 'US',
  platformCode: 'walmart',
};

describe('normalizePathARecord', () => {
  it('normalizes extraction result into import record (Homtone × Amazon)', () => {
    const normalized = normalizePathARecord(
      {
        runId: 'run-001',
        sourceRecordId: 'lx-1',
        sku: 'HT-SC-001',
        asin: 'B09XYZ1234',
        title: 'Homtone Slow Cooker',
        bulletPoints: [' Large Capacity ', 'Easy Clean'],
        description: '  desc  ',
        searchTerms: [' slow cooker ', ' programmable '],
        marketplaceId: 'ATVPDKIKX0DER',
        lingxingShopId: 'shop-1',
        brandName: 'Homtone',
        categoryName: 'Kitchen',
        lingxingUpdatedAt: '2026-05-01T10:00:00Z',
      },
      homtoneAmazonCtx,
    );

    expect(normalized.brandId).toBe('homtone');
    expect(normalized.marketCode).toBe('US');
    expect(normalized.platformCode).toBe('amazon');
    expect(normalized.source).toBe('erp_import');
    expect(normalized.dedupeKey).toBe('homtone:amazon:HT-SC-001');
    expect(normalized.needsManualReview).toBe(false);
    expect(normalized.searchTerms).toEqual(['slow cooker', 'programmable']);
  });

  it('marks needsManualReview when bullets are empty', () => {
    const normalized = normalizePathARecord(
      {
        runId: 'run-002',
        sourceRecordId: 'lx-2',
        sku: 'HT-SC-002',
        asin: null,
        title: 'Title',
        bulletPoints: [],
        description: '',
        searchTerms: [],
        marketplaceId: 'ATVPDKIKX0DER',
        lingxingShopId: null,
        brandName: 'Homtone',
        categoryName: null,
        lingxingUpdatedAt: null,
      },
      homtoneAmazonCtx,
    );

    expect(normalized.needsManualReview).toBe(true);
  });

  it('normalizes Spoonlemon × Walmart record with correct dedupeKey', () => {
    const normalized = normalizePathARecord(
      {
        runId: 'run-003',
        sourceRecordId: 'lx-3',
        sku: 'SL-KT-001',
        asin: 'WMT-123456',
        title: 'Spoonlemon Kitchen Tool',
        bulletPoints: ['BPA Free', 'Dishwasher Safe'],
        description: 'Great kitchen tool',
        searchTerms: ['kitchen', 'tool'],
        marketplaceId: 'WALMART_US',
        lingxingShopId: 'shop-wmt-1',
        brandName: 'Spoonlemon',
        categoryName: 'Kitchen Tools',
        lingxingUpdatedAt: '2026-05-01T12:00:00Z',
      },
      spoonlemonWalmartCtx,
    );

    expect(normalized.brandId).toBe('spoonlemon');
    expect(normalized.platformCode).toBe('walmart');
    expect(normalized.dedupeKey).toBe('spoonlemon:walmart:SL-KT-001');
    expect(normalized.needsManualReview).toBe(false);
  });
});

describe('pickLatestBySku', () => {
  it('keeps the latest record for same sku by lingxingUpdatedAt', () => {
    const records = pickLatestBySku([
      {
        runId: 'run',
        sourceRecordId: '1',
        sku: 'HT-SC-001',
        asin: 'A1',
        title: 'old',
        bulletPoints: ['a'],
        description: '',
        searchTerms: [],
        marketplaceId: 'ATVPDKIKX0DER',
        lingxingShopId: null,
        brandName: 'Homtone',
        categoryName: null,
        lingxingUpdatedAt: '2026-05-01T10:00:00Z',
      },
      {
        runId: 'run',
        sourceRecordId: '2',
        sku: 'HT-SC-001',
        asin: 'A2',
        title: 'new',
        bulletPoints: ['b'],
        description: '',
        searchTerms: [],
        marketplaceId: 'ATVPDKIKX0DER',
        lingxingShopId: null,
        brandName: 'Homtone',
        categoryName: null,
        lingxingUpdatedAt: '2026-05-01T11:00:00Z',
      },
    ]);

    expect(records).toHaveLength(1);
    expect(records[0].sourceRecordId).toBe('2');
    expect(records[0].title).toBe('new');
  });
});
