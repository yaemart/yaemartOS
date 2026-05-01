import Redis from 'ioredis';
import { createHash } from 'crypto';

export interface CacheOptions {
  ttlSeconds: number;
  keyPrefix?: string;
}

const DEFAULT_KEY_PREFIX = 'lingxing:cache';

function buildCacheKey(prefix: string, operation: string, args: unknown[]): string {
  const hash = createHash('md5').update(JSON.stringify(args)).digest('hex');
  return `${prefix}:${operation}:${hash}`;
}

export async function withCache<T>(
  redis: Redis,
  operation: string,
  args: unknown[],
  fn: () => Promise<T>,
  options: CacheOptions,
): Promise<T> {
  const prefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
  const key = buildCacheKey(prefix, operation, args);

  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    console.warn('Redis cache read failed, falling back to direct call:', err);
    return fn();
  }

  const result = await fn();

  try {
    await redis.setex(key, options.ttlSeconds, JSON.stringify(result));
  } catch (err) {
    console.warn('Redis cache write failed:', err);
  }

  return result;
}
