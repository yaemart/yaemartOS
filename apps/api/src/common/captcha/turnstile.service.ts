import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const FETCH_TIMEOUT_MS = 5_000;

export type TurnstileResult = 'valid' | 'invalid' | 'unavailable';

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Verify a Cloudflare Turnstile token server-side.
   *
   * Returns:
   *  - 'valid'       — token accepted by Cloudflare
   *  - 'invalid'     — token rejected (bad/expired challenge)
   *  - 'unavailable' — Cloudflare endpoint unreachable (network error / timeout)
   *
   * In test mode (TURNSTILE_TEST_MODE=true) always returns 'valid'.
   * Throws synchronously if TURNSTILE_SECRET_KEY is missing (config error, not runtime).
   */
  async verify(token: string, ip?: string): Promise<TurnstileResult> {
    if (this.config.get<string>('TURNSTILE_TEST_MODE') === 'true') {
      return 'valid';
    }

    const secretKey = this.config.get<string>('TURNSTILE_SECRET_KEY');
    if (!secretKey) {
      this.logger.error(
        'TURNSTILE_SECRET_KEY is not configured — CAPTCHA verification blocked. ' +
          'Set TURNSTILE_SECRET_KEY to enable the order-lookup endpoint.',
      );
      return 'invalid';
    }

    const body = new URLSearchParams({ secret: secretKey, response: token });
    if (ip) {
      body.set('remoteip', ip);
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetch(TURNSTILE_VERIFY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] };

      if (!data.success) {
        this.logger.debug(`Turnstile challenge failed: ${JSON.stringify(data['error-codes'])}`);
        return 'invalid';
      }

      return 'valid';
    } catch (err) {
      this.logger.warn(`Turnstile endpoint unreachable (${String(err)}). Treating as unavailable.`);
      return 'unavailable';
    }
  }

  /**
   * Convenience wrapper: resolves to true/false, throws ServiceUnavailableException when
   * Cloudflare is unreachable so callers can surface a 503 rather than silently blocking.
   */
  async verifyOrThrow(token: string, ip?: string): Promise<boolean> {
    const result = await this.verify(token, ip);
    if (result === 'unavailable') {
      throw new ServiceUnavailableException(
        'CAPTCHA service temporarily unavailable. Please try again later.',
      );
    }
    return result === 'valid';
  }
}
