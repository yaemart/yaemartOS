import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ShopService } from './shop.service';

function createService() {
  const prisma = {
    shop: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    shopBinding: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
  };

  const prismaManager = {
    getPublicClient: () => prisma,
  } as any;

  const auditService = {
    logWrite: vi.fn(),
  } as any;

  const lingxingClient = {
    shops: {
      list: vi.fn(),
    },
  } as any;

  const service = new ShopService(prismaManager, auditService, lingxingClient);
  return { service, prisma, auditService, lingxingClient };
}

describe('ShopService', () => {
  it('lists shops with binding status for a brand', async () => {
    const { service, prisma } = createService();
    const shops = [
      { id: 'shop_1', name: 'US Store', binding: null },
      { id: 'shop_2', name: 'EU Store', binding: { syncEnabled: true } },
    ];
    prisma.shop.findMany.mockResolvedValue(shops);

    const result = await service.list('homtone');

    expect(result).toEqual(shops);
    expect(prisma.shop.findMany).toHaveBeenCalledWith({
      where: { brandId: 'homtone' },
      include: { binding: true },
      orderBy: { name: 'asc' },
    });
  });

  it('returns lingxing shop list', async () => {
    const { service, lingxingClient } = createService();
    const lingxingShops = [
      { shopId: 'lx_1', shopName: 'LX Store', marketplaceId: 'ATVPDKIKX0DER', isActive: true },
    ];
    lingxingClient.shops.list.mockResolvedValue(lingxingShops);

    const result = await service.getLingxingShops();

    expect(result).toEqual(lingxingShops);
    expect(lingxingClient.shops.list).toHaveBeenCalledOnce();
  });

  it('binds a shop and sets syncEnabled to true', async () => {
    const { service, prisma, auditService } = createService();
    prisma.shop.findUnique.mockResolvedValue({ id: 'shop_1' });
    prisma.shopBinding.upsert.mockResolvedValue({
      id: 'binding_1',
      shopId: 'shop_1',
      lingxingShopId: 'lx_1',
      syncEnabled: true,
    });

    const result = await service.bind(
      'shop_1',
      { lingxingShopId: 'lx_1', bindingToken: 'tok_abc' },
      'user_1',
    );

    expect(result.syncEnabled).toBe(true);
    expect(result.lingxingShopId).toBe('lx_1');
    expect(prisma.shopBinding.upsert).toHaveBeenCalledWith({
      where: { shopId: 'shop_1' },
      update: {
        lingxingShopId: 'lx_1',
        bindingToken: 'tok_abc',
        syncEnabled: true,
      },
      create: {
        shopId: 'shop_1',
        lingxingShopId: 'lx_1',
        bindingToken: 'tok_abc',
        syncEnabled: true,
      },
    });
    expect(auditService.logWrite).toHaveBeenCalledOnce();
  });

  it('updates binding with existing shop (re-bind)', async () => {
    const { service, prisma } = createService();
    prisma.shop.findUnique.mockResolvedValue({ id: 'shop_1' });
    prisma.shopBinding.upsert.mockResolvedValue({
      id: 'binding_1',
      shopId: 'shop_1',
      lingxingShopId: 'lx_2',
      syncEnabled: true,
    });

    const result = await service.bind('shop_1', { lingxingShopId: 'lx_2' });

    expect(result.lingxingShopId).toBe('lx_2');
    expect(prisma.shopBinding.upsert).toHaveBeenCalledWith({
      where: { shopId: 'shop_1' },
      update: {
        lingxingShopId: 'lx_2',
        syncEnabled: true,
      },
      create: {
        shopId: 'shop_1',
        lingxingShopId: 'lx_2',
        bindingToken: '',
        syncEnabled: true,
      },
    });
  });

  it('toggles syncEnabled via updateBinding', async () => {
    const { service, prisma, auditService } = createService();
    prisma.shop.findUnique.mockResolvedValue({ id: 'shop_1' });
    prisma.shopBinding.update.mockResolvedValue({
      id: 'binding_1',
      shopId: 'shop_1',
      syncEnabled: false,
    });

    const result = await service.updateBinding('shop_1', { syncEnabled: false }, 'user_1');

    expect(result.syncEnabled).toBe(false);
    expect(prisma.shopBinding.update).toHaveBeenCalledWith({
      where: { shopId: 'shop_1' },
      data: { syncEnabled: false },
    });
    expect(auditService.logWrite).toHaveBeenCalledOnce();
  });

  it('throws NotFoundException when shop not found on getById', async () => {
    const { service, prisma } = createService();
    prisma.shop.findUnique.mockResolvedValue(null);

    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when binding a non-existent shop', async () => {
    const { service, prisma } = createService();
    prisma.shop.findUnique.mockResolvedValue(null);

    await expect(service.bind('missing', { lingxingShopId: 'lx_1' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
