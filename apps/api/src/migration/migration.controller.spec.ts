import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Queue } from 'bullmq';
import { MigrationController } from './migration.controller';
import type { PrismaClientManager } from '../database/prisma.service';
import { PlatformCode } from '../generated/prisma';

function makePrisma(shops: unknown[] = []) {
  return {
    shop: {
      findMany: vi.fn().mockResolvedValue(shops),
    },
  };
}

function makeController(shops: unknown[] = []) {
  const prisma = makePrisma(shops);
  const prismaManager = {
    getPublicClient: () => prisma,
  } as unknown as PrismaClientManager;

  const queue = {
    add: vi.fn(),
    getJob: vi.fn(),
    getWaiting: vi.fn().mockResolvedValue([]),
    getActive: vi.fn().mockResolvedValue([]),
    getCompleted: vi.fn().mockResolvedValue([]),
    getFailed: vi.fn().mockResolvedValue([]),
  } as unknown as Queue;

  const controller = new MigrationController(queue, prismaManager);
  return { controller, prisma };
}

describe('MigrationController.getAvailableShops', () => {
  it('returns mapped shops when brandId and valid platformCode are provided', async () => {
    const { controller } = makeController([
      {
        name: 'Homtone US',
        binding: { lingxingShopId: 'lx-001' },
        platform: { name: 'Amazon' },
        market: { name: 'US' },
      },
    ]);

    const result = await controller.getAvailableShops('homtone', PlatformCode.amazon);

    expect(result).toEqual([
      {
        lingxingShopId: 'lx-001',
        shopName: 'Homtone US',
        platformName: 'Amazon',
        marketName: 'US',
      },
    ]);
  });

  it('returns empty array when no shops are bound', async () => {
    const { controller } = makeController([]);
    const result = await controller.getAvailableShops('homtone', PlatformCode.amazon);
    expect(result).toEqual([]);
  });

  it('filters out shops without lingxingShopId', async () => {
    const { controller } = makeController([
      {
        name: 'Unbound Shop',
        binding: { lingxingShopId: null },
        platform: { name: 'Amazon' },
        market: { name: 'US' },
      },
    ]);
    const result = await controller.getAvailableShops('homtone', PlatformCode.amazon);
    expect(result).toEqual([]);
  });

  it('throws BadRequestException when brandId header is missing', async () => {
    const { controller } = makeController();
    await expect(
      controller.getAvailableShops(undefined as unknown as string, PlatformCode.amazon),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for invalid platformCode', async () => {
    const { controller } = makeController();
    await expect(
      controller.getAvailableShops('homtone', 'invalid-platform' as PlatformCode),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when platformCode is empty string', async () => {
    const { controller } = makeController();
    await expect(controller.getAvailableShops('homtone', '' as PlatformCode)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('scopes query to the brandId from the header (not a query param)', async () => {
    const { controller, prisma } = makeController([]);

    await controller.getAvailableShops('brand-a', PlatformCode.amazon);

    expect(prisma.shop.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ brandId: 'brand-a' }),
      }),
    );
  });

  it('falls back platformName to platformCode when platform relation is null', async () => {
    const { controller } = makeController([
      {
        name: 'Orphan Shop',
        binding: { lingxingShopId: 'lx-999' },
        platform: null,
        market: null,
      },
    ]);

    const result = await controller.getAvailableShops('homtone', PlatformCode.amazon);

    expect(result[0].platformName).toBe(PlatformCode.amazon);
    expect(result[0].marketName).toBe('');
  });
});
