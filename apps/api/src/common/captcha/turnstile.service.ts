import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Verify a Cloudflare Turnstile token server-side.
   * Returns true if the token is valid, false otherwise.
   * In test mode (TURNSTILE_TEST_MODE=true), always returns true.
   */
  async verify(token: string, ip?: string): Promise<boolean> {
    if (this.config.get<string>('TURNSTILE_TEST_MODE') === 'true') {
      return true;
    }

    const secretKey = this.config.get<string>('TURNSTILE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('TURNSTILE_SECRET_KEY not configured — skipping CAPTCHA verification');
      return true;
    }

    try {
      const body = new URLSearchParams({ secret: secretKey, response: token });
      if (ip) {
        body.set('remoteip', ip);
      }

      const res = await fetch(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] };

      if (!data.success) {
        this.logger.debug(`Turnstile failed: ${JSON.stringify(data['error-codes'])}`);
      }

      return data.success === true;
    } catch (err) {
      this.logger.error(`Turnstile verification error: ${String(err)}`);
      return false;
    }
  }
}
