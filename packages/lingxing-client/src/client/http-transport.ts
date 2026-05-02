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
    this.client = axios.create({ baseURL: options.baseUrl });

    // Inject auth query params into every outbound request.
    this.client.interceptors.request.use((config) => {
      const authParams = this.authManager.getAuthParams();
      config.params = { ...authParams, ...(config.params ?? {}) };
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        // Lingxing returns HTTP 200 even for business errors; surface them.
        // Success codes: 0 (number), "0" (string), or no code field.
        const data = response.data as { code?: string | number; msg?: string };
        const code = data?.code;
        const isSuccess = code === undefined || code === null || code === 0 || code === '0';
        if (!isSuccess) {
          throw new BusinessError(data.msg ?? `Business error ${code}`);
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
    const response = await this.client.request<T>({ method, url: path, params, data });
    return response.data;
  }

  private mapError(error: AxiosError): LingxingError {
    if (!error.response) {
      return new NetworkError(error.message || 'Network error');
    }

    const status = error.response.status;
    const message =
      (error.response.data as Record<string, string>)?.msg || error.message || `HTTP ${status}`;

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
