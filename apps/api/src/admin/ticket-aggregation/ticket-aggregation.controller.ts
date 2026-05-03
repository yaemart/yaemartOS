import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../iam/casbin.guard';
import { RequirePolicy } from '../../iam/require-policy.decorator';
import { TicketAggregationService } from './ticket-aggregation.service';

@Controller('admin/tickets')
@UseGuards(JwtAuthGuard, CasbinGuard)
@RequirePolicy({ obj: 'tickets', act: 'read', field: '*' })
export class TicketAggregationController {
  constructor(private readonly aggregationService: TicketAggregationService) {}

  /**
   * Returns tickets across all brands.
   * Requires admin-level IAM (brand=* is enforced by Casbin policy).
   */
  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('brandId') brandId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.aggregationService.findAll({
      status,
      priority,
      brandId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }
}
