import { Injectable, Logger } from '@nestjs/common';
import { SearchService } from './search.service';
import { OPS_KEYWORD_CORPUS, indexName } from './es-index-registry';

export type KeywordSource = 'lingxing' | 'manual' | 'seller_sprite' | 'amazon_suggest';

export type KeywordImportItem = {
  keyword: string;
  brandId: string;
  market: string;
  platform: string;
  source: KeywordSource;
  searchVolume?: number;
  competitionScore?: number;
};

export type KeywordCorpusDoc = {
  id: string;
  brand_id: string;
  market: string;
  platform: string;
  keyword: string;
  source: KeywordSource;
  search_volume: number;
  competition_score: number;
  source_table: string;
  source_id: string;
  version: number;
  synced_at: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Max items per bulk request to avoid oversized payloads. */
const CHUNK_SIZE = 500;

@Injectable()
export class KeywordCorpusIndexerService {
  private readonly logger = new Logger(KeywordCorpusIndexerService.name);

  constructor(private readonly search: SearchService) {}

  private get index() {
    return indexName(OPS_KEYWORD_CORPUS, this.search.getIndexEnv());
  }

  /**
   * Bulk-import keywords into `ops-keyword_corpus-{env}`.
   * Uses a deterministic document id (`brandId:market:platform:keyword:source`)
   * so upserts are idempotent.
   *
   * @returns Number of documents indexed.
   */
  async importKeywords(items: KeywordImportItem[]): Promise<number> {
    if (items.length === 0) {
      return 0;
    }

    const client = this.search.getClient();
    const now = new Date().toISOString();
    let total = 0;

    for (let offset = 0; offset < items.length; offset += CHUNK_SIZE) {
      const chunk = items.slice(offset, offset + CHUNK_SIZE);

      const operations = chunk.flatMap((item) => {
        const docId = [item.brandId, item.market, item.platform, item.keyword, item.source]
          .join(':')
          .replace(/\s+/g, '_');

        const doc: KeywordCorpusDoc = {
          id: docId,
          brand_id: item.brandId,
          market: item.market,
          platform: item.platform,
          keyword: item.keyword,
          source: item.source,
          search_volume: item.searchVolume ?? 0,
          competition_score: item.competitionScore ?? 0,
          source_table: 'keyword_corpus',
          source_id: docId,
          version: 1,
          synced_at: now,
          deleted_at: null,
          created_at: now,
          updated_at: now,
        };

        return [{ index: { _index: this.index, _id: docId } }, doc];
      });

      const { body: bulkRes } = await client.bulk({ body: operations, refresh: false });
      if (bulkRes.errors) {
        this.logger.error(`Bulk errors in keyword import chunk offset=${offset}`);
      }
      total += chunk.length;
    }

    this.logger.log(`Imported ${total} keywords into ${this.index}`);
    return total;
  }

  /**
   * Delete all keyword documents for a specific brand + market + platform scope.
   */
  async clearScope(brandId: string, market: string, platform: string): Promise<void> {
    const client = this.search.getClient();
    await client.deleteByQuery({
      index: this.index,
      body: {
        query: {
          bool: {
            must: [{ term: { brand_id: brandId } }, { term: { market } }, { term: { platform } }],
          },
        },
      },
    });
    this.logger.log(`Cleared keywords for ${brandId}/${market}/${platform}`);
  }
}
