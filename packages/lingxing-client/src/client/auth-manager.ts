import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { LingxingClientOptions } from '../lingxing-client.options';
import { LINGXING_CLIENT_OPTIONS } from '../tokens';

/**
 * Lingxing OpenAPI authentication (APISIX gateway, 2025 format).
 *
 * Every request must carry four query params:
 *   app_key   – the App Key from the developer portal
 *   access_token – the permanent App Secret from the portal
 *   timestamp – current Unix epoch (seconds)
 *   sign      – MD5(app_key + access_token + timestamp)
 *
 * There is no token-refresh step; the App Secret is permanent.
 */
@Injectable()
export class AuthManager {
  private readonly appKey: string;
  private readonly appSecret: string;

  constructor(@Inject(LINGXING_CLIENT_OPTIONS) private readonly options: LingxingClientOptions) {
    this.appKey = options.appKey;
    this.appSecret = options.appSecret;
  }

  /**
   * Returns the four auth query params to attach to every Lingxing API request.
   */
  getAuthParams(): Record<string, string> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sign = createHash('md5')
      .update(this.appKey + this.appSecret + timestamp)
      .digest('hex');

    return {
      app_key: this.appKey,
      access_token: this.appSecret,
      timestamp,
      sign,
    };
  }
}
