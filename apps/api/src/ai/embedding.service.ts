import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed } from 'ai';
import { createHash } from 'crypto';
import Redis from 'ioredis';

const EMBED_CACHE_TTL_SECONDS = 86400; // 24h

@Injectable()
export class EmbeddingService implements OnModuleDestroy {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly redis: Redis;
  private readonly model: string;
  private readonly google: ReturnType<typeof createGoogleGenerativeAI>;

  constructor(private readonly config: ConfigService) {
    const redisUrl = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, { lazyConnect: true });
    this.redis.on('error', (err: Error) => {
      this.logger.warn(`Redis error in EmbeddingService: ${err.message}`);
    });

    this.model = config.get<string>('GEMINI_EMBED_MODEL') ?? 'text-embedding-004';
    const apiKey = config.get<string>('GEMINI_API_KEY') ?? '';
    this.google = createGoogleGenerativeAI({ apiKey });
  }

  async onModuleDestroy() {
    this.redis.disconnect();
  }

  /**
   * Returns the embedding vector for `text`.
   * Results are cached in Redis for 24h using a content-addressed key derived from
   * the model name and a short hash of the text.
   */
  async embed(text: string): Promise<number[]> {
    const cacheKey = this.cacheKey(text);
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      return JSON.parse(cached) as number[];
    }

    const result = await embed({
      model: this.google.textEmbeddingModel(this.model),
      value: text,
    });
    const vector = result.embedding;

    await this.redis
      .set(cacheKey, JSON.stringify(vector), 'EX', EMBED_CACHE_TTL_SECONDS)
      .catch((err: Error) => {
        this.logger.warn(`Failed to cache embedding: ${err.message}`);
      });

    return vector;
  }

  /**
   * Cosine similarity between two equal-length vectors.
   * Returns a value in [−1, 1]; 1 means identical direction.
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) {
      return 0;
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      normA += a[i]! ** 2;
      normB += b[i]! ** 2;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * Computes pairwise cosine similarities for a list of items.
   * Returns a symmetric matrix: { [id_a]: { [id_b]: similarity } }.
   * Items without a text value are excluded from the matrix.
   * If an embedding call fails for an item, it is silently skipped.
   */
  async pairwiseSimilarity(
    items: { id: string; text: string }[],
  ): Promise<Record<string, Record<string, number>>> {
    if (items.length < 2) {
      return {};
    }

    const vectors = await Promise.all(
      items.map(async (item) => {
        try {
          const vec = await this.embed(item.text);
          return { id: item.id, vec };
        } catch (err) {
          this.logger.warn(
            `Failed to embed listing ${item.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
          return null;
        }
      }),
    );

    const valid = vectors.filter((v): v is { id: string; vec: number[] } => v !== null);

    const matrix: Record<string, Record<string, number>> = {};
    for (let i = 0; i < valid.length; i++) {
      const a = valid[i]!;
      matrix[a.id] = {};
      for (let j = 0; j < valid.length; j++) {
        const b = valid[j]!;
        matrix[a.id]![b.id] = i === j ? 1 : this.cosineSimilarity(a.vec, b.vec);
      }
    }
    return matrix;
  }

  private cacheKey(text: string): string {
    const hash = createHash('sha256').update(text).digest('hex').slice(0, 8);
    return `listing:embed:${this.model}:${hash}`;
  }
}
