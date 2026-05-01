import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { AuthManager } from '../src/client/auth-manager';
import { AuthFailedError, NetworkError } from '../src/errors/lingxing-error';
import authResponse from './fixtures/auth-response.json';

vi.mock('axios', () => {
  const fn = vi.fn();
  return {
    default: {
      post: fn,
      isAxiosError: (e: unknown) =>
        e instanceof Error &&
        'isAxiosError' in e &&
        (e as Record<string, unknown>).isAxiosError === true,
    },
  };
});

function createRedisMock() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  };
}

function createOptions() {
  return {
    appKey: 'test-key',
    appSecret: 'test-secret',
    baseUrl: 'https://api.lingxing.com',
    redisUrl: 'redis://localhost:6379',
  };
}

describe('AuthManager', () => {
  let redis: ReturnType<typeof createRedisMock>;
  let manager: AuthManager;
  const options = createOptions();

  beforeEach(() => {
    redis = createRedisMock();
    manager = new AuthManager(options, redis as never);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches token from API on first call, stores in Redis, and returns it', async () => {
    (axios.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: authResponse });

    const token = await manager.getToken();

    expect(token).toBe('mock-token-abc123');
    expect(axios.post).toHaveBeenCalledWith('https://api.lingxing.com/api/passport/login', {
      appId: 'test-key',
      appSecret: 'test-secret',
    });
    expect(redis.set).toHaveBeenCalledWith('lingxing:token', 'mock-token-abc123', 'EX', 6900);
  });

  it('returns cached token from Redis without API call', async () => {
    redis.get.mockResolvedValueOnce('cached-token');

    const token = await manager.getToken();

    expect(token).toBe('cached-token');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('auto-refreshes when token expires', async () => {
    redis.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    redis.set.mockResolvedValueOnce('OK').mockResolvedValueOnce('OK').mockResolvedValueOnce('OK');

    (axios.post as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: authResponse })
      .mockResolvedValueOnce({
        data: {
          code: 0,
          msg: 'success',
          data: { access_token: 'refreshed-token', expires_in: 7200 },
        },
      });

    const token1 = await manager.getToken();
    expect(token1).toBe('mock-token-abc123');

    const token2 = await manager.getToken();
    expect(token2).toBe('refreshed-token');
  });

  it('only one caller refreshes via distributed lock; others wait for token', async () => {
    const lockRedis = createRedisMock();

    lockRedis.get.mockResolvedValue(null);

    lockRedis.set
      .mockResolvedValueOnce('OK')
      .mockResolvedValueOnce('OK')
      .mockResolvedValueOnce(null);

    let resolvePost!: (value: unknown) => void;
    const postPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });
    (axios.post as ReturnType<typeof vi.fn>).mockReturnValue(postPromise);

    const lockManager = new AuthManager(options, lockRedis as never);

    const p1 = lockManager.getToken();

    lockRedis.get.mockResolvedValueOnce(null);
    lockRedis.set.mockResolvedValueOnce(null);
    lockRedis.get.mockResolvedValueOnce('mock-token-abc123');

    const p2 = lockManager.getToken();

    resolvePost({ data: authResponse });

    const [t1, t2] = await Promise.all([p1, p2]);
    expect(t1).toBe('mock-token-abc123');
    expect(t2).toBe('mock-token-abc123');
  });

  it('throws AuthFailedError when API returns 401', async () => {
    const axiosError = new Error('Unauthorized') as Error & {
      isAxiosError: boolean;
      response: { status: number };
    };
    axiosError.isAxiosError = true;
    axiosError.response = { status: 401 };
    (axios.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(axiosError);

    await expect(manager.getToken()).rejects.toThrow(AuthFailedError);
  });

  it('throws AuthFailedError after 3 consecutive failures', async () => {
    const error = new Error('Server error');
    (axios.post as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error);

    await expect(manager.getToken()).rejects.toThrow(Error);
    await expect(manager.getToken()).rejects.toThrow(Error);
    await expect(manager.getToken()).rejects.toThrow(AuthFailedError);
  });

  it('throws NetworkError on network timeout', async () => {
    const axiosError = new Error('timeout of 5000ms exceeded') as Error & {
      isAxiosError: boolean;
      response: undefined;
    };
    axiosError.isAxiosError = true;
    axiosError.response = undefined;
    (axios.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(axiosError);

    await expect(manager.getToken()).rejects.toThrow(NetworkError);
  });
});
