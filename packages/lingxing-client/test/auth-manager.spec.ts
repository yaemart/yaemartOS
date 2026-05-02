import { createHash } from 'crypto';
import { describe, it, expect, vi } from 'vitest';
import { AuthManager } from '../src/client/auth-manager';

function createManager(appKey = 'test-app-key', appSecret = 'test-secret==') {
  const options = {
    appKey,
    appSecret,
    baseUrl: 'https://openapi.lingxing.com',
    redisUrl: 'redis://localhost:6379',
  };
  return new AuthManager(options as never);
}

describe('AuthManager.getAuthParams', () => {
  it('returns all four required params', () => {
    const manager = createManager();
    const params = manager.getAuthParams();

    expect(params).toHaveProperty('app_key');
    expect(params).toHaveProperty('access_token');
    expect(params).toHaveProperty('timestamp');
    expect(params).toHaveProperty('sign');
  });

  it('app_key matches configured appKey', () => {
    const manager = createManager('my-app-key', 'my-secret');
    expect(manager.getAuthParams().app_key).toBe('my-app-key');
  });

  it('access_token equals appSecret (permanent token)', () => {
    const manager = createManager('ak_test', 'ZRt5YKRh0yr5sUnloZkWoQ==');
    expect(manager.getAuthParams().access_token).toBe('ZRt5YKRh0yr5sUnloZkWoQ==');
  });

  it('timestamp is a valid Unix epoch string (seconds)', () => {
    const before = Math.floor(Date.now() / 1000) - 1;
    const manager = createManager();
    const ts = Number(manager.getAuthParams().timestamp);
    const after = Math.floor(Date.now() / 1000) + 1;

    expect(Number.isInteger(ts)).toBe(true);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('sign equals MD5(appKey + appSecret + timestamp)', () => {
    const appKey = 'ak_69Tb7kBYdZsP4';
    const appSecret = 'ZRt5YKRh0yr5sUnloZkWoQ==';
    const manager = createManager(appKey, appSecret);

    const { timestamp, sign } = manager.getAuthParams();
    const expected = createHash('md5')
      .update(appKey + appSecret + timestamp)
      .digest('hex');

    expect(sign).toBe(expected);
  });

  it('generates a fresh sign on each call (timestamp advances)', async () => {
    vi.useFakeTimers();
    const manager = createManager();

    const params1 = manager.getAuthParams();
    vi.advanceTimersByTime(2000);
    const params2 = manager.getAuthParams();

    expect(params1.sign).not.toBe(params2.sign);
    vi.useRealTimers();
  });
});
