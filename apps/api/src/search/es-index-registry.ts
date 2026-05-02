/**
 * Elasticsearch index naming registry — aligned with ADR-003 §2.2.
 *
 * Naming convention: <domain>-<entity>-<env>
 * env: resolved from ES_INDEX_SUFFIX env var, falling back to NODE_ENV.
 *      Defaults to "dev" when neither is set, preventing accidental prod writes.
 *
 * S1 scope: three ops-domain indexes only.
 * Customer-domain indexes (customer-faq-{env}-{tenant}, etc.) are introduced in S3 W34-W35.
 */

export const OPS_PRODUCT_KNOWLEDGE = 'ops-product_knowledge' as const;
export const OPS_LISTING_DRAFT = 'ops-listing_draft' as const;
export const OPS_KEYWORD_CORPUS = 'ops-keyword_corpus' as const;

/** Legacy placeholder index introduced in W4. Retained for health checks during migration. */
export const LEGACY_PRODUCTS_INDEX = 'yaemartos_products' as const;

export type OpsIndexName =
  | typeof OPS_PRODUCT_KNOWLEDGE
  | typeof OPS_LISTING_DRAFT
  | typeof OPS_KEYWORD_CORPUS;

/**
 * Resolves the env suffix to use for index names.
 * Priority: ES_INDEX_SUFFIX > NODE_ENV > "dev"
 */
export function resolveIndexEnv(env?: string | undefined): string {
  return env ?? process.env['ES_INDEX_SUFFIX'] ?? process.env['NODE_ENV'] ?? 'dev';
}

/** Builds a fully-qualified index name: `<base>-<env>` */
export function indexName(base: OpsIndexName, env?: string): string {
  return `${base}-${resolveIndexEnv(env)}`;
}

// ─── Common audit fields (ADR-003 §2.4) ─────────────────────────────────────

const AUDIT_FIELDS = {
  source_table: { type: 'keyword' },
  source_id: { type: 'keyword' },
  version: { type: 'long' },
  synced_at: { type: 'date' },
  deleted_at: { type: 'date' },
  created_at: { type: 'date' },
  updated_at: { type: 'date' },
} as const;

// ─── Mappings ─────────────────────────────────────────────────────────────────

/**
 * `ops-product_knowledge-{env}`
 * Category templates + Product content fragments + FAQ/selling-point aggregated search.
 * S1: en-only text fields; locale expansion per ADR-003 §2.5 in S3+.
 */
export const PRODUCT_KNOWLEDGE_MAPPING = {
  settings: {
    number_of_shards: 3,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        english_basic: {
          tokenizer: 'standard',
          filter: ['lowercase', 'english_stop', 'english_stemmer'],
        },
      },
      filter: {
        english_stop: { type: 'stop', stopwords: '_english_' },
        english_stemmer: { type: 'stemmer', language: 'english' },
      },
    },
  },
  mappings: {
    dynamic: 'strict' as const,
    properties: {
      id: { type: 'keyword' },
      product_id: { type: 'keyword' },
      brand: { type: 'keyword' },
      category_id: { type: 'keyword' },
      category_path: { type: 'keyword' },
      /** faq | recipe | spec | feature | warning */
      content_type: { type: 'keyword' },
      /** category_inherit | manual | path_a_lingxing */
      source: { type: 'keyword' },
      title: {
        type: 'object',
        properties: {
          en: { type: 'text', analyzer: 'english_basic' },
        },
      },
      body: {
        type: 'object',
        properties: {
          en: { type: 'text', analyzer: 'english_basic' },
        },
      },
      tags: { type: 'keyword' },
      ...AUDIT_FIELDS,
    },
  },
} as const;

/**
 * `ops-listing_draft-{env}`
 * Listing / ListingVersion content snapshots — full-text + version-dimension filtering.
 * The body stores a searchable text excerpt; the authoritative snapshot remains in PostgreSQL.
 */
export const LISTING_DRAFT_MAPPING = {
  settings: {
    number_of_shards: 3,
    number_of_replicas: 1,
  },
  mappings: {
    dynamic: 'strict' as const,
    properties: {
      id: { type: 'keyword' },
      listing_id: { type: 'keyword' },
      version_number: { type: 'integer' },
      brand_id: { type: 'keyword' },
      market_id: { type: 'keyword' },
      platform_id: { type: 'keyword' },
      shop_id: { type: 'keyword' },
      language: { type: 'keyword' },
      listing_status: { type: 'keyword' },
      version_status: { type: 'keyword' },
      /** Searchable title extracted from contentSnapshot */
      title: { type: 'text', analyzer: 'standard' },
      /** Concatenated bullets + description excerpt (≤ 2000 chars) */
      body_excerpt: { type: 'text', analyzer: 'standard' },
      published_at: { type: 'date' },
      ...AUDIT_FIELDS,
    },
  },
} as const;

/**
 * `ops-keyword_corpus-{env}`
 * Keyword pool — Lingxing + operator-supplied keywords for generation & recommendations.
 */
export const KEYWORD_CORPUS_MAPPING = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
  },
  mappings: {
    dynamic: 'strict' as const,
    properties: {
      id: { type: 'keyword' },
      brand_id: { type: 'keyword' },
      market: { type: 'keyword' },
      platform: { type: 'keyword' },
      keyword: { type: 'text', analyzer: 'standard', fields: { raw: { type: 'keyword' } } },
      /** lingxing | manual | seller_sprite | amazon_suggest */
      source: { type: 'keyword' },
      search_volume: { type: 'long' },
      competition_score: { type: 'float' },
      ...AUDIT_FIELDS,
    },
  },
} as const;

export const OPS_INDEX_CONFIGS = [
  { base: OPS_PRODUCT_KNOWLEDGE, config: PRODUCT_KNOWLEDGE_MAPPING },
  { base: OPS_LISTING_DRAFT, config: LISTING_DRAFT_MAPPING },
  { base: OPS_KEYWORD_CORPUS, config: KEYWORD_CORPUS_MAPPING },
] as const;
