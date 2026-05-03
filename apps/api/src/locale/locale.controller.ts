import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LocaleService } from './locale.service';

@Controller('locales')
@UseGuards(JwtAuthGuard)
export class LocaleController {
  constructor(private readonly localeService: LocaleService) {}

  /**
   * GET /locales?marketId=xxx
   * Returns all active Locale entries for the given market.
   * Used by the frontend locale switcher to render language tabs.
   */
  @Get()
  async findByMarket(@Query('marketId') marketId: string) {
    const locales = await this.localeService.findActive(marketId);
    return {
      locales: locales.map((l) => ({
        language: l.language,
        isPrimary: l.isPrimary,
      })),
    };
  }
}
