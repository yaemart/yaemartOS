import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService } from '../ai/embedding.service';
import { SearchService } from './search.service';
import { CUSTOMER_FAQ_MAPPING, faqIndexName } from './es-index-registry';

export interface FaqItem {
  faqId: string;
  brandId: string;
  locale: string;
  productId?: string;
  question: string;
  answer: string;
}

export interface FaqSearchResult {
  faqId: string;
  question: string;
  answer: string;
  score: number;
}

@Injectable()
export class FaqKnowledgeService {
  private readonly logger = new Logger(FaqKnowledgeService.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Ensures the kNN index exists for the given brand.
   * Idempotent — skips creation if already present.
   */
  async ensureIndex(brandId: string): Promise<void> {
    const client = this.searchService.getClient();
    const idx = faqIndexName(brandId);
    const { body: exists } = await client.indices.exists({ index: idx });
    if (!exists) {
      await client.indices.create({ index: idx, body: CUSTOMER_FAQ_MAPPING as any });
      this.logger.log(`Created FAQ index: ${idx}`);
    }
  }

  /**
   * Embeds the FAQ question and indexes the document into OpenSearch.
   */
  async index(item: FaqItem): Promise<void> {
    const vector = await this.embeddingService.embed(item.question);
    const client = this.searchService.getClient();
    const idx = faqIndexName(item.brandId);

    await client.index({
      index: idx,
      id: item.faqId,
      body: {
        faq_id: item.faqId,
        brand_id: item.brandId,
        locale: item.locale,
        product_id: item.productId ?? null,
        question: item.question,
        answer: item.answer,
        question_vector: vector,
        created_at: new Date().toISOString(),
      },
      refresh: 'wait_for',
    });
  }

  /**
   * Performs kNN semantic search over the FAQ knowledge base.
   * Returns up to `k` results sorted by cosine similarity.
   */
  async search(query: string, brandId: string, locale: string, k = 5): Promise<FaqSearchResult[]> {
    const client = this.searchService.getClient();
    const idx = faqIndexName(brandId);

    const { body: exists } = await client.indices.exists({ index: idx }).catch(() => ({
      body: false,
    }));
    if (!exists) {
      return [];
    }

    const vector = await this.embeddingService.embed(query);

    const { body: response } = await client.search({
      index: idx,
      body: {
        size: k,
        query: {
          knn: {
            question_vector: {
              vector,
              k,
              filter: {
                bool: {
                  must: [{ term: { locale } }, { term: { brand_id: brandId } }],
                },
              },
            },
          },
        },
      },
    });

    const hits = (response.hits?.hits ?? []) as unknown as Array<{
      _id: string;
      _score: number;
      _source: {
        faq_id: string;
        question: string;
        answer: string;
      };
    }>;

    return hits.map((hit) => ({
      faqId: hit._source.faq_id,
      question: hit._source.question,
      answer: hit._source.answer,
      score: hit._score,
    }));
  }

  /**
   * Deletes a single FAQ document from the index.
   */
  async remove(faqId: string, brandId: string): Promise<void> {
    const client = this.searchService.getClient();
    await client.delete({
      index: faqIndexName(brandId),
      id: faqId,
    });
  }
}
