import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosHeaders, AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { HttpTransport } from '../src/client/http-transport';
import { AuthManager } from '../src/client/auth-manager';
import {
  AuthFailedError,
  RateLimitedError,
  BusinessError,
  NetworkError,
  LingxingError,
} from '../src/errors/lingxing-error';

const mockRequest = vi.fn();
const mockRequestInterceptorUse = vi.fn();
const mockResponseInterceptorUse = vi.fn();

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(() => ({
        request: mockRequest,
        interceptors: {
          request: { use: mockRequestInterceptorUse },
          response: { use: mockResponseInterceptorUse },
        },
      })),
    },
  };
});

function createAuthManagerMock(token = 'test-access-token') {
  return {
    getAccessToken: vi.fn().mockResolvedValue(token),
    buildSign: vi.fn().mockReturnValue('mock-sign-base64=='),
    appKeyValue: 'test-app-key',
  } as unknown as AuthManager;
}

const options = {
  appKey: 'test-app-key',
  appSecret: 'test-secret',
  baseUrl: 'https://api.lingxing.com',
  redisUrl: 'redis://localhost:6379',
};

describe('HttpTransport', () => {
  let transport: HttpTransport;
  let authManager: ReturnType<typeof createAuthManagerMock>;
  let requestInterceptor: (
    config: InternalAxiosRequestConfig,
  ) => Promise<InternalAxiosRequestConfig>;
  let responseSuccessHandler: (response: unknown) => unknown;
  let responseErrorHandler: (error: AxiosError) => never;

  beforeEach(() => {
    vi.clearAllMocks();
    authManager = createAuthManagerMock();
    transport = new HttpTransport(options, authManager);

    requestInterceptor = mockRequestInterceptorUse.mock.calls[0][0];
    responseSuccessHandler = mockResponseInterceptorUse.mock.calls[0][0];
    responseErrorHandler = mockResponseInterceptorUse.mock.calls[0][1];
  });

  it('injects access_token, app_key, timestamp, and sign into request params', async () => {
    const config = {
      headers: new AxiosHeaders(),
      params: {},
      method: 'get',
    } as InternalAxiosRequestConfig;
    const result = await requestInterceptor(config);
    expect(result.params).toMatchObject({
      access_token: 'test-access-token',
      app_key: 'test-app-key',
      sign: 'mock-sign-base64==',
    });
    expect(result.params.timestamp).toBeTruthy();
  });

  it('includes existing query params alongside auth params', async () => {
    const config = {
      headers: new AxiosHeaders(),
      params: { offset: 0, length: 20 },
      method: 'get',
    } as InternalAxiosRequestConfig;
    const result = await requestInterceptor(config);
    expect(result.params).toMatchObject({ offset: 0, length: 20, app_key: 'test-app-key' });
  });

  it('calls getAccessToken on each request', async () => {
    const config = {
      headers: new AxiosHeaders(),
      params: {},
      method: 'get',
    } as InternalAxiosRequestConfig;
    await requestInterceptor(config);
    expect(
      (authManager as unknown as { getAccessToken: ReturnType<typeof vi.fn> }).getAccessToken,
    ).toHaveBeenCalledOnce();
  });

  it('includes body params in sign calculation for POST requests', async () => {
    const config = {
      headers: new AxiosHeaders(),
      params: {},
      method: 'post',
      data: JSON.stringify({ name: 'kobe', age: 33 }),
    } as InternalAxiosRequestConfig;
    await requestInterceptor(config);
    const buildSignCall = (authManager as unknown as { buildSign: ReturnType<typeof vi.fn> })
      .buildSign.mock.calls[0][0];
    expect(buildSignCall).toMatchObject({ name: 'kobe', age: 33 });
  });

  it('successful response passes through (code === 0)', () => {
    const response = { data: { code: 0, data: [] } };
    expect(responseSuccessHandler(response)).toBe(response);
  });

  it('successful response passes through (code === "0")', () => {
    const response = { data: { code: '0', data: [] } };
    expect(responseSuccessHandler(response)).toBe(response);
  });

  it('successful response passes through (code === 200)', () => {
    const response = { data: { code: 200, data: [] } };
    expect(responseSuccessHandler(response)).toBe(response);
  });

  it('throws BusinessError for Lingxing business error (HTTP 200 with non-zero code)', () => {
    const response = { data: { code: '3001001', message: 'missing query param' } };
    expect(() => responseSuccessHandler(response)).toThrow(BusinessError);
  });

  it('maps HTTP 401 to AuthFailedError', () => {
    const error = {
      message: 'Unauthorized',
      isAxiosError: true,
      response: { status: 401, data: { msg: 'Invalid token' } },
    } as unknown as AxiosError;
    expect(() => responseErrorHandler(error)).toThrow(AuthFailedError);
  });

  it('maps HTTP 429 to RateLimitedError', () => {
    const error = {
      message: 'Too Many Requests',
      isAxiosError: true,
      response: { status: 429, data: { msg: 'Rate limited' } },
    } as unknown as AxiosError;
    expect(() => responseErrorHandler(error)).toThrow(RateLimitedError);
  });

  it('maps HTTP 400 to BusinessError', () => {
    const error = {
      message: 'Bad Request',
      isAxiosError: true,
      response: { status: 400, data: { msg: 'Invalid params' } },
    } as unknown as AxiosError;
    expect(() => responseErrorHandler(error)).toThrow(BusinessError);
  });

  it('maps network error to NetworkError', () => {
    const error = {
      message: 'Network Error',
      isAxiosError: true,
      response: undefined,
    } as unknown as AxiosError;
    expect(() => responseErrorHandler(error)).toThrow(NetworkError);
  });

  it('maps HTTP 500 to LingxingError with retryable=true', () => {
    const error = {
      message: 'Internal Server Error',
      isAxiosError: true,
      response: { status: 500, data: { msg: 'Server error' } },
    } as unknown as AxiosError;
    try {
      responseErrorHandler(error);
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LingxingError);
      expect((e as LingxingError).retryable).toBe(true);
    }
  });
});
