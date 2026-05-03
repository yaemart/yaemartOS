import { describe, it, expect, vi } from 'vitest';
import { FaqKnowledgeService, FaqItem } from './faq-knowledge.service';
import { SearchService } from './search.service';
import { EmbeddingService } from '../ai/embedding.service';

const MOCK_VECTOR = Array.from({ length: 768 }, (_, i) => i * 0.001);

function makeService(opts: {
  indexExists?: boolean;
  searchHits?: Array<{
    _id: string;
    _score: number;
    _source: { faq_id: string; question: string; answer: string };
  }>;
  embedFails?: boolean;
}) {
  const mockClient = {
    indices: {
      exists: vi.fn().mockResolvedValue({ body: opts.indexExists ?? true }),
      create: vi.fn().mockResolvedValue({}),
    },
    index: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    search: vi.fn().mockResolvedValue({
      body: { hits: { hits: opts.searchHits ?? [] } },
    }),
  };

  const mockSearch = {
    getClient: () => mockClient,
    getIndexEnv: () => 'test',
  } as unknown as SearchService;

  const mockEmbedding = {
    embed: opts.embedFails
      ? vi.fn().mockRejectedValue(new Error('Embedding API error'))
      : vi.fn().mockResolvedValue(MOCK_VECTOR),
  } as unknown as EmbeddingService;

  const service = new FaqKnowledgeService(mockSearch, mockEmbedding);
  return { service, mockClient, mockEmbedding };
}

describe('FaqKnowledgeService', () => {
  describe('ensureIndex', () => {
    it('creates index when not present', async () => {
      const { service, mockClient } = makeService({ indexExists: false });
      await service.ensureIndex('homtone');
      expect(mockClient.indices.create).toHaveBeenCalledOnce();
    });

    it('skips creation when index already exists', async () => {
      const { service, mockClient } = makeService({ indexExists: true });
      await service.ensureIndex('homtone');
      expect(mockClient.indices.create).not.toHaveBeenCalled();
    });
  });

  describe('index', () => {
    it('embeds question and writes to OpenSearch', async () => {
      const { service, mockClient, mockEmbedding } = makeService({});
      const item: FaqItem = {
        faqId: 'faq-1',
        brandId: 'homtone',
        locale: 'en',
        question: 'How do I return a product?',
        answer: 'Contact support within 30 days.',
      };
      await service.index(item);
      expect(mockEmbedding.embed).toHaveBeenCalledWith(item.question);
      expect(mockClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'faq-1',
          body: expect.objectContaining({
            question_vector: MOCK_VECTOR,
            brand_id: 'homtone',
            locale: 'en',
          }),
        }),
      );
    });
  });

  describe('search', () => {
    const hits = [
      {
        _id: 'faq-1',
        _score: 0.95,
        _source: { faq_id: 'faq-1', question: 'How to return?', answer: 'Within 30 days.' },
      },
      {
        _id: 'faq-2',
        _score: 0.85,
        _source: { faq_id: 'faq-2', question: 'Warranty period?', answer: '1 year.' },
      },
    ];

    it('returns mapped FaqSearchResult array', async () => {
      const { service } = makeService({ searchHits: hits });
      const results = await service.search('return policy', 'homtone', 'en');
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ faqId: 'faq-1', score: 0.95 });
      expect(results[1]).toMatchObject({ faqId: 'faq-2', score: 0.85 });
    });

    it('returns empty array when index does not exist', async () => {
      const { service } = makeService({ indexExists: false });
      const results = await service.search('any query', 'homtone', 'en');
      expect(results).toHaveLength(0);
    });

    it('returns empty array when OpenSearch returns no hits', async () => {
      const { service } = makeService({ searchHits: [] });
      const results = await service.search('return policy', 'homtone', 'en');
      expect(results).toHaveLength(0);
    });

    it('propagates embedding errors', async () => {
      const { service } = makeService({ embedFails: true });
      await expect(service.search('query', 'homtone', 'en')).rejects.toThrow('Embedding API error');
    });
  });

  describe('remove', () => {
    it('calls delete on OpenSearch with correct id', async () => {
      const { service, mockClient } = makeService({});
      await service.remove('faq-42', 'homtone');
      expect(mockClient.delete).toHaveBeenCalledWith(expect.objectContaining({ id: 'faq-42' }));
    });
  });
});
