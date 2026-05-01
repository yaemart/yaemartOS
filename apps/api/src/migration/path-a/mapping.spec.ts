import { describe, expect, it } from 'vitest';
import { mapLingxingPathAExtraction, PATH_A_DEFAULT_BRAND_NAME } from './mapping';

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
