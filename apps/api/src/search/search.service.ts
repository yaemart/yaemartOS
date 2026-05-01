import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import {
  indexName,
  LEGACY_PRODUCTS_INDEX,
  OPS_INDEX_CONFIGS,
  type OpsIndexName,
} from './es-index-registry';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private esClient: Client | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const node = this.config.get<string>('ELASTICSEARCH_URL');
    if (!node) {
      this.logger.warn('ELASTICSEARCH_URL not set — search module disabled');
      return;
    }
    this.esClient = new Client({ node });
    this.logger.log(`Elasticsearch client initialised → ${node}`);
  }

  /**
   * Returns the underlying ES client.
   * Indexer services should call this and handle null (disabled) gracefully.
   */
  get client(): Client | null {
    return this.esClient;
  }

  /**
   * Bootstrap all three ADR-003 ops-domain indexes plus the legacy placeholder.
   * Idempotent: skips creation if index already exists.
   * Returns a summary of each index creation attempt.
   */
  async bootstrap(): Promise<{ results: Array<{ index: string; created: boolean }> }> {
    if (!this.esClient) {
      throw new Error('Elasticsearch client not initialised');
    }

    const results: Array<{ index: string; created: boolean }> = [];

    for (const { base, config } of OPS_INDEX_CONFIGS) {
      const name = indexName(base as OpsIndexName);
      const created = await this.ensureIndex(name, config);
      results.push({ index: name, created });
    }

    // Keep legacy index alive during migration period (W4 backward compat)
    const legacyCreated = await this.ensureIndex(LEGACY_PRODUCTS_INDEX, {
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: {
        dynamic: 'strict' as const,
        properties: {
          title: { type: 'text', analyzer: 'standard' },
          brand: { type: 'keyword' },
          asin: { type: 'keyword' },
          status: { type: 'keyword' },
          updatedAt: { type: 'date' },
        },
      },
    });
    results.push({ index: LEGACY_PRODUCTS_INDEX, created: legacyCreated });

    return { results };
  }

  async health(): Promise<{ status: string; info?: Record<string, unknown> }> {
    if (!this.esClient) {
      return { status: 'disabled', info: { reason: 'ELASTICSEARCH_URL not set' } };
    }

    try {
      const res = await this.esClient.cluster.health();
      return {
        status: res.status === 'red' ? 'degraded' : 'up',
        info: {
          clusterName: res.cluster_name,
          clusterStatus: res.status,
          numberOfNodes: res.number_of_nodes,
        },
      };
    } catch (err) {
      return {
        status: 'degraded',
        info: { error: err instanceof Error ? err.message : String(err) },
      };
    }
  }

  private async ensureIndex(name: string, config: Record<string, unknown>): Promise<boolean> {
    const exists = await this.esClient!.indices.exists({ index: name });
    if (exists) {
      return false;
    }
    await this.esClient!.indices.create({ index: name, body: config });
    this.logger.log(`Created index: ${name}`);
    return true;
  }
}
