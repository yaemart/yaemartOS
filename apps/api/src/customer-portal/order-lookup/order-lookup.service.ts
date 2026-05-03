import { createHash } from 'crypto';
import { ForbiddenException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PRISMA_TENANT_CLIENT } from '../../database/database.tokens';
import { TenantPrismaClient } from '../../database/tenant-prisma.types';
import { TurnstileService } from '../../common/captcha/turnstile.service';
import { LingxingClient } from '@yaemartos/lingxing-client';
import type { OrderStatusResult } from '@yaemartos/lingxing-client';

const IP_SALT = process.env.LOOKUP_IP_SALT ?? 'yaemartos-ip-salt';

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
export class OrderLookupService {
  private readonly logger = new Logger(OrderLookupService.name);

  constructor(
    @Inject(PRISMA_TENANT_CLIENT) private readonly tenantDb: TenantPrismaClient,
    private readonly turnstile: TurnstileService,
    @Optional() private readonly lingxing: LingxingClient | null,
  ) {}

  async lookup(
    orderNumber: string,
    email: string,
    turnstileToken: string,
    ip: string,
  ): Promise<OrderLookupResult | OrderLookupNotFound> {
    const captchaOk = await this.turnstile.verify(turnstileToken, ip);
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
        .update(ip + IP_SALT)
        .digest('hex');
      await this.tenantDb.orderLookup.create({
        data: { orderNumber, ipHash, resultStatus },
      });
    } catch (err) {
      this.logger.warn(`Failed to log order lookup: ${String(err)}`);
    }
  }
}
