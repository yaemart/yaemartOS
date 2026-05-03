import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CustomerTenantGuard } from '../customer-tenant.guard';
import { RequireFeatureFlag } from '../../common/feature-flag/require-feature-flag.decorator';
import { FeatureFlagGuard } from '../../common/feature-flag/feature-flag.guard';
import { ManualService } from './manual.service';

const MANUAL_THROTTLE = { default: { limit: 20, ttl: 60000 } } as const;

@Controller('customer/manuals')
@UseGuards(CustomerTenantGuard, FeatureFlagGuard)
@RequireFeatureFlag('MANUAL_DOWNLOAD')
export class ManualController {
  constructor(private readonly manualService: ManualService) {}

  /** List all available manuals, optionally filtered by productSku. */
  @Get()
  @Throttle(MANUAL_THROTTLE)
  listManuals(@Query('sku') sku?: string) {
    return this.manualService.listManuals(sku);
  }

  /** Get a specific manual by SKU and locale (falls back to 'en' if not found). */
  @Get(':sku/:locale')
  @Throttle(MANUAL_THROTTLE)
  getManual(@Param('sku') sku: string, @Param('locale') locale: string) {
    return this.manualService.getManual(sku, locale);
  }
}
