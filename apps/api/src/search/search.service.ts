import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import { OPS_INDEX_CONFIGS, indexName, resolveIndexEnv } from './es-index-registry';

export type BootstrapResult = {
  index: string;
  created: boolean;
};

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: Client | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const node = this.config.get<string>('ELASTICSEARCH_URL');
    if (!node) {
      this.logger.warn('ELASTICSEARCH_URL not set — search module disabled');
      return;
    }
    this.client = new Client({ node });
    this.logger.log(`Elasticsearch client initialised → ${node}`);
  }

  /** Returns the underlying ES client (throws if not initialised). */
  getClient(): Client {
    if (!this.client) {
      throw new Error('Elasticsearch client not initialised');
    }
    return this.client;
  }

  /** Returns the env suffix used for all index names in this process. */
  getIndexEnv(): string {
    return resolveIndexEnv();
  }

  /**
   * Bootstraps all three ops-domain indices defined in ADR-003.
   * Idempotent — skips creation if the index already exists.
   */
  async bootstrap(): Promise<BootstrapResult[]> {
    const client = this.getClient();
    const env = this.getIndexEnv();
    const results: BootstrapResult[] = [];

    for (const { base, config } of OPS_INDEX_CONFIGS) {
      const idx = indexName(base, env);
      const exists = await client.indices.exists({ index: idx });
      if (exists) {
        results.push({ index: idx, created: false });
        continue;
      }

      await client.indices.create({ index: idx, body: config as any });
      this.logger.log(`Created index: ${idx}`);
      results.push({ index: idx, created: true });
    }

    return results;
  }

  async health(): Promise<{ status: string; info?: Record<string, unknown> }> {
    if (!this.client) {
      return { status: 'disabled', info: { reason: 'ELASTICSEARCH_URL not set' } };
    }

    try {
      const res = await this.client.cluster.health();
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
}
