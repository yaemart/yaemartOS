import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ListingsOperations } from '../src/operations/listings';
import { LingxingError } from '../src/errors/lingxing-error';
import { LingxingErrorCode } from '../src/errors/error-codes';
import listingResponse from './fixtures/listing-response.json';

function createMockTransport() {
  return {
    request: vi.fn(),
  } as any;
}

function createMockRateLimiter() {
  return {
    acquire: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockRedis() {
  return {
    eval: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
  } as any;
}

describe('ListingsOperations', () => {
  let transport: ReturnType<typeof createMockTransport>;
  let rateLimiter: ReturnType<typeof createMockRateLimiter>;
  let redis: ReturnType<typeof createMockRedis>;
  let listings: ListingsOperations;

  beforeEach(() => {
    vi.restoreAllMocks();
    transport = createMockTransport();
    rateLimiter = createMockRateLimiter();
    redis = createMockRedis();
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    listings = new ListingsOperations(transport, rateLimiter, redis, 'test:cache');
  });

  it('getByAsin returns correctly mapped listing data', async () => {
    transport.request.mockResolvedValue(listingResponse);

    const result = await listings.getByAsin('B09XYZ1234');

    expect(result).not.toBeNull();
    expect(result!.platformListingId).toBe('B09XYZ1234');
    expect(result!.sku).toBe('HT-SC-001');
    expect(result!.marketplaceId).toBe('ATVPDKIKX0DER');
    expect(result!.title).toBe('Homtone 6-Quart Slow Cooker');
    expect(result!.bulletPoints).toEqual(['Easy to use', 'Programmable timer', 'Large capacity']);
    expect(result!.description).toBe('A premium slow cooker for your kitchen.');
    expect(result!.searchTerms).toEqual(['slow cooker', 'programmable', '6 quart']);
    expect(result!.mainImageUrl).toBe('https://images.example.com/main.jpg');
    expect(result!.otherImages).toEqual(['https://images.example.com/side.jpg']);
    expect(result!.status).toBe('active');
    expect(result!.price).toBe(49.99);
    expect(result!.fulfillmentChannel).toBe('FBA');
    expect(result!.platformCreatedAt).toEqual(new Date('2025-06-15T00:00:00Z'));
    expect(result!.lingxingSyncedAt).toEqual(new Date('2026-04-28T10:30:00Z'));
  });

  it('returns cached value without calling transport on cache hit', async () => {
    const cachedListing = {
      platformListingId: 'B09XYZ1234',
      sku: 'HT-SC-001',
      marketplaceId: 'ATVPDKIKX0DER',
      bulletPoints: [],
      searchTerms: [],
      otherImages: [],
      status: 'active',
    };
    redis.get.mockResolvedValue(JSON.stringify(cachedListing));

    const result = await listings.getByAsin('B09XYZ1234');

    expect(result).toEqual(cachedListing);
    expect(transport.request).not.toHaveBeenCalled();
  });

  it('returns null when API returns empty data array', async () => {
    transport.request.mockResolvedValue({ code: 0, data: [] });

    const result = await listings.getByAsin('NONEXISTENT');

    expect(result).toBeNull();
  });

  it('ignores extra unknown fields in API response', async () => {
    const responseWithExtras = {
      code: 0,
      data: [
        {
          ...listingResponse.data[0],
          unknown_field: 'should be ignored',
          another_extra: 123,
        },
      ],
    };
    transport.request.mockResolvedValue(responseWithExtras);

    const result = await listings.getByAsin('B09XYZ1234');

    expect(result).not.toBeNull();
    expect(result!.platformListingId).toBe('B09XYZ1234');
    expect((result as any).unknown_field).toBeUndefined();
    expect((result as any).another_extra).toBeUndefined();
  });

  it('retries on API 500 then throws LingxingError after max attempts', async () => {
    const serverError = new LingxingError(
      'Internal Server Error',
      LingxingErrorCode.API_ERROR,
      true,
      500,
    );
    transport.request.mockRejectedValue(serverError);

    await expect(listings.getByAsin('B09XYZ1234')).rejects.toThrow(LingxingError);
    expect(transport.request).toHaveBeenCalledTimes(3);
  });

  it('maps listing_status correctly for all known values', async () => {
    const statusCases: Array<[string, string]> = [
      ['Active', 'active'],
      ['Inactive', 'inactive'],
      ['Incomplete', 'draft'],
      ['Suppressed', 'suppressed'],
      ['Deleted', 'archived'],
      ['SomethingElse', 'unknown'],
    ];

    for (const [input, expected] of statusCases) {
      transport.request.mockResolvedValue({
        code: 0,
        data: [{ ...listingResponse.data[0], listing_status: input }],
      });
      redis.get.mockResolvedValue(null);

      const result = await listings.getByAsin('B09XYZ1234');
      expect(result!.status).toBe(expected);
    }
  });
});
