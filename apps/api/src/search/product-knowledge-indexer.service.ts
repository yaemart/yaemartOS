import { Injectable, Logger } from '@nestjs/common';
import { PrismaClientManager } from '../database/prisma.service';
import { SearchService } from './search.service';
import { OPS_PRODUCT_KNOWLEDGE, indexName } from './es-index-registry';

export type ProductKnowledgeDoc = {
  id: string;
  product_id: string;
  brand: string;
  category_id: string;
  category_path: string;
  content_type: string;
  source: string;
  title: { en: string };
  body: { en: string };
  tags: string[];
  source_table: string;
  source_id: string;
  version: number;
  synced_at: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class ProductKnowledgeIndexerService {
  private readonly logger = new Logger(ProductKnowledgeIndexerService.name);

  constructor(
    private readonly search: SearchService,
    private readonly prismaManager: PrismaClientManager,
  ) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  private get index() {
    return indexName(OPS_PRODUCT_KNOWLEDGE, this.search.getIndexEnv());
  }

  /**
   * Index (or re-index) all ProductContent records for a given product.
   * Each ProductContent row → one ES document.
   */
  async indexProduct(productId: string): Promise<number> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        brand: { select: { id: true, slug: true } },
        category: { select: { id: true, slug: true } },
        contents: true,
      },
    });

    if (!product) {
      this.logger.warn(`indexProduct: product not found ${productId}`);
      return 0;
    }

    const client = this.search.getClient();
    const now = new Date().toISOString();

    const operations = product.contents.flatMap((content) => {
      const payload = (content.payload ?? {}) as Record<string, unknown>;
      const titleEn =
        (payload['title'] as string | undefined) ??
        (payload['titleTemplate'] as string | undefined) ??
        product.title;
      const bodyParts: string[] = [];
      if (payload['sellingPoints']) {
        bodyParts.push(String(payload['sellingPoints']));
      }
      if (payload['descriptionGuide']) {
        bodyParts.push(String(payload['descriptionGuide']));
      }
      if (payload['faqTemplate']) {
        bodyParts.push(String(payload['faqTemplate']));
      }

      const doc: ProductKnowledgeDoc = {
        id: content.id,
        product_id: productId,
        brand: product.brand.slug,
        category_id: product.category.id,
        category_path: product.category.slug,
        content_type: 'spec',
        source: content.source,
        title: { en: titleEn },
        body: { en: bodyParts.join('\n').slice(0, 5000) },
        tags: [],
        source_table: 'ProductContent',
        source_id: content.id,
        version: 1,
        synced_at: now,
        deleted_at: null,
        created_at: content.createdAt.toISOString(),
        updated_at: content.updatedAt.toISOString(),
      };

      return [{ index: { _index: this.index, _id: content.id } }, doc];
    });

    if (operations.length === 0) {
      return 0;
    }

    const { body: bulkRes } = await client.bulk({ body: operations, refresh: true });
    if (bulkRes.errors) {
      this.logger.error(`Bulk index errors for product ${productId}`);
    }

    const count = operations.length / 2;
    this.logger.log(`Indexed ${count} content doc(s) for product ${productId}`);
    return count;
  }

  /**
   * Soft-delete all ES documents for a given product (sets deleted_at).
   */
  async removeProduct(productId: string): Promise<void> {
    const client = this.search.getClient();
    await client.updateByQuery({
      index: this.index,
      body: {
        script: {
          source: `ctx._source.deleted_at = params.now`,
          params: { now: new Date().toISOString() },
        },
        query: { term: { product_id: productId } },
      },
    });
    this.logger.log(`Soft-deleted ES docs for product ${productId}`);
  }
}
