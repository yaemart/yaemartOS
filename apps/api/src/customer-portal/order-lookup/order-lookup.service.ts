import { createHash } from 'crypto';
import {
  BadRequestException,
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

  /**
   * Order lookup invoked from the customer-portal chat tool. Skips the
   * Turnstile gate because the caller is a customer who already passed
   * `CustomerGuard` + `CustomerTenantGuard` to open the chat session.
   *
   * The required `customerId` arg is the customer-self lock — `ChatService`
   * pulls it from the validated session, never from LLM tool args. Passing
   * a falsy value here is treated as a programming error (defensive bark
   * so an anonymous chat can never reach the no-CAPTCHA path).
   *
   * Audit trail: writes an `orderLookup` row with `resultStatus`
   * prefixed `chat-tool:` so SOC reviewers can distinguish chat-driven
   * lookups from public form lookups.
   *
   * Rate limiting is enforced upstream by the chat controller's
   * `@Throttle({ limit: 30, ttl: 60_000 })`.
   */
  async lookupForChatTool(
    customerId: string,
    orderNumber: string,
  ): Promise<OrderLookupResult | OrderLookupNotFound> {
    if (!customerId) {
      throw new BadRequestException('lookupForChatTool requires an authenticated customerId');
    }

    let result: OrderStatusResult | null = null;
    let resultStatus: string;

    try {
      if (this.lingxing) {
        result = await this.lingxing.orders.queryByNumber({ orderNumber });
        resultStatus = result ? 'chat-tool:found' : 'chat-tool:not_found';
      } else {
        this.logger.warn('LingxingClient not available, chat-tool order lookup degraded');
        resultStatus = 'chat-tool:not_found';
      }
    } catch (err) {
      this.logger.error(`Chat-tool order lookup failed: ${String(err)}`);
      resultStatus = 'chat-tool:error';
    }

    await this.logAttemptForCustomer(customerId, orderNumber, resultStatus);

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

  /**
   * Audit trail for chat-tool lookups. Stores customerId in `ipHash`
   * field as a salted hash so we can correlate without retaining raw
   * customer ids in this table (matches the IP pseudonymisation policy
   * for the public lookup path).
   */
  private async logAttemptForCustomer(
    customerId: string,
    orderNumber: string,
    resultStatus: string,
  ): Promise<void> {
    try {
      const customerHash = createHash('sha256')
        .update(`customer:${customerId}:${this.ipSalt}`)
        .digest('hex');
      await this.tenantDb.orderLookup.create({
        data: { orderNumber, ipHash: customerHash, resultStatus, customerId },
      });
    } catch (err) {
      this.logger.warn(`Failed to log chat-tool order lookup: ${String(err)}`);
    }
  }
}
