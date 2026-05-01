import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

const DEFAULT_INDEX = 'yaemartos_products';

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

  async bootstrap(): Promise<{ created: boolean; index: string }> {
    if (!this.client) {
      throw new Error('Elasticsearch client not initialised');
    }

    const exists = await this.client.indices.exists({ index: DEFAULT_INDEX });
    if (exists) {
      return { created: false, index: DEFAULT_INDEX };
    }

    await this.client.indices.create({
      index: DEFAULT_INDEX,
      body: {
        settings: { number_of_shards: 1, number_of_replicas: 0 },
        mappings: {
          properties: {
            title: { type: 'text', analyzer: 'standard' },
            brand: { type: 'keyword' },
            asin: { type: 'keyword' },
            status: { type: 'keyword' },
            updatedAt: { type: 'date' },
          },
        },
      },
    });

    return { created: true, index: DEFAULT_INDEX };
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
