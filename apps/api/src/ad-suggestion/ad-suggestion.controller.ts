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

const VALID_LIST_STATUSES = new Set<string>([
  AdSuggestionStatus.pending,
  AdSuggestionStatus.accepted,
  AdSuggestionStatus.rejected,
  AdSuggestionStatus.executed,
  AdSuggestionStatus.expired,
]);

function parseStatus(raw?: string): AdSuggestionStatus | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!VALID_LIST_STATUSES.has(raw)) {
    throw new BadRequestException(
      `Invalid status='${raw}'. Allowed: ${[...VALID_LIST_STATUSES].join(', ')}`,
    );
  }
  return raw as AdSuggestionStatus;
}

function parsePagination(page?: string, limit?: string): { page: number; limit: number } {
  const p = page ? parseInt(page, 10) : 1;
  const l = limit ? parseInt(limit, 10) : 50;
  if (!Number.isFinite(p) || p < 1) {
    throw new BadRequestException('page must be a positive integer');
  }
  if (!Number.isFinite(l) || l < 1) {
    throw new BadRequestException('limit must be a positive integer');
  }
  return { page: p, limit: l };
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
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const brandId = req.resolvedBrandId;
    if (!brandId) {
      throw new BadRequestException('Brand context required');
    }

    const validatedStatus = parseStatus(status);
    const pagination = parsePagination(page, limit);

    return this.suggestionService.list({
      brandId,
      shopId,
      status: validatedStatus,
      page: pagination.page,
      limit: pagination.limit,
    });
  }

  // NOTE: `Get('changes')` and `Post('changes/:changeId/rollback')` MUST appear
  // before `Get(':id')` / `Post(':id/execute')` etc. NestJS resolves routes in
  // declaration order — moving these later would shadow them as `id='changes'`.
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
    const pagination = parsePagination(page, limit);
    return this.suggestionService.listChanges({
      brandId,
      shopId,
      page: pagination.page,
      limit: pagination.limit,
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
