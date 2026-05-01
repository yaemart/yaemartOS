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

  it('denies operator write by default for unlisted objects', async () => {
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

  it('allows operator to read listings within brand', async () => {
    await expect(
      service.enforce({
        sub: 'operator',
        obj: 'listings',
        act: 'read',
        brand: 'homtone',
        market: 'US',
        platform: 'amazon',
        shop: 'shop-1',
        category: 'kitchen',
        field: '*',
      }),
    ).resolves.toBe(true);
  });

  it('allows operator to write listings within brand', async () => {
    await expect(
      service.enforce({
        sub: 'operator',
        obj: 'listings',
        act: 'write',
        brand: 'homtone',
        market: 'US',
        platform: 'amazon',
        shop: 'shop-1',
        category: 'kitchen',
        field: '*',
      }),
    ).resolves.toBe(true);
  });

  it('allows operator to read products', async () => {
    await expect(
      service.enforce({
        sub: 'operator',
        obj: 'products',
        act: 'read',
        brand: 'homtone',
        market: 'US',
        platform: 'amazon',
        shop: 'shop-1',
        category: 'kitchen',
        field: '*',
      }),
    ).resolves.toBe(true);
  });

  it('allows operator to write products', async () => {
    await expect(
      service.enforce({
        sub: 'operator',
        obj: 'products',
        act: 'write',
        brand: 'homtone',
        market: 'US',
        platform: 'amazon',
        shop: 'shop-1',
        category: 'kitchen',
        field: '*',
      }),
    ).resolves.toBe(true);
  });

  it('allows operator to read categories', async () => {
    await expect(
      service.enforce({
        sub: 'operator',
        obj: 'categories',
        act: 'read',
        brand: 'homtone',
        market: 'US',
        platform: 'amazon',
        shop: 'shop-1',
        category: 'kitchen',
        field: '*',
      }),
    ).resolves.toBe(true);
  });

  it('allows operator to write categories', async () => {
    await expect(
      service.enforce({
        sub: 'operator',
        obj: 'categories',
        act: 'write',
        brand: 'homtone',
        market: 'US',
        platform: 'amazon',
        shop: 'shop-1',
        category: 'kitchen',
        field: '*',
      }),
    ).resolves.toBe(true);
  });

  it('denies operator access to shops', async () => {
    await expect(
      service.enforce({
        sub: 'operator',
        obj: 'shops',
        act: 'write',
        brand: 'homtone',
        market: 'US',
        platform: 'amazon',
        shop: 'shop-1',
        category: '*',
        field: '*',
      }),
    ).resolves.toBe(false);
  });
});
