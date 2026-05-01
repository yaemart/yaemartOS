import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PathAExtractService } from './path-a-extract.service';
import type { PathAExtractionModelOutputSchema } from './schema';

class TestablePathAExtractService extends PathAExtractService {
  constructor(
    config: ConfigService,
    private readonly response: PathAExtractionModelOutputSchema,
  ) {
    super(config);
  }

  protected async generateFromModel(_prompt: string) {
    return this.response;
  }
}

function createInput() {
  return {
    runId: 'run-001',
    sourceRecordId: 'lx-123',
    rawListing: {
      seller_sku: 'HT-SC-001',
      listing_title: 'Homtone Slow Cooker',
      marketplace_id: 'ATVPDKIKX0DER',
      brand_name: 'Homtone',
    },
  };
}

describe('PathAExtractService', () => {
  it('returns merged extraction result with run metadata', async () => {
    const config = {
      get: vi.fn(),
    } as unknown as ConfigService;

    const service = new TestablePathAExtractService(config, {
      sku: 'HT-SC-001',
      asin: 'B09XYZ1234',
      title: 'Homtone Slow Cooker',
      bulletPoints: ['Large Capacity'],
      description: 'desc',
      searchTerms: ['slow cooker'],
      marketplaceId: 'ATVPDKIKX0DER',
      lingxingShopId: 'shop-1',
      brandName: 'Homtone',
      categoryName: 'Kitchen',
      lingxingUpdatedAt: '2026-05-01T10:00:00Z',
    });

    const result = await service.extract(createInput());
    expect(result.runId).toBe('run-001');
    expect(result.sourceRecordId).toBe('lx-123');
    expect(result.sku).toBe('HT-SC-001');
  });

  it('throws when model output fails schema validation', async () => {
    const config = {
      get: vi.fn(),
    } as unknown as ConfigService;

    const service = new TestablePathAExtractService(config, {
      sku: '',
      asin: null,
      title: '',
      bulletPoints: [],
      description: '',
      searchTerms: [],
      marketplaceId: 'ATVPDKIKX0DER',
      lingxingShopId: null,
      brandName: 'Homtone',
      categoryName: null,
      lingxingUpdatedAt: null,
    });

    await expect(service.extract(createInput())).rejects.toThrow();
  });
});
