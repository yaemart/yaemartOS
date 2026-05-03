import { createHash, createCipheriv } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { Redis } from 'ioredis';
import { AuthFailedError } from '../errors/lingxing-error';
import { LingxingClientOptions } from '../lingxing-client.options';
import { LINGXING_CLIENT_OPTIONS, REDIS_CLIENT } from '../tokens';

const TOKEN_CACHE_KEY = 'lingxing:access_token';
const TOKEN_LOCK_KEY = 'lingxing:token_lock';
const LOCK_WAIT_INTERVAL_MS = 500;
const LOCK_MAX_RETRIES = 20; // 20 × 500ms = 10s max wait, matches old LOCK_POLL_TIMEOUT

/**
 * Lingxing OpenAPI authentication.
 *
 * Auth flow (per official docs):
 *   1. POST /api/auth-server/oauth/access-token?appId=...&appSecret=...
 *      → { access_token, refresh_token, expires_in }
 *   2. Attach to every business request as query params:
 *      access_token, app_key, timestamp, sign
 *   3. sign = Base64( AES-128-ECB-PKCS5( MD5(sorted_all_params).toUpperCase(), appKey ) )
 *
 * Tokens are cached in Redis with TTL = expires_in - 60s.
 */
@Injectable()
export class AuthManager {
  private readonly logger = new Logger(AuthManager.name);
  private readonly appKey: string;
  private readonly appSecret: string;
  private readonly baseUrl: string;

  constructor(
    @Inject(LINGXING_CLIENT_OPTIONS) private readonly options: LingxingClientOptions,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.appKey = options.appKey;
    this.appSecret = options.appSecret;
    this.baseUrl = options.baseUrl;
  }

  /**
   * Get a valid access_token, fetching a new one if necessary.
   *
   * Lock contention: if another process holds the refresh lock we wait up to
   * LOCK_MAX_RETRIES × LOCK_WAIT_INTERVAL_MS (≈ 10s) before throwing
   * AuthFailedError. This replaces the previous unbounded tail-recursion.
   */
  async getAccessToken(attempt = 0): Promise<string> {
    const cached = await this.redis.get(TOKEN_CACHE_KEY);
    if (cached) {
      return cached;
    }

    const locked = await this.redis.set(TOKEN_LOCK_KEY, '1', 'EX', 30, 'NX');
    if (!locked) {
      if (attempt >= LOCK_MAX_RETRIES) {
        throw new AuthFailedError(
          `Timed out waiting for Lingxing token refresh after ${LOCK_MAX_RETRIES} retries`,
        );
      }
      await new Promise((r) => setTimeout(r, LOCK_WAIT_INTERVAL_MS));
      return this.getAccessToken(attempt + 1);
    }

    try {
      const resp = await axios.post<{
        code: string | number;
        message?: string;
        msg?: string;
        data: { access_token: string; refresh_token: string; expires_in: number } | null;
      }>(`${this.baseUrl}/api/auth-server/oauth/access-token`, null, {
        params: { appId: this.appKey, appSecret: this.appSecret },
      });

      const { code, data: tokenData } = resp.data;
      const isSuccess = code === 0 || code === '0' || code === 200 || code === '200';
      if (!isSuccess || !tokenData?.access_token) {
        const msg = resp.data.message ?? resp.data.msg ?? String(code);
        throw new AuthFailedError(`Lingxing auth failed: ${msg}`);
      }

      const { access_token, expires_in } = tokenData;
      const ttl = Math.max(expires_in - 60, 60);
      await this.redis.set(TOKEN_CACHE_KEY, access_token, 'EX', ttl);
      this.logger.log(`Lingxing access_token refreshed (expires in ${expires_in}s)`);
      return access_token;
    } finally {
      await this.redis.del(TOKEN_LOCK_KEY);
    }
  }

  /**
   * Build the APISIX gateway sign for a set of params.
   *
   * Algorithm:
   *   1. Sort params by key (ASCII order), skip empty-string values (null included)
   *   2. Concatenate as key=value&key=value...
   *   3. MD5(string) → 32-char uppercase hex
   *   4. AES-128-ECB-PKCS5PADDING(md5_hex, appKey_padded_to_16_bytes)
   *   5. Base64-encode the cipher bytes
   */
  buildSign(params: Record<string, unknown>): string {
    const sorted = Object.keys(params)
      .filter((k) => params[k] !== '' && params[k] !== undefined)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');

    const md5 = createHash('md5').update(sorted).digest('hex').toUpperCase();

    // AES key = appKey, zero-padded to exactly 16 bytes
    const keyBuf = Buffer.alloc(16, 0);
    Buffer.from(this.appKey).copy(keyBuf, 0, 0, Math.min(this.appKey.length, 16));

    const cipher = createCipheriv('aes-128-ecb', keyBuf, null);
    const encrypted = Buffer.concat([cipher.update(Buffer.from(md5, 'utf8')), cipher.final()]);
    return encrypted.toString('base64');
  }

  /**
   * Evict the cached token so the next getAccessToken() call fetches a fresh one.
   * Called by HttpTransport when Lingxing returns an "access token not match" error.
   */
  async invalidateToken(): Promise<void> {
    await this.redis.del(TOKEN_CACHE_KEY);
    this.logger.warn('Lingxing access_token cache invalidated (token rejected by server)');
  }

  get appKeyValue(): string {
    return this.appKey;
  }
}
