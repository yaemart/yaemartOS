import { Body, Controller, Get, Param, Put, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../iam/casbin.guard';
import { RequirePolicy } from '../iam/require-policy.decorator';
import { SettingsService } from './settings.service';
import { UpsertConfigDto } from './dto/upsert-config.dto';
import { UpdateBrandThemeDto } from './dto/update-brand-theme.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** Connection health: which services have env vars configured. */
  @Get('connections')
  @RequirePolicy({ obj: 'settings', act: 'read' })
  getConnections() {
    return this.settingsService.getConnectionHealth();
  }

  /** Feature flags: all flags with current DB-stored values. */
  @Get('feature-flags')
  @RequirePolicy({ obj: 'settings', act: 'read' })
  getFeatureFlags() {
    return this.settingsService.getByCategory('feature_flag');
  }

  /** Upsert a single feature flag. Key must start with "feature_flag.". */
  @Put('feature-flags/:key(*)')
  @RequirePolicy({ obj: 'settings', act: 'write' })
  upsertFeatureFlag(@Param('key') key: string, @Body() dto: UpsertConfigDto, @Req() req: Request) {
    const user = req.user as { id?: string } | undefined;
    const fullKey = key.startsWith('feature_flag.') ? key : `feature_flag.${key}`;
    return this.settingsService.upsert(fullKey, 'feature_flag', dto, user?.id);
  }

  /** AI routing config: all routing rules. */
  @Get('ai-routing')
  @RequirePolicy({ obj: 'settings', act: 'read' })
  getAiRouting() {
    return this.settingsService.getByCategory('ai_routing');
  }

  /** Upsert a single AI routing rule. Key must start with "ai_routing.". */
  @Put('ai-routing/:key(*)')
  @RequirePolicy({ obj: 'settings', act: 'write' })
  upsertAiRouting(@Param('key') key: string, @Body() dto: UpsertConfigDto, @Req() req: Request) {
    const user = req.user as { id?: string } | undefined;
    const fullKey = key.startsWith('ai_routing.') ? key : `ai_routing.${key}`;
    return this.settingsService.upsert(fullKey, 'ai_routing', dto, user?.id);
  }

  /** AI cost summary: current month spend vs budgets with alert flags. */
  @Get('ai-cost')
  @RequirePolicy({ obj: 'settings', act: 'read' })
  getAiCost() {
    return this.settingsService.getAiCostSummary();
  }

  /** Upsert a single AI budget config. Key must start with "ai_budget.". */
  @Put('ai-budget/:key(*)')
  @RequirePolicy({ obj: 'settings', act: 'write' })
  upsertAiBudget(@Param('key') key: string, @Body() dto: UpsertConfigDto, @Req() req: Request) {
    const user = req.user as { id?: string } | undefined;
    const fullKey = key.startsWith('ai_budget.') ? key : `ai_budget.${key}`;
    return this.settingsService.upsert(fullKey, 'ai_budget', dto, user?.id);
  }

  /** List brands with theme fields. */
  @Get('brands')
  @RequirePolicy({ obj: 'settings', act: 'read' })
  getBrands() {
    return this.settingsService.getBrands();
  }

  /** Update a brand's theme (themeColor, logoUrl, name). */
  @Patch('brands/:id')
  @RequirePolicy({ obj: 'settings', act: 'write' })
  updateBrandTheme(@Param('id') id: string, @Body() dto: UpdateBrandThemeDto, @Req() req: Request) {
    const user = req.user as { id?: string } | undefined;
    return this.settingsService.updateBrandTheme(id, dto, user?.id);
  }
}
