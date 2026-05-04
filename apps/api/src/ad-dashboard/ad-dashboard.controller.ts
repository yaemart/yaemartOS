import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
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
import { AdSyncService } from '../ad-sync/ad-sync.service';
import { AdDashboardQueryDto } from './dto/ad-dashboard-query.dto';
import { AdSyncTriggerDto } from './dto/ad-sync-trigger.dto';

@Controller('ads')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class AdDashboardController {
  constructor(
    private readonly adDashboardService: AdDashboardService,
    private readonly adSyncService: AdSyncService,
    private readonly featureFlag: FeatureFlagService,
  ) {}

  @Get('dashboard')
  @RequirePolicy({ obj: 'ads', act: 'read', field: '*' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getDashboard(@Query() dto: AdDashboardQueryDto, @Req() req: Request) {
    // brandId MUST come from CasbinGuard's resolvedBrandId — never from user-supplied query params
    const brandId = (req as any).resolvedBrandId as string | undefined;
    if (!brandId) {
      throw new BadRequestException('Brand context required');
    }

    const enabled = await this.featureFlag.isEnabled('AD_DASHBOARD', brandId);
    if (!enabled) {
      throw new ForbiddenException('Feature not enabled');
    }

    return this.adDashboardService.queryDashboard({ ...dto, brandId });
  }

  @Post('sync')
  @RequirePolicy({ obj: 'ads', act: 'write', field: '*' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async triggerSync(@Body() dto: AdSyncTriggerDto, @Req() req: Request) {
    const brandId = (req as any).resolvedBrandId as string | undefined;
    if (!brandId) {
      throw new BadRequestException('Brand context required');
    }

    return this.adSyncService.syncShopDate(dto.shopId, brandId, dto.date);
  }
}
