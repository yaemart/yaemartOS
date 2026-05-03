import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { GenerateListingInput } from '@yaemartos/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../iam/casbin.guard';
import { RequirePolicy } from '../iam/require-policy.decorator';
import type { IListingGenerationService } from '../ai/interfaces/listing-generation.interface';
import { LISTING_GENERATION_SERVICE } from '../ai/tokens';
import { FeatureFlagService } from '../common/feature-flag/feature-flag.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { BatchGenerateListingDto } from './dto/batch-generate-listing.dto';
import { ListingService } from './listing.service';
import { ListingVersionService } from './listing-version.service';
import { TerminologyService } from '../terminology/terminology.service';
import type { LocaleCode } from '../generated/prisma';

@Controller('listings')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class ListingController {
  constructor(
    private readonly listingService: ListingService,
    private readonly versionService: ListingVersionService,
    @Inject(LISTING_GENERATION_SERVICE)
    private readonly listingGeneration: IListingGenerationService,
    private readonly featureFlag: FeatureFlagService,
    private readonly terminologyService: TerminologyService,
  ) {}

  /**
   * GET /listings/matrix?productId=xxx
   * Returns a matrix analysis for all listings of a given product:
   * - similarity matrix (embedding cosine distance between titles)
   * - traffic strategy distribution
   * Sales/impression data is deferred to S4; the field `salesAvailableFrom` signals this.
   */
  @Get('matrix')
  @RequirePolicy({ obj: 'listings', act: 'read', field: '*' })
  async getMatrix(@Query('productId') productId: string, @Req() req: Request) {
    if (!productId) {
      throw new BadRequestException('productId query param is required');
    }
    const brandId: string | undefined = (req as any)?.resolvedBrandId;
    if (!brandId) {
      throw new BadRequestException('x-yaemart-brand header is required');
    }
    return this.listingService.getMatrix(productId, brandId);
  }

  @Get()
  @RequirePolicy({ obj: 'listings', act: 'read', field: '*' })
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
    @Query('shopId') shopId?: string,
    @Query('platformId') platformId?: string,
    @Req() req?: Request,
  ) {
    const brandId: string | undefined = (req as any)?.resolvedBrandId;
    return this.listingService.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      productId,
      brandId,
      status,
      shopId,
      platformId,
    });
  }

  @Get(':id')
  @RequirePolicy({ obj: 'listings', act: 'read', field: '*' })
  async getById(@Param('id') id: string) {
    return this.listingService.getById(id);
  }

  @Post()
  @RequirePolicy({ obj: 'listings', act: 'write', field: '*' })
  async create(@Body() body: CreateListingDto, @Req() req: Request) {
    return this.listingService.create(body, this.actor(req));
  }

  @Patch(':id')
  @RequirePolicy({ obj: 'listings', act: 'write', field: '*' })
  async update(@Param('id') id: string, @Body() body: UpdateListingDto, @Req() req: Request) {
    return this.listingService.update(id, body, this.actor(req));
  }

  @Delete(':id')
  @RequirePolicy({ obj: 'listings', act: 'write', field: '*' })
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.listingService.remove(id, this.actor(req));
  }

  /**
   * POST /listings/batch-generate
   * Generates Listing drafts for the same product across multiple shops/platforms in parallel.
   * Supports multi-language generation via `languages: string[]` (Cartesian product of
   * languages × targets). Falls back to single `language` for backward compatibility.
   * Each combo results in an independent Listing record + a draft ListingVersion.
   * Partial failures are surfaced per-target; the endpoint returns 200 unless all combos fail.
   */
  @Post('batch-generate')
  @RequirePolicy({ obj: 'listings', act: 'write', field: '*' })
  @HttpCode(HttpStatus.OK)
  async batchGenerate(@Body() body: BatchGenerateListingDto, @Req() req: Request) {
    if (!body.targets || body.targets.length === 0) {
      throw new BadRequestException('targets must be a non-empty array');
    }

    // Resolve language list: prefer `languages` array, fall back to single `language`
    const baseLanguages: string[] = body.languages?.length
      ? body.languages
      : body.language
        ? [body.language]
        : [];
    if (baseLanguages.length === 0) {
      throw new BadRequestException('Either "languages" or "language" must be provided');
    }

    const featureEnabled = await this.featureFlag.isEnabled('LISTING_AI', body.brandId);
    if (!featureEnabled) {
      throw new ForbiddenException(
        'Listing AI generation is currently disabled (feature flag off)',
      );
    }

    // Feature flag: when MULTILINGUAL_LISTING_GENERATION is off, restrict to EN only
    const multilingualEnabled = await this.featureFlag.isEnabled(
      'MULTILINGUAL_LISTING_GENERATION',
      body.brandId,
    );
    const resolvedLanguages = multilingualEnabled ? baseLanguages : ['en'];

    const actor = this.actor(req);

    // Cartesian product: resolvedLanguages × targets
    const combos = resolvedLanguages.flatMap((lang) =>
      body.targets.map((target) => ({ lang, target })),
    );

    const results = await Promise.allSettled(
      combos.map(async ({ lang, target }) => {
        const platformId = await this.listingService.resolvePlatformId(target.platformCode);

        const listing = await this.listingService.findOrCreateDraft({
          productId: body.productId,
          brandId: body.brandId,
          marketId: body.marketId,
          platformId,
          shopId: target.shopId,
          language: lang,
          platformListingId: target.platformListingId,
        });

        // Inject terminology — degrade gracefully on failure
        const terminology = await this.terminologyService
          .findByBrandAndLocale(body.brandId, lang as LocaleCode)
          .catch(() => []);

        const input: GenerateListingInput = {
          brandId: body.brandId as any,
          platform: target.platformCode as any,
          productTitle: body.productTitle,
          productCategory: body.productCategory,
          targetLocale: lang as any,
          competitorUrls: target.competitorUrls,
          manualSellingPoints: target.manualSellingPoints,
          categoryLexicon: target.categoryLexicon,
          lingxingKeywordSeed: target.lingxingKeywordSeed,
          terminology: terminology.map((t) => ({ term: t.term, definition: t.definition })),
        };

        const content = await this.listingGeneration.generateListing(input);
        const version = await this.versionService.createVersion(
          listing.id,
          content,
          actor,
          'draft',
        );

        return {
          listingId: listing.id,
          shopId: target.shopId,
          platformCode: target.platformCode,
          language: lang,
          versionNumber: version.versionNumber,
          status: 'completed' as const,
        };
      }),
    );

    const mapped = results.map((r, i) => {
      const combo = combos[i]!;
      if (r.status === 'fulfilled') {
        return r.value;
      }
      return {
        listingId: null,
        shopId: combo.target.shopId,
        platformCode: combo.target.platformCode,
        language: combo.lang,
        versionNumber: null,
        status: 'failed' as const,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      };
    });

    const allFailed = mapped.every((r) => r.status === 'failed');
    if (allFailed) {
      throw new BadRequestException({
        message: 'All batch generation targets failed',
        results: mapped,
      });
    }

    return { results: mapped };
  }

  /**
   * POST /listings/:id/generate
   * Generates a new draft ListingVersion using the AI listing generation service.
   * Guarded by feature flag FEATURE_LISTING_AI (set to 'true' to enable).
   * AI output is always written as a draft version — never auto-activated (P0 audit rule).
   */
  @Post(':id/generate')
  @RequirePolicy({ obj: 'listings', act: 'write', field: '*' })
  @HttpCode(HttpStatus.CREATED)
  async generateListing(
    @Param('id') id: string,
    @Body()
    body: {
      productTitle: string;
      productCategory: string;
      competitorUrls?: string[];
      manualSellingPoints?: string;
      categoryLexicon?: string[];
      lingxingKeywordSeed?: string[];
    },
    @Req() req: Request,
  ) {
    const listing = await this.listingService.getById(id);

    const featureEnabled = await this.featureFlag.isEnabled('LISTING_AI', listing.brandId);
    if (!featureEnabled) {
      throw new ForbiddenException(
        'Listing AI generation is currently disabled (feature flag off)',
      );
    }

    const input: GenerateListingInput = {
      brandId: listing.brandId as any,
      platform: listing.platform.code as any,
      productTitle: body.productTitle,
      productCategory: body.productCategory,
      targetLocale: listing.language as any,
      competitorUrls: body.competitorUrls,
      manualSellingPoints: body.manualSellingPoints,
      categoryLexicon: body.categoryLexicon,
      lingxingKeywordSeed: body.lingxingKeywordSeed,
    };

    const content = await this.listingGeneration.generateListing(input);
    const actor = this.actor(req);

    return this.versionService.createVersion(id, content, actor, 'draft');
  }

  @Get(':id/versions')
  @RequirePolicy({ obj: 'listings', act: 'read', field: '*' })
  async listVersions(@Param('id') id: string) {
    return this.versionService.listVersions(id);
  }

  @Patch(':id/versions/:versionNumber/activate')
  @RequirePolicy({ obj: 'listings', act: 'write', field: '*' })
  @HttpCode(HttpStatus.OK)
  async activateVersion(
    @Param('id') id: string,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
    @Req() req: Request,
  ) {
    return this.versionService.activateVersion(id, versionNumber, this.actor(req));
  }

  private actor(req: Request): { id?: string; brandId?: string } {
    const user = req.user as { id?: string; brandId?: string } | undefined;
    return { id: user?.id, brandId: user?.brandId };
  }
}
