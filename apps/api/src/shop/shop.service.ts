import { Injectable, NotFoundException } from '@nestjs/common';
import { LingxingClient } from '@yaemartos/lingxing-client';
import { AuditService } from '../common/audit/audit.service';
import { PrismaClientManager } from '../database/prisma.service';
import { BindShopDto } from './dto/bind-shop.dto';
import { UpdateBindingDto } from './dto/update-binding.dto';

@Injectable()
export class ShopService {
  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly auditService: AuditService,
    private readonly lingxingClient: LingxingClient,
  ) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  async list(brandId: string) {
    return this.prisma.shop.findMany({
      where: { brandId },
      include: { binding: true },
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      include: { binding: true },
    });

    if (!shop) {
      throw new NotFoundException(`Shop not found: ${id}`);
    }

    return shop;
  }

  async getLingxingShops() {
    return this.lingxingClient.shops.list();
  }

  async bind(shopId: string, dto: BindShopDto, userId?: string) {
    await this.assertShopExists(shopId);

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

    return binding;
  }

  async updateBinding(shopId: string, dto: UpdateBindingDto, userId?: string) {
    await this.assertShopExists(shopId);

    const binding = await this.prisma.shopBinding.update({
      where: { shopId },
      data: { syncEnabled: dto.syncEnabled },
    });

    await this.auditService.logWrite({
      userId,
      tenant: undefined,
      action: 'shop.binding.update',
      entity: 'ShopBinding',
      entityId: binding.id,
      metadata: { shopId, syncEnabled: dto.syncEnabled },
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
