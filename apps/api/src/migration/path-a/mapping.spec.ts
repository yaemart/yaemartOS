import { describe, expect, it } from 'vitest';
import {
  mapLingxingPathAExtraction,
  mapLingxingWalmartExtraction,
  PATH_A_DEFAULT_BRAND_NAME,
  PATH_A_DEFAULT_WALMART_MARKETPLACE_ID,
} from './mapping';

describe('mapLingxingPathAExtraction', () => {
  it('maps raw listing fields into normalized extraction result', () => {
    const result = mapLingxingPathAExtraction({
      runId: 'run-001',
      sourceRecordId: 'lx-123',
      rawListing: {
        seller_sku: ' HT-SC-001 ',
        asin: 'B09XYZ1234',
        listing_title: 'Homtone Slow Cooker',
        bullet_points: ['Large Capacity', 'Digital Timer'],
        description: 'A premium slow cooker.',
        search_terms: 'slow cooker;programmable',
        marketplace_id: 'ATVPDKIKX0DER',
        shop_id: 'shop-1',
        brand_name: 'Homtone',
        category_name: 'Kitchen > Slow Cooker',
        updated_at: '2026-05-01T08:00:00Z',
      },
    });

    expect(result).toMatchObject({
      runId: 'run-001',
      sourceRecordId: 'lx-123',
      sku: 'HT-SC-001',
      asin: 'B09XYZ1234',
      title: 'Homtone Slow Cooker',
      bulletPoints: ['Large Capacity', 'Digital Timer'],
      description: 'A premium slow cooker.',
      searchTerms: ['slow cooker', 'programmable'],
      marketplaceId: 'ATVPDKIKX0DER',
      lingxingShopId: 'shop-1',
      brandName: 'Homtone',
      categoryName: 'Kitchen > Slow Cooker',
      lingxingUpdatedAt: '2026-05-01T08:00:00Z',
    });
  });

  it('applies defaults and null normalization for optional fields', () => {
    const result = mapLingxingPathAExtraction({
      runId: 'run-002',
      sourceRecordId: 'lx-456',
      rawListing: {
        seller_sku: 'HT-SC-002',
      },
    });

    expect(result.asin).toBeNull();
    expect(result.title).toBe('HT-SC-002');
    expect(result.brandName).toBe(PATH_A_DEFAULT_BRAND_NAME);
    expect(result.bulletPoints).toEqual([]);
    expect(result.searchTerms).toEqual([]);
    expect(result.lingxingShopId).toBeNull();
  });

  it('throws on missing required seller_sku', () => {
    expect(() =>
      mapLingxingPathAExtraction({
        runId: 'run-003',
        sourceRecordId: 'lx-789',
        rawListing: {
          seller_sku: '',
        },
      }),
    ).toThrow();
  });
});

describe('mapLingxingWalmartExtraction', () => {
  it('maps Walmart listing raw fields into extraction result', () => {
    const result = mapLingxingWalmartExtraction('run-w1', 'lx-w1', {
      item_id: 'WMT-123456',
      seller_sku: 'SL-KT-001',
      shop_id: 'shop-wmt-1',
      product_name: 'Spoonlemon Kitchen Tool',
      key_features: ['BPA Free', 'Dishwasher Safe'],
      short_description: 'Great kitchen tool',
      search_keywords: ['kitchen', 'tool'],
      last_updated_time: '2026-05-01T12:00:00Z',
    });

    expect(result.sku).toBe('SL-KT-001');
    expect(result.asin).toBe('WMT-123456');
    expect(result.title).toBe('Spoonlemon Kitchen Tool');
    expect(result.bulletPoints).toEqual(['BPA Free', 'Dishwasher Safe']);
    expect(result.searchTerms).toEqual(['kitchen', 'tool']);
    expect(result.marketplaceId).toBe(PATH_A_DEFAULT_WALMART_MARKETPLACE_ID);
    expect(result.lingxingShopId).toBe('shop-wmt-1');
  });

  it('falls back to sku as title when product_name is missing', () => {
    const result = mapLingxingWalmartExtraction('run-w2', 'lx-w2', {
      item_id: 'WMT-999',
      seller_sku: 'SL-KT-002',
    });

    expect(result.title).toBe('SL-KT-002');
    expect(result.bulletPoints).toEqual([]);
    expect(result.description).toBe('');
  });
});
