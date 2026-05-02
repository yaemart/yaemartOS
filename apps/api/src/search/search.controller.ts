import { Body, Controller, Get, HttpCode, Logger, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../iam/casbin.guard';
import { RequirePolicy } from '../iam/require-policy.decorator';
import { KeywordCorpusIndexerService, KeywordImportItem } from './keyword-corpus-indexer.service';
import { SearchService } from './search.service';
import { OPS_KEYWORD_CORPUS, OPS_LISTING_DRAFT, indexName } from './es-index-registry';

type QueryClause = Record<string, unknown>;

@Controller('search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly keywordCorpusIndexer: KeywordCorpusIndexerService,
  ) {}

  @Get('health')
  @UseGuards(JwtAuthGuard)
  async health() {
    return this.searchService.health();
  }

  @Post('bootstrap')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, CasbinGuard)
  @RequirePolicy({ obj: 'search', act: 'write', field: '*' })
  async bootstrap() {
    return this.searchService.bootstrap();
  }

  /**
   * Full-text search over listing drafts.
   * GET /search/listing-draft?q=eco+friendly&brandId=homtone&status=draft
   */
  @Get('listing-draft')
  @UseGuards(JwtAuthGuard, CasbinGuard)
  @RequirePolicy({ obj: 'listings', act: 'read', field: '*' })
  async searchListingDraft(
    @Query('q') q: string,
    @Query('brandId') brandId?: string,
    @Query('status') status?: string,
    @Query('from') from = '0',
    @Query('size') size = '20',
  ) {
    const t0 = Date.now();
    const client = this.searchService.getClient();
    const idx = indexName(OPS_LISTING_DRAFT, this.searchService.getIndexEnv());

    const mustClauses: QueryClause[] = q
      ? [{ multi_match: { query: q, fields: ['title^3', 'body_excerpt'], type: 'best_fields' } }]
      : [{ match_all: {} }];

    const filterClauses: QueryClause[] = [
      { bool: { must_not: [{ exists: { field: 'deleted_at' } }] } },
    ];
    if (brandId) {
      filterClauses.push({ term: { brand_id: brandId } });
    }
    if (status) {
      filterClauses.push({ term: { version_status: status } });
    }

    const { body: result } = await client.search({
      index: idx,
      from: Number(from),
      size: Math.min(Number(size), 100),
      body: {
        query: { bool: { must: mustClauses, filter: filterClauses } },
        _source: [
          'listing_id',
          'version_number',
          'brand_id',
          'language',
          'listing_status',
          'version_status',
          'title',
          'body_excerpt',
          'published_at',
          'updated_at',
        ],
      },
    });

    const latencyMs = Date.now() - t0;
    this.logger.log(`listing-draft search latency=${latencyMs}ms hits=${result.hits.total}`);

    return {
      hits: result.hits.hits.map((h: any) => ({ _id: h._id, ...h._source })),
      total: typeof result.hits.total === 'object' ? result.hits.total.value : result.hits.total,
      latencyMs,
    };
  }

  /**
   * Keyword corpus search — used by AI listing generation for seed keywords.
   * GET /search/keywords?q=eco+friendly&brandId=homtone&platform=amazon
   */
  @Get('keywords')
  @UseGuards(JwtAuthGuard, CasbinGuard)
  @RequirePolicy({ obj: 'listings', act: 'read', field: '*' })
  async searchKeywords(
    @Query('q') q: string,
    @Query('brandId') brandId?: string,
    @Query('platform') platform?: string,
    @Query('from') from = '0',
    @Query('size') size = '20',
  ) {
    const t0 = Date.now();
    const client = this.searchService.getClient();
    const idx = indexName(OPS_KEYWORD_CORPUS, this.searchService.getIndexEnv());

    const mustClauses: QueryClause[] = q
      ? [{ match: { keyword: { query: q, operator: 'and' } } }]
      : [{ match_all: {} }];

    const filterClauses: QueryClause[] = [];
    if (brandId) {
      filterClauses.push({ term: { brand_id: brandId } });
    }
    if (platform) {
      filterClauses.push({ term: { platform } });
    }

    const { body: result } = await client.search({
      index: idx,
      from: Number(from),
      size: Math.min(Number(size), 200),
      body: {
        query: {
          bool: {
            must: mustClauses,
            ...(filterClauses.length ? { filter: filterClauses } : {}),
          },
        },
        sort: [{ search_volume: { order: 'desc' } }, '_score'],
        _source: [
          'keyword',
          'brand_id',
          'market',
          'platform',
          'source',
          'search_volume',
          'competition_score',
        ],
      },
    });

    const latencyMs = Date.now() - t0;
    this.logger.log(`keyword search latency=${latencyMs}ms hits=${result.hits.total}`);

    return {
      hits: result.hits.hits.map((h: any) => ({ _id: h._id, ...h._source })),
      total: typeof result.hits.total === 'object' ? result.hits.total.value : result.hits.total,
      latencyMs,
    };
  }

  /**
   * Admin endpoint: bulk-import keywords into the corpus.
   * POST /search/keywords/import
   * Body: { items: KeywordImportItem[] }
   */
  @Post('keywords/import')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, CasbinGuard)
  @RequirePolicy({ obj: 'listings', act: 'write', field: '*' })
  async importKeywords(@Body() body: { items: KeywordImportItem[] }) {
    const count = await this.keywordCorpusIndexer.importKeywords(body.items ?? []);
    return { imported: count };
  }
}
