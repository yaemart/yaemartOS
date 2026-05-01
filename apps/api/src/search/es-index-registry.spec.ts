import { describe, it, expect, afterEach } from 'vitest';
import {
  indexName,
  resolveIndexEnv,
  OPS_PRODUCT_KNOWLEDGE,
  OPS_LISTING_DRAFT,
  OPS_KEYWORD_CORPUS,
  OPS_INDEX_CONFIGS,
} from './es-index-registry';

describe('resolveIndexEnv', () => {
  afterEach(() => {
    delete process.env['ES_INDEX_SUFFIX'];
  });

  it('uses ES_INDEX_SUFFIX when set', () => {
    process.env['ES_INDEX_SUFFIX'] = 'staging';
    expect(resolveIndexEnv()).toBe('staging');
  });

  it('falls back to provided env argument', () => {
    expect(resolveIndexEnv('test')).toBe('test');
  });

  it('explicit argument takes precedence over ES_INDEX_SUFFIX', () => {
    process.env['ES_INDEX_SUFFIX'] = 'staging';
    // Explicit env arg wins — callers can always override for test isolation
    expect(resolveIndexEnv('test')).toBe('test');
  });
});

describe('indexName', () => {
  afterEach(() => {
    delete process.env['ES_INDEX_SUFFIX'];
  });

  it('builds correct names for all three ops indexes', () => {
    expect(indexName(OPS_PRODUCT_KNOWLEDGE, 'dev')).toBe('ops-product_knowledge-dev');
    expect(indexName(OPS_LISTING_DRAFT, 'dev')).toBe('ops-listing_draft-dev');
    expect(indexName(OPS_KEYWORD_CORPUS, 'dev')).toBe('ops-keyword_corpus-dev');
  });

  it('uses prod env suffix', () => {
    expect(indexName(OPS_PRODUCT_KNOWLEDGE, 'prod')).toBe('ops-product_knowledge-prod');
  });

  it('uses ES_INDEX_SUFFIX from env', () => {
    process.env['ES_INDEX_SUFFIX'] = 'ci';
    expect(indexName(OPS_PRODUCT_KNOWLEDGE)).toBe('ops-product_knowledge-ci');
  });

  it('all index names follow <domain>-<entity>-<env> convention', () => {
    const env = 'test';
    for (const { base } of OPS_INDEX_CONFIGS) {
      const name = indexName(base, env);
      expect(name).toMatch(/^ops-[a-z_]+-test$/);
    }
  });
});

describe('OPS_INDEX_CONFIGS', () => {
  it('contains exactly three entries', () => {
    expect(OPS_INDEX_CONFIGS).toHaveLength(3);
  });

  it('each entry has base name and config with mappings', () => {
    for (const entry of OPS_INDEX_CONFIGS) {
      expect(entry.base).toBeTruthy();
      expect(entry.config).toHaveProperty('mappings');
      expect(entry.config).toHaveProperty('settings');
    }
  });

  it('all mappings have dynamic: strict', () => {
    for (const { config } of OPS_INDEX_CONFIGS) {
      expect(config.mappings.dynamic).toBe('strict');
    }
  });

  it('all mappings include audit fields', () => {
    const auditFields = ['source_table', 'source_id', 'version', 'synced_at', 'deleted_at'];
    for (const { config } of OPS_INDEX_CONFIGS) {
      for (const field of auditFields) {
        expect((config.mappings.properties as Record<string, unknown>)[field]).toBeTruthy();
      }
    }
  });
});
