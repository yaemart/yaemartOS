import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ShopService } from './shop.service';

function createService() {
  const prisma = {
    shop: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
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

  const realtimeBus = {
    publish: vi.fn().mockResolvedValue(undefined),
  } as any;

  const service = new ShopService(prismaManager, auditService, lingxingClient, realtimeBus);
  return { service, prisma, auditService, lingxingClient, realtimeBus };
}

describe('ShopService', () => {
  it('lists shops with binding, platform and market for a brand', async () => {
    const { service, prisma } = createService();
    const shops = [
      {
        id: 'shop_1',
        name: 'US Store',
        binding: null,
        platform: { name: 'Amazon' },
        market: { name: 'US' },
      },
      {
        id: 'shop_2',
        name: 'EU Store',
        binding: { syncEnabled: true },
        platform: { name: 'Walmart' },
        market: { name: 'DE' },
      },
    ];
    prisma.shop.findMany.mockResolvedValue(shops);

    const result = await service.list('homtone');

    expect(result).toEqual(shops);
    expect(prisma.shop.findMany).toHaveBeenCalledWith({
      where: { brandId: 'homtone' },
      include: {
        binding: true,
        platform: { select: { name: true } },
        market: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
  });

  it('returns empty array when brand has no shops', async () => {
    const { service, prisma } = createService();
    prisma.shop.findMany.mockResolvedValue([]);

    const result = await service.list('unknown-brand');

    expect(result).toEqual([]);
  });

  it('getById returns shop with platform and market', async () => {
    const { service, prisma } = createService();
    const shop = {
      id: 'shop_1',
      name: 'US Store',
      binding: null,
      platform: { name: 'Amazon' },
      market: { name: 'US' },
    };
    prisma.shop.findUnique.mockResolvedValue(shop);

    const result = await service.getById('shop_1');

    expect(result).toEqual(shop);
    expect(prisma.shop.findUnique).toHaveBeenCalledWith({
      where: { id: 'shop_1' },
      include: {
        binding: true,
        platform: { select: { name: true } },
        market: { select: { name: true } },
      },
    });
  });

  it('getById throws NotFoundException for unknown id', async () => {
    const { service, prisma } = createService();
    prisma.shop.findUnique.mockResolvedValue(null);

    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundException);
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
    prisma.shop.findUnique.mockResolvedValue({ id: 'shop_1', brandId: 'homtone' });
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
    prisma.shop.findUnique.mockResolvedValue({ id: 'shop_1', brandId: 'homtone' });
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
    prisma.shop.findUnique.mockResolvedValue({ id: 'shop_1', brandId: 'homtone' });
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
    expect(auditService.logWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'shop.binding.update' }),
    );
  });

  it('soft-unbinds via updateBinding({ unbind: true })', async () => {
    const { service, prisma, auditService } = createService();
    prisma.shop.findUnique.mockResolvedValue({ id: 'shop_1', brandId: 'homtone' });
    prisma.shopBinding.update.mockResolvedValue({
      id: 'binding_1',
      shopId: 'shop_1',
      lingxingShopId: null,
      syncEnabled: false,
    });

    const result = await service.updateBinding('shop_1', { unbind: true }, 'user_1');

    expect(result.lingxingShopId).toBeNull();
    expect(result.syncEnabled).toBe(false);
    expect(prisma.shopBinding.update).toHaveBeenCalledWith({
      where: { shopId: 'shop_1' },
      data: { lingxingShopId: null, syncEnabled: false },
    });
    expect(auditService.logWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'shop.binding.unbind' }),
    );
  });

  it('unbind takes priority when unbind:true and syncEnabled:true are both passed', async () => {
    const { service, prisma } = createService();
    prisma.shop.findUnique.mockResolvedValue({ id: 'shop_1', brandId: 'homtone' });
    prisma.shopBinding.update.mockResolvedValue({
      id: 'binding_1',
      lingxingShopId: null,
      syncEnabled: false,
    });

    await service.updateBinding('shop_1', { unbind: true, syncEnabled: true });

    expect(prisma.shopBinding.update).toHaveBeenCalledWith({
      where: { shopId: 'shop_1' },
      data: { lingxingShopId: null, syncEnabled: false },
    });
  });

  it('throws NotFoundException when binding a non-existent shop', async () => {
    const { service, prisma } = createService();
    prisma.shop.findUnique.mockResolvedValue(null);

    await expect(service.bind('missing', { lingxingShopId: 'lx_1' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws NotFoundException on updateBinding for non-existent shop', async () => {
    const { service, prisma } = createService();
    prisma.shop.findUnique.mockResolvedValue(null);

    await expect(service.updateBinding('missing', { syncEnabled: false })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws BadRequestException when updateBinding receives an empty DTO', async () => {
    const { service } = createService();

    await expect(service.updateBinding('shop_1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('create', () => {
    const dto = {
      name: 'EU Amazon Store',
      platformId: 'platform_amazon',
      marketId: 'market_de',
      brandId: 'homtone',
      externalId: 'EXT_DE_001',
    };

    it('creates a new shop and returns it with relations', async () => {
      const { service, prisma, auditService } = createService();
      const createdShop = {
        id: 'shop_new',
        ...dto,
        isActive: true,
        binding: null,
        platform: { name: 'Amazon' },
        market: { name: 'DE' },
      };
      prisma.shop.findFirst.mockResolvedValue(null);
      prisma.shop.create.mockResolvedValue(createdShop);

      const result = await service.create(dto, 'user_1');

      expect(result).toEqual(createdShop);
      expect(prisma.shop.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: dto.name,
            platformId: dto.platformId,
            marketId: dto.marketId,
            brandId: dto.brandId,
            externalId: dto.externalId,
            isActive: true,
          }),
        }),
      );
      expect(auditService.logWrite).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'shop.create', entity: 'Shop' }),
      );
    });

    it('respects isActive override when provided', async () => {
      const { service, prisma } = createService();
      prisma.shop.findFirst.mockResolvedValue(null);
      prisma.shop.create.mockResolvedValue({ id: 'shop_x', ...dto, isActive: false });

      await service.create({ ...dto, isActive: false });

      expect(prisma.shop.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
      );
    });

    it('throws ConflictException when platform+externalId already exists', async () => {
      const { service, prisma } = createService();
      prisma.shop.findFirst.mockResolvedValue({ id: 'existing_shop' });

      await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.shop.create).not.toHaveBeenCalled();
    });
  });

  describe('realtime publish (P0-D)', () => {
    it('publishes shop-binding update on bind', async () => {
      const { service, prisma, realtimeBus } = createService();
      prisma.shop.findUnique.mockResolvedValue({ id: 'shop_1', brandId: 'homtone' });
      prisma.shopBinding.upsert.mockResolvedValue({
        id: 'binding_1',
        shopId: 'shop_1',
        lingxingShopId: 'lx_1',
        syncEnabled: true,
      });

      await service.bind('shop_1', { lingxingShopId: 'lx_1' }, 'user_1');

      expect(realtimeBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'shop-binding',
          action: 'update',
          brandId: 'homtone',
          ids: ['binding_1', 'shop_1'],
          actorType: 'user',
          actorId: 'user_1',
          metadata: expect.objectContaining({ action: 'bind', lingxingShopId: 'lx_1' }),
        }),
      );
    });

    it('publishes shop-binding update on toggleSync', async () => {
      const { service, prisma, realtimeBus } = createService();
      prisma.shop.findUnique.mockResolvedValue({ id: 'shop_1', brandId: 'spoonlemon' });
      prisma.shopBinding.update.mockResolvedValue({
        id: 'binding_1',
        shopId: 'shop_1',
        syncEnabled: false,
      });

      await service.updateBinding('shop_1', { syncEnabled: false });

      expect(realtimeBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'shop-binding',
          action: 'update',
          brandId: 'spoonlemon',
          ids: ['binding_1', 'shop_1'],
          actorType: 'agent',
          metadata: expect.objectContaining({ action: 'toggleSync', syncEnabled: false }),
        }),
      );
    });

    it('publishes shop-binding update on unbind', async () => {
      const { service, prisma, realtimeBus } = createService();
      prisma.shop.findUnique.mockResolvedValue({ id: 'shop_1', brandId: 'davivy' });
      prisma.shopBinding.update.mockResolvedValue({
        id: 'binding_1',
        shopId: 'shop_1',
        lingxingShopId: null,
        syncEnabled: false,
      });

      await service.updateBinding('shop_1', { unbind: true }, 'user_2');

      expect(realtimeBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'shop-binding',
          action: 'update',
          brandId: 'davivy',
          ids: ['binding_1', 'shop_1'],
          actorType: 'user',
          actorId: 'user_2',
          metadata: expect.objectContaining({ action: 'unbind' }),
        }),
      );
    });
  });

  describe('delete', () => {
    it('deletes an existing shop and emits audit log', async () => {
      const { service, prisma, auditService } = createService();
      const existingShop = {
        id: 'shop_1',
        name: 'US Store',
        brandId: 'homtone',
      };
      prisma.shop.findUnique.mockResolvedValue(existingShop);
      prisma.shop.delete.mockResolvedValue(existingShop);

      await service.delete('shop_1', 'user_1');

      expect(prisma.shop.delete).toHaveBeenCalledWith({ where: { id: 'shop_1' } });
      expect(auditService.logWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'shop.delete',
          entity: 'Shop',
          entityId: 'shop_1',
        }),
      );
    });

    it('throws NotFoundException when deleting a non-existent shop', async () => {
      const { service, prisma } = createService();
      prisma.shop.findUnique.mockResolvedValue(null);

      await expect(service.delete('missing')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.shop.delete).not.toHaveBeenCalled();
    });
  });
});
