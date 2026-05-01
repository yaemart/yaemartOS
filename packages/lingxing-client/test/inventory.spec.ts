import { describe, expect, it, vi, beforeEach } from 'vitest';
import { InventoryOperations } from '../src/operations/inventory';
import { LingxingError } from '../src/errors/lingxing-error';
import { LingxingErrorCode } from '../src/errors/error-codes';
import inventoryResponse from './fixtures/inventory-response.json';

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

describe('InventoryOperations', () => {
  let transport: ReturnType<typeof createMockTransport>;
  let rateLimiter: ReturnType<typeof createMockRateLimiter>;
  let redis: ReturnType<typeof createMockRedis>;
  let inventory: InventoryOperations;

  beforeEach(() => {
    vi.restoreAllMocks();
    transport = createMockTransport();
    rateLimiter = createMockRateLimiter();
    redis = createMockRedis();
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    inventory = new InventoryOperations(transport, rateLimiter, redis, 'test:cache');
  });

  it('getSnapshot returns correctly mapped inventory array', async () => {
    transport.request.mockResolvedValue(inventoryResponse);

    const result = await inventory.getSnapshot('ATVPDKIKX0DER');

    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('HT-SC-001');
    expect(result[0].asin).toBe('B09XYZ1234');
    expect(result[0].marketplaceId).toBe('ATVPDKIKX0DER');
    expect(result[0].fbaAvailable).toBe(150);
    expect(result[0].fbaInbound).toBe(50);
    expect(result[0].fbaReserved).toBe(10);
    expect(result[0].fbaUnfulfillable).toBe(2);
    expect(result[0].fbaTotal).toBe(212);
    expect(result[0].daysOfSupply).toBe(45);
    expect(result[0].snapshotAt).toBeInstanceOf(Date);
  });

  it('returns empty array when API returns empty data', async () => {
    transport.request.mockResolvedValue({ code: 0, data: [] });

    const result = await inventory.getSnapshot('ATVPDKIKX0DER');

    expect(result).toEqual([]);
  });

  it('retries on API error then throws after max attempts', async () => {
    const serverError = new LingxingError(
      'Service Unavailable',
      LingxingErrorCode.API_ERROR,
      true,
      503,
    );
    transport.request.mockRejectedValue(serverError);

    await expect(inventory.getSnapshot('ATVPDKIKX0DER')).rejects.toThrow(LingxingError);
    expect(transport.request).toHaveBeenCalledTimes(3);
  });

  it('defaults numeric fields to 0 when missing from API', async () => {
    transport.request.mockResolvedValue({
      code: 0,
      data: [{ seller_sku: 'SKU-001', marketplace_id: 'A1F83G8C2ARO7P' }],
    });

    const result = await inventory.getSnapshot('A1F83G8C2ARO7P');

    expect(result[0].fbaAvailable).toBe(0);
    expect(result[0].fbaInbound).toBe(0);
    expect(result[0].fbaReserved).toBe(0);
    expect(result[0].fbaUnfulfillable).toBe(0);
    expect(result[0].fbaTotal).toBe(0);
    expect(result[0].daysOfSupply).toBe(0);
  });

  it('uses custom cache TTL when provided', async () => {
    transport.request.mockResolvedValue(inventoryResponse);

    await inventory.getSnapshot('ATVPDKIKX0DER', { cache: { ttl: 60 } });

    expect(redis.setex).toHaveBeenCalledWith(
      expect.stringContaining('test:cache:inventory.getSnapshot:'),
      60,
      expect.any(String),
    );
  });
});
