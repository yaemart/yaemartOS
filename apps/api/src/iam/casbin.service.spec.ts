import { beforeAll, describe, expect, it } from 'vitest';
import { CasbinService } from './casbin.service';

describe('CasbinService', () => {
  const service = new CasbinService();

  beforeAll(async () => {
    await service.onModuleInit();
  });

  it('allows admin wildcard policy', async () => {
    await expect(
      service.enforce({
        sub: 'admin',
        obj: 'listing:update',
        act: 'write',
        brand: 'homtone',
        market: 'US',
        platform: 'amazon',
        shop: 'shop-1',
        category: 'kitchen',
        field: 'title',
      }),
    ).resolves.toBe(true);
  });

  it('denies operator write by default', async () => {
    await expect(
      service.enforce({
        sub: 'operator',
        obj: 'listing:update',
        act: 'write',
        brand: 'homtone',
        market: 'US',
        platform: 'amazon',
        shop: 'shop-1',
        category: 'kitchen',
        field: 'title',
      }),
    ).resolves.toBe(false);
  });
});
