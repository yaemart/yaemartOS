import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from './search.service';
import { ConfigService } from '@nestjs/config';

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(() => {
    const config = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    service = new SearchService(config);
  });

  describe('when ELASTICSEARCH_URL is not set', () => {
    it('returns disabled status', async () => {
      await service.onModuleInit();
      const health = await service.health();
      expect(health.status).toBe('disabled');
    });

    it('throws when bootstrap called without client', async () => {
      await service.onModuleInit();
      await expect(service.bootstrap()).rejects.toThrow('Elasticsearch client not initialised');
    });

    it('exposes null client', async () => {
      await service.onModuleInit();
      expect(service.client).toBeNull();
    });
  });

  describe('bootstrap', () => {
    it('creates all three ops indexes plus legacy index', async () => {
      const mockIndices = {
        exists: vi.fn().mockResolvedValue(false),
        create: vi.fn().mockResolvedValue({ acknowledged: true }),
      };
      const mockClient = { indices: mockIndices } as unknown;

      const config = {
        get: vi.fn().mockReturnValue('http://localhost:9200'),
      } as unknown as ConfigService;
      const svc = new SearchService(config);
      (svc as unknown as { esClient: unknown }).esClient = mockClient;

      const result = await svc.bootstrap();

      expect(result.results).toHaveLength(4); // 3 ops + 1 legacy
      const created = result.results.filter((r) => r.created);
      expect(created).toHaveLength(4);
      expect(mockIndices.create).toHaveBeenCalledTimes(4);
    });

    it('skips creation when indexes already exist (idempotent)', async () => {
      const mockIndices = {
        exists: vi.fn().mockResolvedValue(true),
        create: vi.fn(),
      };
      const mockClient = { indices: mockIndices } as unknown;

      const config = {
        get: vi.fn().mockReturnValue('http://localhost:9200'),
      } as unknown as ConfigService;
      const svc = new SearchService(config);
      (svc as unknown as { esClient: unknown }).esClient = mockClient;

      const result = await svc.bootstrap();

      expect(mockIndices.create).not.toHaveBeenCalled();
      const notCreated = result.results.filter((r) => !r.created);
      expect(notCreated).toHaveLength(4);
    });

    it('result includes ADR-003 index names with env suffix', async () => {
      const mockIndices = {
        exists: vi.fn().mockResolvedValue(false),
        create: vi.fn().mockResolvedValue({ acknowledged: true }),
      };
      const mockClient = { indices: mockIndices } as unknown;

      const config = {
        get: vi.fn().mockReturnValue('http://localhost:9200'),
      } as unknown as ConfigService;
      const svc = new SearchService(config);
      (svc as unknown as { esClient: unknown }).esClient = mockClient;

      const result = await svc.bootstrap();
      const names = result.results.map((r) => r.index);

      expect(names.some((n) => n.startsWith('ops-product_knowledge-'))).toBe(true);
      expect(names.some((n) => n.startsWith('ops-listing_draft-'))).toBe(true);
      expect(names.some((n) => n.startsWith('ops-keyword_corpus-'))).toBe(true);
      expect(names).toContain('yaemartos_products');
    });
  });
});
