import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
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
import { ListingService } from './listing.service';
import { ListingVersionService } from './listing-version.service';

@Controller('listings')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class ListingController {
  constructor(
    private readonly listingService: ListingService,
    private readonly versionService: ListingVersionService,
    @Inject(LISTING_GENERATION_SERVICE)
    private readonly listingGeneration: IListingGenerationService,
    private readonly featureFlag: FeatureFlagService,
  ) {}

  @Get()
  @RequirePolicy({ obj: 'listings', act: 'read', field: '*' })
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
    @Req() req?: Request,
  ) {
    const brandId: string | undefined = (req as any)?.resolvedBrandId;
    return this.listingService.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      productId,
      brandId,
      status,
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

    const featureEnabled = this.featureFlag.isEnabled('LISTING_AI', listing.brandId);
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
