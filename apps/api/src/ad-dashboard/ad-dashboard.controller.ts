import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../iam/casbin.guard';
import { RequirePolicy } from '../iam/require-policy.decorator';
import { FeatureFlagService } from '../common/feature-flag/feature-flag.service';
import { AdDashboardService } from './ad-dashboard.service';
import { AdDashboardQueryDto } from './dto/ad-dashboard-query.dto';

@Controller('ads')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class AdDashboardController {
  constructor(
    private readonly adDashboardService: AdDashboardService,
    private readonly featureFlag: FeatureFlagService,
  ) {}

  @Get('dashboard')
  @RequirePolicy({ obj: 'ads', act: 'read', field: '*' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getDashboard(@Query() dto: AdDashboardQueryDto, @Req() req: Request) {
    const brandId: string | undefined = dto.brandId ?? (req as any)?.resolvedBrandId ?? undefined;

    const enabled = await this.featureFlag.isEnabled('AD_DASHBOARD', brandId);
    if (!enabled) {
      throw new ForbiddenException('Feature not enabled');
    }

    return this.adDashboardService.queryDashboard({ ...dto, brandId });
  }
}
