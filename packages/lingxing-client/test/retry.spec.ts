import { describe, expect, it, vi, beforeEach } from 'vitest';
import { withRetry } from '../src/decorators/retry';
import { BusinessError, NetworkError, RateLimitedError } from '../src/errors/lingxing-error';

describe('withRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    const result = await withRetry(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitedError('rate limited', 429))
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(fn, { baseDelayMs: 1 });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on NetworkError then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new NetworkError('timeout'))
      .mockResolvedValueOnce('back online');

    const result = await withRetry(fn, { baseDelayMs: 1 });

    expect(result).toBe('back online');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after max attempts exhausted', async () => {
    const error = new RateLimitedError('always fails', 429);
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow(error);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws immediately on non-retryable BusinessError', async () => {
    const error = new BusinessError('bad request', 400);
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toThrow(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses exponential backoff between retries', async () => {
    const timestamps: number[] = [];
    const fn = vi.fn().mockImplementation(() => {
      timestamps.push(Date.now());
      if (timestamps.length < 3) {
        return Promise.reject(new RateLimitedError('retry', 429));
      }
      return Promise.resolve('done');
    });

    await withRetry(fn, { maxAttempts: 3, baseDelayMs: 50 });

    expect(timestamps).toHaveLength(3);
    const gap1 = timestamps[1]! - timestamps[0]!;
    const gap2 = timestamps[2]! - timestamps[1]!;
    expect(gap1).toBeGreaterThanOrEqual(40);
    expect(gap2).toBeGreaterThan(gap1 * 1.5);
  });
});
