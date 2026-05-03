import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LocaleCode } from '../generated/prisma';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../iam/casbin.guard';
import { RequirePolicy } from '../iam/require-policy.decorator';
import { LocaleService } from './locale.service';

class CreateLocaleDto {
  @IsEnum(LocaleCode) language!: LocaleCode;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

class UpdateLocaleDto {
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Controller('locales')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class LocaleController {
  constructor(private readonly localeService: LocaleService) {}

  /**
   * GET /locales?marketId=xxx
   * Returns all active Locale entries for the given market.
   * Used by the frontend locale switcher and listing editor.
   */
  @Get()
  @RequirePolicy({ obj: 'listings', act: 'read', field: '*' })
  async findByMarket(@Query('marketId') marketId: string) {
    const locales = await this.localeService.findActive(marketId);
    return {
      locales: locales.map((l) => ({
        language: l.language,
        isPrimary: l.isPrimary,
      })),
    };
  }

  /**
   * GET /locales/all?marketId=xxx
   * Returns ALL locales (including inactive) for market management.
   */
  @Get('all')
  @RequirePolicy({ obj: 'settings', act: 'read', field: '*' })
  findAll(@Query('marketId') @IsString() @IsNotEmpty() marketId: string) {
    return this.localeService.findByMarket(marketId);
  }

  @Post(':marketId')
  @RequirePolicy({ obj: 'settings', act: 'write', field: '*' })
  create(@Param('marketId') marketId: string, @Body() dto: CreateLocaleDto) {
    return this.localeService.create(marketId, dto.language, dto.isPrimary);
  }

  @Patch(':marketId/:language')
  @RequirePolicy({ obj: 'settings', act: 'write', field: '*' })
  async update(
    @Param('marketId') marketId: string,
    @Param('language') language: LocaleCode,
    @Body() dto: UpdateLocaleDto,
  ) {
    if (dto.isPrimary === true) {
      return this.localeService.setPrimary(marketId, language);
    }
    if (dto.isActive !== undefined) {
      return this.localeService.setActive(marketId, language, dto.isActive);
    }
    return this.localeService.findByMarket(marketId);
  }

  @Delete(':marketId/:language')
  @RequirePolicy({ obj: 'settings', act: 'write', field: '*' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('marketId') marketId: string, @Param('language') language: LocaleCode) {
    await this.localeService.remove(marketId, language);
  }
}
