import { Inject, Injectable } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError, Method } from 'axios';
import { AuthManager } from './auth-manager';
import {
  LingxingError,
  AuthFailedError,
  RateLimitedError,
  BusinessError,
  NetworkError,
} from '../errors/lingxing-error';
import { LingxingErrorCode } from '../errors/error-codes';
import { LingxingClientOptions } from '../lingxing-client.options';
import { LINGXING_CLIENT_OPTIONS } from '../tokens';

@Injectable()
export class HttpTransport {
  private readonly client: AxiosInstance;

  constructor(
    @Inject(LINGXING_CLIENT_OPTIONS) options: LingxingClientOptions,
    private readonly authManager: AuthManager,
  ) {
    this.client = axios.create({ baseURL: options.baseUrl, timeout: 20000 });

    /**
     * Inject auth query params into every outbound request.
     *
     * For GET:  all business params are in config.params; sign covers all of them.
     * For POST: business params are in config.data (body); sign covers fixed + body params.
     */
    this.client.interceptors.request.use(async (config) => {
      const accessToken = await this.authManager.getAccessToken();
      const ts = String(Math.floor(Date.now() / 1000));

      const fixedParams: Record<string, string> = {
        access_token: accessToken,
        app_key: this.authManager.appKeyValue,
        timestamp: ts,
      };

      // Collect all params that contribute to the sign
      const bodyObj =
        config.method?.toLowerCase() !== 'get' && config.data
          ? typeof config.data === 'string'
            ? (JSON.parse(config.data) as Record<string, unknown>)
            : (config.data as Record<string, unknown>)
          : {};

      const signParams: Record<string, unknown> = {
        ...fixedParams,
        ...(config.params ?? {}),
        ...bodyObj,
      };

      const sign = this.authManager.buildSign(signParams);

      // Fixed params + sign always go in the query string
      config.params = { ...fixedParams, sign, ...(config.params ?? {}) };
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        // Lingxing APISIX endpoints return HTTP 200 even for business errors.
        // Success: code === 0 (number) or code === "0" or code === "200" or no code field.
        const data = response.data as { code?: string | number; message?: string; msg?: string };
        const code = data?.code;
        const isSuccess =
          code === undefined ||
          code === null ||
          code === 0 ||
          code === '0' ||
          code === 200 ||
          code === '200';
        if (!isSuccess) {
          const msg = data.message ?? data.msg ?? `Business error ${code}`;
          throw new BusinessError(msg);
        }
        return response;
      },
      (error: AxiosError) => {
        throw this.mapError(error);
      },
    );
  }

  async request<T>(
    method: Method,
    path: string,
    params?: Record<string, unknown>,
    data?: Record<string, unknown>,
  ): Promise<T> {
    try {
      const response = await this.client.request<T>({ method, url: path, params, data });
      return response.data;
    } catch (err) {
      // If Lingxing rejected the token, evict the cache and retry once with a fresh token.
      if (this.isTokenExpiredError(err)) {
        await this.authManager.invalidateToken();
        const response = await this.client.request<T>({ method, url: path, params, data });
        return response.data;
      }
      throw err;
    }
  }

  private isTokenExpiredError(err: unknown): boolean {
    if (!(err instanceof BusinessError)) {
      return false;
    }
    const msg = err.message.toLowerCase();
    return (
      msg.includes('access token not match') ||
      msg.includes('access_token not match') ||
      msg.includes('token invalid') ||
      msg.includes('token expired') ||
      msg.includes('2001006')
    );
  }

  private mapError(error: AxiosError): LingxingError {
    if (!error.response) {
      return new NetworkError(error.message || 'Network error');
    }

    const status = error.response.status;
    const respData = error.response.data as Record<string, string> | undefined;
    const message = respData?.message ?? respData?.msg ?? error.message ?? `HTTP ${status}`;

    switch (status) {
      case 401:
        return new AuthFailedError(message, status);
      case 429:
        return new RateLimitedError(message, status);
      case 400:
      case 403:
      case 404:
      case 422:
        return new BusinessError(message, status);
      case 500:
      case 502:
      case 503:
      case 504:
        return new LingxingError(message, LingxingErrorCode.API_ERROR, true, status);
      default:
        return new LingxingError(message, LingxingErrorCode.API_ERROR, false, status);
    }
  }
}
