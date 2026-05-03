import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CustomerTenantGuard } from '../customer-tenant.guard';
import { RequireFeatureFlag } from '../../common/feature-flag/require-feature-flag.decorator';
import { FeatureFlagGuard } from '../../common/feature-flag/feature-flag.guard';
import { OrderLookupDto } from './dto/order-lookup.dto';
import { OrderLookupService } from './order-lookup.service';

@Controller('customer/order-lookup')
@UseGuards(CustomerTenantGuard, FeatureFlagGuard)
@RequireFeatureFlag('ORDER_LOOKUP')
export class OrderLookupController {
  constructor(private readonly orderLookupService: OrderLookupService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  lookup(@Body() dto: OrderLookupDto, @Req() req: Request) {
    const ip =
      (req.headers['cf-connecting-ip'] as string) ??
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      'unknown';

    return this.orderLookupService.lookup(dto.orderNumber, dto.turnstileToken, ip);
  }
}
