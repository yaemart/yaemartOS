import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RateLimiter } from '../src/decorators/rate-limiter';
import { RateLimitedError } from '../src/errors/lingxing-error';

function createMockRedis(evalFn: ReturnType<typeof vi.fn>) {
  return { eval: evalFn, get: vi.fn(), set: vi.fn(), setex: vi.fn() } as any;
}

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('acquires immediately when bucket has tokens', async () => {
    const redis = createMockRedis(vi.fn().mockResolvedValue(1));
    const limiter = new RateLimiter(redis, 5);

    await expect(limiter.acquire()).resolves.toBeUndefined();
    expect(redis.eval).toHaveBeenCalledTimes(1);
  });

  it('waits and retries when bucket is empty then refills', async () => {
    const evalFn = vi
      .fn()
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    const redis = createMockRedis(evalFn);
    const limiter = new RateLimiter(redis, 1, 30000);

    await expect(limiter.acquire()).resolves.toBeUndefined();
    expect(evalFn).toHaveBeenCalledTimes(3);
  });

  it('throws RateLimitedError when wait exceeds maxWaitMs', async () => {
    const evalFn = vi.fn().mockResolvedValue(0);
    const redis = createMockRedis(evalFn);
    const limiter = new RateLimiter(redis, 1, 400);

    await expect(limiter.acquire()).rejects.toThrow(RateLimitedError);
  });

  it('throws with descriptive message including wait time', async () => {
    const evalFn = vi.fn().mockResolvedValue(0);
    const redis = createMockRedis(evalFn);
    const limiter = new RateLimiter(redis, 1, 300);

    try {
      await limiter.acquire();
      expect.unreachable('should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(RateLimitedError);
      expect(err.message).toContain('max 300ms');
    }
  });
});
