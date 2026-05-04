import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { TenantSchema } from '@yaemartos/db';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../iam/casbin.guard';
import { RequirePolicy } from '../../iam/require-policy.decorator';
import { PrismaClientManager } from '../../database/prisma.service';

const PAGE_SIZE_MAX = 100;

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, CasbinGuard)
@RequirePolicy({ obj: 'customers', act: 'read', field: '*' })
export class AdminCustomerController {
  constructor(private readonly prismaManager: PrismaClientManager) {}

  /**
   * List customers for a brand. Excludes passwordHash and auth tokens.
   * Query params: brandId (required), search, isActive, page, limit.
   */
  @Get()
  async listCustomers(
    @Query('brandId') brandId: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!brandId) {
      throw new BadRequestException('brandId query parameter is required');
    }

    const tenantDb = this.prismaManager.getTenantClient(brandId as TenantSchema) as any;
    const take = Math.min(parseInt(limit ?? '50', 10), PAGE_SIZE_MAX);
    const skip = (parseInt(page ?? '1', 10) - 1) * take;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [customers, total] = await Promise.all([
      tenantDb.customer.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          isActive: true,
          emailVerifiedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { warranties: true, tickets: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      tenantDb.customer.count({ where }),
    ]);

    return { data: customers, total, page: parseInt(page ?? '1', 10), pageSize: take };
  }

  /**
   * Get a single customer by ID. Excludes passwordHash and auth tokens.
   * Query param: brandId (required).
   */
  @Get(':customerId')
  async getCustomer(@Param('customerId') customerId: string, @Query('brandId') brandId: string) {
    if (!brandId) {
      throw new BadRequestException('brandId query parameter is required');
    }

    const tenantDb = this.prismaManager.getTenantClient(brandId as TenantSchema) as any;
    const customer = await tenantDb.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        warranties: {
          select: { id: true, productSku: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        tickets: {
          select: { id: true, subject: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: { select: { warranties: true, tickets: true } },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found in brand ${brandId}`);
    }
    return customer;
  }
}
