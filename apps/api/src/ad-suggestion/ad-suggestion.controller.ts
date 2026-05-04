import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { AiRateLimitGuard } from '../ai/rate-limit/ai-rate-limit.guard';
import { AiRateLimit } from '../ai/rate-limit/ai-rate-limit.decorator';
import { AdSuggestionService } from './ad-suggestion.service';
import { GenerateSuggestionDto } from './dto/generate-suggestion.dto';
import { AdSuggestionStatus } from '../generated/prisma';

interface AuthRequest extends Request {
  user?: { sub?: string; userId?: string };
  resolvedBrandId?: string;
}

@Controller('ads/suggestions')
@UseGuards(JwtAuthGuard, CasbinGuard, AiRateLimitGuard)
export class AdSuggestionController {
  constructor(
    private readonly suggestionService: AdSuggestionService,
    private readonly featureFlag: FeatureFlagService,
  ) {}

  @Post('generate')
  @RequirePolicy({ obj: 'ads', act: 'write', field: '*' })
  @AiRateLimit({ model: 'glm-4-flash', requestsPerMinute: 10 })
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async generate(@Body() dto: GenerateSuggestionDto, @Req() req: AuthRequest) {
    const brandId = req.resolvedBrandId;
    if (!brandId) {
      throw new BadRequestException('Brand context required');
    }

    const enabled = await this.featureFlag.isEnabled('AD_SUGGESTION', brandId);
    if (!enabled) {
      throw new ForbiddenException('Feature not enabled');
    }

    const userId = req.user?.sub ?? req.user?.userId;
    return this.suggestionService.generate({
      shopId: dto.shopId,
      brandId,
      userId,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });
  }

  @Get()
  @RequirePolicy({ obj: 'ads', act: 'read', field: '*' })
  async list(
    @Req() req: AuthRequest,
    @Query('shopId') shopId?: string,
    @Query('status') status?: AdSuggestionStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const brandId = req.resolvedBrandId;
    if (!brandId) {
      throw new BadRequestException('Brand context required');
    }

    return this.suggestionService.list({
      brandId,
      shopId,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('changes')
  @RequirePolicy({ obj: 'ads', act: 'read', field: '*' })
  async listChanges(
    @Req() req: AuthRequest,
    @Query('shopId') shopId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const brandId = req.resolvedBrandId;
    if (!brandId) {
      throw new BadRequestException('Brand context required');
    }
    return this.suggestionService.listChanges({
      brandId,
      shopId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Post('changes/:changeId/rollback')
  @RequirePolicy({ obj: 'ads', act: 'write', field: '*' })
  @HttpCode(HttpStatus.OK)
  async rollback(@Param('changeId') changeId: string, @Req() req: AuthRequest) {
    const brandId = req.resolvedBrandId;
    if (!brandId) {
      throw new BadRequestException('Brand context required');
    }
    const userId = req.user?.sub ?? req.user?.userId;
    return this.suggestionService.rollback(changeId, brandId, userId);
  }

  @Get(':id')
  @RequirePolicy({ obj: 'ads', act: 'read', field: '*' })
  async findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    const brandId = req.resolvedBrandId;
    if (!brandId) {
      throw new BadRequestException('Brand context required');
    }
    return this.suggestionService.findOne(id, brandId);
  }

  @Post(':id/execute')
  @RequirePolicy({ obj: 'ads', act: 'write', field: '*' })
  @HttpCode(HttpStatus.OK)
  async execute(@Param('id') id: string, @Req() req: AuthRequest) {
    const brandId = req.resolvedBrandId;
    if (!brandId) {
      throw new BadRequestException('Brand context required');
    }
    const userId = req.user?.sub ?? req.user?.userId;
    return this.suggestionService.execute(id, brandId, userId);
  }

  @Post(':id/reject')
  @RequirePolicy({ obj: 'ads', act: 'write', field: '*' })
  @HttpCode(HttpStatus.OK)
  async reject(@Param('id') id: string, @Req() req: AuthRequest) {
    const brandId = req.resolvedBrandId;
    if (!brandId) {
      throw new BadRequestException('Brand context required');
    }
    const userId = req.user?.sub ?? req.user?.userId;
    return this.suggestionService.reject(id, brandId, userId);
  }
}
