import { Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import Redis from 'ioredis';
import { AuthFailedError, NetworkError } from '../errors/lingxing-error';
import { LingxingClientOptions } from '../lingxing-client.options';
import { LINGXING_CLIENT_OPTIONS, REDIS_CLIENT } from '../tokens';

const TOKEN_KEY = 'lingxing:token';
const LOCK_KEY = 'lingxing:token:lock';
const LOCK_TTL = 30;
const LOCK_POLL_INTERVAL = 200;
const LOCK_POLL_TIMEOUT = 10_000;
const REFRESH_BUFFER_SECONDS = 300;
const MAX_CONSECUTIVE_FAILURES = 3;

@Injectable()
export class AuthManager {
  private consecutiveFailures = 0;

  constructor(
    @Inject(LINGXING_CLIENT_OPTIONS) private readonly options: LingxingClientOptions,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getToken(): Promise<string> {
    const cached = await this.redis.get(TOKEN_KEY);
    if (cached) {
      return cached;
    }

    return this.refreshToken();
  }

  private async refreshToken(): Promise<string> {
    const lockAcquired = await this.acquireLock();

    if (!lockAcquired) {
      return this.waitForToken();
    }

    try {
      const token = await this.fetchTokenFromApi();
      this.consecutiveFailures = 0;
      return token;
    } catch (error) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new AuthFailedError(
          `Token refresh failed after ${MAX_CONSECUTIVE_FAILURES} consecutive attempts`,
        );
      }
      throw error;
    } finally {
      await this.redis.del(LOCK_KEY);
    }
  }

  private async acquireLock(): Promise<boolean> {
    const result = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL, 'NX');
    return result === 'OK';
  }

  private async waitForToken(): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < LOCK_POLL_TIMEOUT) {
      const token = await this.redis.get(TOKEN_KEY);
      if (token) {
        return token;
      }
      await this.sleep(LOCK_POLL_INTERVAL);
    }
    throw new AuthFailedError('Timed out waiting for token refresh');
  }

  private async fetchTokenFromApi(): Promise<string> {
    try {
      const response = await axios.post(`${this.options.baseUrl}/api/passport/login`, {
        appId: this.options.appKey,
        appSecret: this.options.appSecret,
      });

      const { access_token, expires_in } = response.data.data;
      const ttl = expires_in - REFRESH_BUFFER_SECONDS;

      await this.redis.set(TOKEN_KEY, access_token, 'EX', ttl);

      return access_token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new AuthFailedError('Authentication failed', 401);
        }
        if (!error.response) {
          throw new NetworkError(error.message);
        }
      }
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
