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

  it('returns disabled status when ELASTICSEARCH_URL not set', async () => {
    await service.onModuleInit();
    const health = await service.health();
    expect(health.status).toBe('disabled');
  });

  it('throws when bootstrap called without client', async () => {
    await service.onModuleInit();
    await expect(service.bootstrap()).rejects.toThrow('Elasticsearch client not initialised');
  });
});
