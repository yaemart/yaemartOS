import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Optional,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../iam/casbin.guard';
import { RequirePolicy } from '../../iam/require-policy.decorator';
import { LingxingClient } from '@yaemartos/lingxing-client';
import { PrismaClientManager } from '../../database/prisma.service';

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
  constructor(
    @Optional() private readonly lingxing: LingxingClient | null,
    @Inject(PrismaClientManager) private readonly prismaManager: PrismaClientManager,
  ) {}

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

  /**
   * Lists recent order lookup records cached in the tenant DB.
   * Agents use this to survey what orders customers have recently inquired about.
   */
  @Get('history')
  async listHistory(
    @Query('brandId') brandId: string,
    @Query('customerId') customerId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!brandId) {
      throw new BadRequestException('brandId is required');
    }
    const tenantDb = this.prismaManager.getTenantClient(brandId as 'homtone') as any;
    const take = Math.min(parseInt(limit ?? '20', 10), 100);
    const skip = (Math.max(parseInt(page ?? '1', 10), 1) - 1) * take;

    const where = customerId ? { customerId } : {};
    const [records, total] = await Promise.all([
      tenantDb.orderLookup.findMany({
        where,
        select: {
          id: true,
          customerId: true,
          orderNumber: true,
          resultStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      tenantDb.orderLookup.count({ where }),
    ]);

    return { records, total, page: parseInt(page ?? '1', 10), limit: take };
  }
}
