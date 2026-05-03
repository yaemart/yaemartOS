import { createHash, createCipheriv } from 'crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { AuthManager } from '../src/client/auth-manager';
import { AuthFailedError } from '../src/errors/lingxing-error';

const APP_KEY = 'ak_69Tb7kBYdZsP4';
const APP_SECRET = 'ZRt5YKRh0yr5sUnloZkWoQ==';
const FAKE_TOKEN = 'test-access-token-uuid';
const MOCK_EXPIRES = 7199;

function makeRedisMock(cachedToken: string | null = null) {
  return {
    get: vi.fn().mockResolvedValue(cachedToken),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  };
}

vi.mock('axios', () => ({
  default: {
    post: vi.fn().mockResolvedValue({
      data: {
        code: '200',
        data: { access_token: 'test-access-token-uuid', refresh_token: 'rt', expires_in: 7199 },
      },
    }),
  },
}));

function createManager(appKey = APP_KEY, appSecret = APP_SECRET, redisMock = makeRedisMock()) {
  const options = {
    appKey,
    appSecret,
    baseUrl: 'https://openapi.lingxing.com',
    redisUrl: 'redis://localhost:6379',
  };
  return new AuthManager(options as never, redisMock as never);
}

describe('AuthManager.buildSign', () => {
  it('produces a 64-char Base64 string for 3 fixed params', () => {
    const manager = createManager();
    const sign = manager.buildSign({
      access_token: FAKE_TOKEN,
      app_key: APP_KEY,
      timestamp: '1700000000',
    });
    expect(sign).toHaveLength(64);
    expect(() => Buffer.from(sign, 'base64')).not.toThrow();
  });

  it('sorts params by ASCII key order before hashing', () => {
    const manager = createManager();
    // build expected sign manually
    const params = { app_key: APP_KEY, access_token: FAKE_TOKEN, timestamp: '1700000000' };
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k as keyof typeof params]}`)
      .join('&');
    const md5 = createHash('md5').update(sorted).digest('hex').toUpperCase();
    const keyBuf = Buffer.alloc(16, 0);
    Buffer.from(APP_KEY).copy(keyBuf, 0, 0, Math.min(APP_KEY.length, 16));
    const cipher = createCipheriv('aes-128-ecb', keyBuf, null);
    const expected = Buffer.concat([
      cipher.update(Buffer.from(md5, 'utf8')),
      cipher.final(),
    ]).toString('base64');

    expect(manager.buildSign(params)).toBe(expected);
  });

  it('excludes empty-string values from sign', () => {
    const manager = createManager();
    const s1 = manager.buildSign({
      app_key: APP_KEY,
      access_token: FAKE_TOKEN,
      timestamp: '1700000000',
    });
    const s2 = manager.buildSign({
      app_key: APP_KEY,
      access_token: FAKE_TOKEN,
      timestamp: '1700000000',
      empty: '',
    });
    expect(s1).toBe(s2);
  });

  it('includes null values in sign', () => {
    const manager = createManager();
    const s1 = manager.buildSign({ app_key: APP_KEY, timestamp: '1700000000' });
    const s2 = manager.buildSign({
      app_key: APP_KEY,
      timestamp: '1700000000',
      nullish: null as unknown as string,
    });
    // null gets included, so they SHOULD differ (null !== undefined/empty)
    // Actually null values: "value为null会参与生成签名" - so nullish=null IS included
    expect(s1).not.toBe(s2);
  });

  it('different params produce different signs', () => {
    const manager = createManager();
    const s1 = manager.buildSign({
      access_token: FAKE_TOKEN,
      app_key: APP_KEY,
      timestamp: '1700000000',
    });
    const s2 = manager.buildSign({
      access_token: FAKE_TOKEN,
      app_key: APP_KEY,
      timestamp: '1700000001',
    });
    expect(s1).not.toBe(s2);
  });
});

describe('AuthManager.getAccessToken', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cached token from Redis without fetching new one', async () => {
    const redis = makeRedisMock('cached-token');
    const manager = createManager(APP_KEY, APP_SECRET, redis);
    const token = await manager.getAccessToken();
    expect(token).toBe('cached-token');
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('fetches new token when cache is empty', async () => {
    const redis = makeRedisMock(null);
    redis.set.mockResolvedValueOnce('OK'); // lock acquired
    const manager = createManager(APP_KEY, APP_SECRET, redis);
    const token = await manager.getAccessToken();
    expect(token).toBe(FAKE_TOKEN);
    expect(redis.set).toHaveBeenCalledWith(
      'lingxing:access_token',
      FAKE_TOKEN,
      'EX',
      MOCK_EXPIRES - 60,
    );
  });

  it('throws AuthFailedError when lock is held for too long (max retries exceeded)', async () => {
    // Redis never grants the lock (set NX always returns null) and cache stays empty
    const redis = makeRedisMock(null);
    redis.set.mockResolvedValue(null); // lock always held by another process

    vi.useFakeTimers();
    const manager = createManager(APP_KEY, APP_SECRET, redis);

    const promise = manager.getAccessToken();
    // advance timers past all retries (20 × 500ms = 10s)
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toBeInstanceOf(AuthFailedError);
    vi.useRealTimers();
  });

  it('throws AuthFailedError when token API returns a business error code', async () => {
    const redis = makeRedisMock(null);
    redis.set.mockResolvedValueOnce('OK'); // lock acquired

    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { code: '1001', message: 'invalid appId or appSecret', data: null },
    });

    const manager = createManager(APP_KEY, APP_SECRET, redis);
    await expect(manager.getAccessToken()).rejects.toBeInstanceOf(AuthFailedError);
  });

  it('throws AuthFailedError when token API returns null data.data', async () => {
    const redis = makeRedisMock(null);
    redis.set.mockResolvedValueOnce('OK');

    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { code: 0, data: null },
    });

    const manager = createManager(APP_KEY, APP_SECRET, redis);
    await expect(manager.getAccessToken()).rejects.toBeInstanceOf(AuthFailedError);
  });

  it('appKeyValue getter returns the configured appKey', () => {
    const manager = createManager('my-app-key');
    expect(manager.appKeyValue).toBe('my-app-key');
  });
});
