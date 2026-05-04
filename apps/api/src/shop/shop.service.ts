import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LingxingClient } from '@yaemartos/lingxing-client';
import { AuditService } from '../common/audit/audit.service';
import { PrismaClientManager } from '../database/prisma.service';
import { RealtimeBusService } from '../realtime/realtime-bus.service';
import { BindShopDto } from './dto/bind-shop.dto';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateBindingDto } from './dto/update-binding.dto';

@Injectable()
export class ShopService {
  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly auditService: AuditService,
    private readonly lingxingClient: LingxingClient,
    private readonly realtimeBus: RealtimeBusService,
  ) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  async list(brandId: string) {
    return this.prisma.shop.findMany({
      where: { brandId },
      include: {
        binding: true,
        platform: { select: { name: true } },
        market: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      include: {
        binding: true,
        platform: { select: { name: true } },
        market: { select: { name: true } },
      },
    });

    if (!shop) {
      throw new NotFoundException(`Shop not found: ${id}`);
    }

    return shop;
  }

  async getLingxingShops() {
    return this.lingxingClient.shops.list();
  }

  async create(dto: CreateShopDto, userId?: string) {
    const existing = await this.prisma.shop.findFirst({
      where: { platformId: dto.platformId, externalId: dto.externalId },
    });
    if (existing) {
      throw new ConflictException(
        `A shop with externalId "${dto.externalId}" on platform "${dto.platformId}" already exists.`,
      );
    }

    const shop = await this.prisma.shop.create({
      data: {
        name: dto.name,
        platformId: dto.platformId,
        marketId: dto.marketId,
        brandId: dto.brandId,
        externalId: dto.externalId,
        isActive: dto.isActive ?? true,
      },
      include: {
        binding: true,
        platform: { select: { name: true } },
        market: { select: { name: true } },
      },
    });

    await this.auditService.logWrite({
      userId,
      tenant: undefined,
      action: 'shop.create',
      entity: 'Shop',
      entityId: shop.id,
      metadata: { name: dto.name, platformId: dto.platformId, brandId: dto.brandId },
    });

    return shop;
  }

  async delete(shopId: string, userId?: string) {
    const shop = await this.assertShopExists(shopId);

    await this.prisma.shop.delete({ where: { id: shopId } });

    await this.auditService.logWrite({
      userId,
      tenant: undefined,
      action: 'shop.delete',
      entity: 'Shop',
      entityId: shopId,
      metadata: { name: shop.name, brandId: shop.brandId },
    });
  }

  async bind(shopId: string, dto: BindShopDto, userId?: string) {
    const shop = await this.assertShopExists(shopId);

    const binding = await this.prisma.shopBinding.upsert({
      where: { shopId },
      update: {
        lingxingShopId: dto.lingxingShopId,
        ...(dto.bindingToken !== undefined ? { bindingToken: dto.bindingToken } : {}),
        syncEnabled: true,
      },
      create: {
        shopId,
        lingxingShopId: dto.lingxingShopId,
        bindingToken: dto.bindingToken ?? '',
        syncEnabled: true,
      },
    });

    await this.auditService.logWrite({
      userId,
      tenant: undefined,
      action: 'shop.bind',
      entity: 'ShopBinding',
      entityId: binding.id,
      metadata: { shopId, lingxingShopId: dto.lingxingShopId },
    });

    void this.realtimeBus.publish({
      entity: 'shop-binding',
      action: 'update',
      brandId: shop.brandId,
      ids: [binding.id, shopId],
      actorType: userId ? 'user' : 'agent',
      actorId: userId,
      timestamp: Date.now(),
      metadata: { shopId, lingxingShopId: dto.lingxingShopId, action: 'bind' },
    });

    return binding;
  }

  async updateBinding(shopId: string, dto: UpdateBindingDto, userId?: string) {
    if (dto.unbind !== true && dto.syncEnabled === undefined) {
      throw new BadRequestException('At least one of "unbind" or "syncEnabled" must be provided.');
    }

    const shop = await this.assertShopExists(shopId);

    const data =
      dto.unbind === true
        ? { lingxingShopId: null, syncEnabled: false }
        : { syncEnabled: dto.syncEnabled };

    const binding = await this.prisma.shopBinding.update({
      where: { shopId },
      data,
    });

    const isUnbind = dto.unbind === true;
    await this.auditService.logWrite({
      userId,
      tenant: undefined,
      action: isUnbind ? 'shop.binding.unbind' : 'shop.binding.update',
      entity: 'ShopBinding',
      entityId: binding.id,
      metadata: isUnbind ? { shopId } : { shopId, syncEnabled: dto.syncEnabled },
    });

    void this.realtimeBus.publish({
      entity: 'shop-binding',
      action: 'update',
      brandId: shop.brandId,
      ids: [binding.id, shopId],
      actorType: userId ? 'user' : 'agent',
      actorId: userId,
      timestamp: Date.now(),
      metadata: isUnbind
        ? { shopId, action: 'unbind' }
        : { shopId, action: 'toggleSync', syncEnabled: dto.syncEnabled ?? null },
    });

    return binding;
  }

  private async assertShopExists(shopId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
    });
    if (!shop) {
      throw new NotFoundException(`Shop not found: ${shopId}`);
    }
    return shop;
  }
}
