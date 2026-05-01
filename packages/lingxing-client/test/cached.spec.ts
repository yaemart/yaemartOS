import { describe, expect, it, vi, beforeEach } from 'vitest';
import { withCache } from '../src/decorators/cached';

function createMockRedis() {
  return {
    eval: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
  } as any;
}

describe('withCache', () => {
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    redis = createMockRedis();
    vi.restoreAllMocks();
  });

  it('returns cached value on cache hit without calling fn', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ data: 'cached' }));
    const fn = vi.fn();

    const result = await withCache(redis, 'getProduct', [123], fn, { ttlSeconds: 300 });

    expect(result).toEqual({ data: 'cached' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('calls fn and caches result on cache miss', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    const fn = vi.fn().mockResolvedValue({ data: 'fresh' });

    const result = await withCache(redis, 'getProduct', [123], fn, { ttlSeconds: 300 });

    expect(result).toEqual({ data: 'fresh' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(redis.setex).toHaveBeenCalledWith(
      expect.stringContaining('lingxing:cache:getProduct:'),
      300,
      JSON.stringify({ data: 'fresh' }),
    );
  });

  it('falls back to fn when Redis read fails', async () => {
    redis.get.mockRejectedValue(new Error('Redis connection lost'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fn = vi.fn().mockResolvedValue({ data: 'fallback' });

    const result = await withCache(redis, 'getProduct', [123], fn, { ttlSeconds: 300 });

    expect(result).toEqual({ data: 'fallback' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('still returns result when Redis write fails', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockRejectedValue(new Error('Redis write error'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fn = vi.fn().mockResolvedValue({ data: 'ok' });

    const result = await withCache(redis, 'getProduct', [123], fn, { ttlSeconds: 300 });

    expect(result).toEqual({ data: 'ok' });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('uses custom keyPrefix when provided', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    const fn = vi.fn().mockResolvedValue('val');

    await withCache(redis, 'op', [], fn, { ttlSeconds: 60, keyPrefix: 'custom' });

    expect(redis.setex).toHaveBeenCalledWith(
      expect.stringContaining('custom:op:'),
      60,
      JSON.stringify('val'),
    );
  });

  it('generates different cache keys for different args', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    const fn = vi.fn().mockResolvedValue('v');

    await withCache(redis, 'op', [1], fn, { ttlSeconds: 60 });
    await withCache(redis, 'op', [2], fn, { ttlSeconds: 60 });

    const key1 = redis.setex.mock.calls[0]![0];
    const key2 = redis.setex.mock.calls[1]![0];
    expect(key1).not.toBe(key2);
  });
});
