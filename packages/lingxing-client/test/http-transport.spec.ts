import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosHeaders, InternalAxiosRequestConfig, AxiosError } from 'axios';
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

function createAuthManagerMock() {
  return {
    getToken: vi.fn().mockResolvedValue('test-token'),
  } as unknown as AuthManager;
}

const options = {
  appKey: 'test-key',
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
  let responseErrorHandler: (error: AxiosError) => never;

  beforeEach(() => {
    vi.clearAllMocks();
    authManager = createAuthManagerMock();

    transport = new HttpTransport(options, authManager);

    requestInterceptor = mockRequestInterceptorUse.mock.calls[0][0];
    responseErrorHandler = mockResponseInterceptorUse.mock.calls[0][1];
  });

  it('automatically includes Authorization header', async () => {
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    const result = await requestInterceptor(config);
    expect(result.headers.get('Authorization')).toBe('Bearer test-token');
    expect(
      (authManager as unknown as { getToken: ReturnType<typeof vi.fn> }).getToken,
    ).toHaveBeenCalled();
  });

  it('successful GET request returns data', async () => {
    mockRequest.mockResolvedValueOnce({
      data: { items: [1, 2, 3] },
    });

    const result = await transport.request('GET', '/api/data');
    expect(result).toEqual({ items: [1, 2, 3] });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/data',
      params: undefined,
      data: undefined,
    });
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
