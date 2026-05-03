import { createHash } from 'crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PRISMA_TENANT_CLIENT } from '../../database/database.tokens';
import { TenantPrismaClient } from '../../database/tenant-prisma.types';
import { TurnstileService } from '../../common/captcha/turnstile.service';
import { LingxingClient } from '@yaemartos/lingxing-client';
import type { OrderStatusResult } from '@yaemartos/lingxing-client';

export interface OrderLookupResult {
  found: true;
  orderNumber: string;
  status: string;
  trackingNumber: string | null;
  estimatedDelivery: string | null;
}

export interface OrderLookupNotFound {
  found: false;
  message: string;
}

@Injectable()
export class OrderLookupService implements OnModuleInit {
  private readonly logger = new Logger(OrderLookupService.name);
  private ipSalt!: string;

  constructor(
    @Inject(PRISMA_TENANT_CLIENT) private readonly tenantDb: TenantPrismaClient,
    private readonly turnstile: TurnstileService,
    private readonly config: ConfigService,
    @Optional() private readonly lingxing: LingxingClient | null,
  ) {}

  onModuleInit() {
    const salt = this.config.get<string>('LOOKUP_IP_SALT');
    if (!salt && process.env.NODE_ENV === 'production') {
      throw new Error(
        'LOOKUP_IP_SALT is not configured. Set this env var to prevent IP pseudonymisation reversal.',
      );
    }
    this.ipSalt = salt ?? 'yaemartos-ip-salt-dev';
  }

  async lookup(
    orderNumber: string,
    turnstileToken: string,
    ip: string,
  ): Promise<OrderLookupResult | OrderLookupNotFound> {
    // verifyOrThrow distinguishes invalid (→ 403) from unavailable (→ 503)
    const captchaOk = await this.turnstile.verifyOrThrow(turnstileToken, ip);
    if (!captchaOk) {
      await this.logAttempt(orderNumber, ip, 'captcha_failed');
      throw new ForbiddenException('CAPTCHA_FAILED');
    }

    let result: OrderStatusResult | null = null;
    let resultStatus: string;

    try {
      if (this.lingxing) {
        result = await this.lingxing.orders.queryByNumber({ orderNumber });
        resultStatus = result ? 'found' : 'not_found';
      } else {
        this.logger.warn('LingxingClient not available, order lookup degraded');
        resultStatus = 'not_found';
      }
    } catch (err) {
      this.logger.error(`Order lookup failed: ${String(err)}`);
      resultStatus = 'error';
    }

    await this.logAttempt(orderNumber, ip, resultStatus);

    if (!result) {
      return { found: false, message: 'Order not found. Please contact support.' };
    }

    return {
      found: true,
      orderNumber: result.orderNumber,
      status: result.status,
      trackingNumber: result.trackingNumber,
      estimatedDelivery: result.estimatedDelivery,
    };
  }

  private async logAttempt(orderNumber: string, ip: string, resultStatus: string): Promise<void> {
    try {
      const ipHash = createHash('sha256')
        .update(ip + this.ipSalt)
        .digest('hex');
      await this.tenantDb.orderLookup.create({
        data: { orderNumber, ipHash, resultStatus },
      });
    } catch (err) {
      this.logger.warn(`Failed to log order lookup: ${String(err)}`);
    }
  }
}
