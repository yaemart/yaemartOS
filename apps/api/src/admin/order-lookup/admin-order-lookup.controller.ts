import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Optional,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../iam/casbin.guard';
import { RequirePolicy } from '../../iam/require-policy.decorator';
import { LingxingClient } from '@yaemartos/lingxing-client';

class AdminOrderLookupDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  orderNumber!: string;
}

/**
 * Operator-side order lookup — no CAPTCHA required.
 * Support agents can query order status on behalf of customers.
 */
@Controller('admin/order-lookup')
@UseGuards(JwtAuthGuard, CasbinGuard)
@RequirePolicy({ obj: 'order_lookup', act: 'read', field: '*' })
export class AdminOrderLookupController {
  constructor(@Optional() private readonly lingxing: LingxingClient | null) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async lookup(@Body() dto: AdminOrderLookupDto) {
    if (!this.lingxing) {
      throw new BadRequestException(
        'Order lookup is not available (LingxingClient not configured)',
      );
    }
    const result = await this.lingxing.orders.queryByNumber({ orderNumber: dto.orderNumber });
    if (!result) {
      return { found: false, message: 'Order not found.' };
    }
    return {
      found: true,
      orderNumber: result.orderNumber,
      status: result.status,
      trackingNumber: result.trackingNumber,
      estimatedDelivery: result.estimatedDelivery,
    };
  }
}
