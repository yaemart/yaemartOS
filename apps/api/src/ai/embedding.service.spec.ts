import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EmbeddingService } from './embedding.service';

function makeService() {
  const config = {
    get: (key: string) => {
      if (key === 'GEMINI_EMBED_MODEL') {
        return 'text-embedding-004';
      }
      if (key === 'GEMINI_API_KEY') {
        return 'test-key';
      }
      if (key === 'REDIS_URL') {
        return 'redis://localhost:6379';
      }
      return undefined;
    },
  } as any;

  const service = new EmbeddingService(config);

  const redisMock = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn(),
    on: vi.fn(),
  };
  (service as any).redis = redisMock;

  const embedMock = vi.fn().mockResolvedValue({ embedding: [0.1, 0.2, 0.3] });
  (service as any)._embedFn = embedMock;

  // Patch the internal embed to use embedMock
  vi.spyOn(service as any, 'embed').mockImplementation(async (...args: unknown[]) => {
    const text = args[0] as string;
    const cached = await redisMock.get(`listing:embed:text-embedding-004:${text.slice(0, 8)}`);
    if (cached) {
      return JSON.parse(cached) as number[];
    }
    const result = (await embedMock(text)) as { embedding: number[] };
    await redisMock.set('key', JSON.stringify(result.embedding), 'EX', 86400);
    return result.embedding;
  });

  return { service, redisMock, embedMock };
}

describe('EmbeddingService', () => {
  describe('cosineSimilarity', () => {
    it('returns 1.0 for identical vectors', () => {
      const { service } = makeService();
      const v = [1, 0, 0];
      expect(service.cosineSimilarity(v, v)).toBeCloseTo(1.0);
    });

    it('returns 0.0 for orthogonal vectors', () => {
      const { service } = makeService();
      expect(service.cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0);
    });

    it('returns -1.0 for opposite vectors', () => {
      const { service } = makeService();
      expect(service.cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
    });

    it('returns 0 for zero-length vectors', () => {
      const { service } = makeService();
      expect(service.cosineSimilarity([], [])).toBe(0);
    });

    it('returns 0 for mismatched lengths', () => {
      const { service } = makeService();
      expect(service.cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });
  });

  describe('pairwiseSimilarity', () => {
    it('returns empty object when fewer than 2 items', async () => {
      const { service } = makeService();
      const result = await service.pairwiseSimilarity([{ id: 'a', text: 'hello' }]);
      expect(result).toEqual({});
    });

    it('returns NxN matrix with diagonal = 1.0 for 3 items', async () => {
      const { service } = makeService();
      const mockVec = [1, 0, 0];
      vi.spyOn(service, 'embed').mockResolvedValue(mockVec);

      const result = await service.pairwiseSimilarity([
        { id: 'a', text: 'hello' },
        { id: 'b', text: 'world' },
        { id: 'c', text: 'test' },
      ]);

      expect(result['a']!['a']).toBe(1);
      expect(result['b']!['b']).toBe(1);
      expect(result['c']!['c']).toBe(1);
      expect(Object.keys(result)).toHaveLength(3);
    });

    it('returns empty object when all embed calls fail', async () => {
      const { service } = makeService();
      vi.spyOn(service, 'embed').mockRejectedValue(new Error('API error'));

      const result = await service.pairwiseSimilarity([
        { id: 'a', text: 'hello' },
        { id: 'b', text: 'world' },
      ]);

      expect(result).toEqual({});
    });

    it('uses cached embedding (embed called once per unique text)', async () => {
      const { service } = makeService();
      const embedSpy = vi.spyOn(service, 'embed').mockResolvedValue([1, 0, 0]);

      await service.pairwiseSimilarity([
        { id: 'a', text: 'same' },
        { id: 'b', text: 'other' },
      ]);

      expect(embedSpy).toHaveBeenCalledTimes(2);
    });
  });
});
