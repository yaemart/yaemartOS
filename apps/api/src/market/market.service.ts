import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientManager } from '../database/prisma.service';

@Injectable()
export class MarketService {
  constructor(private readonly prismaManager: PrismaClientManager) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  list(brandId?: string) {
    return this.prisma.market.findMany({
      where: brandId ? { brandId } : undefined,
      orderBy: { code: 'asc' },
    });
  }

  async getById(id: string) {
    const market = await this.prisma.market.findUnique({ where: { id } });
    if (!market) {
      throw new NotFoundException(`Market ${id} not found`);
    }
    return market;
  }

  async create(data: {
    brandId: string;
    code: string;
    name: string;
    currency: string;
    timezone: string;
  }) {
    const existing = await this.prisma.market.findUnique({
      where: { brandId_code: { brandId: data.brandId, code: data.code } },
    });
    if (existing) {
      throw new ConflictException(
        `Market code "${data.code}" already exists for brand ${data.brandId}`,
      );
    }
    return this.prisma.market.create({ data });
  }

  async update(id: string, data: Partial<{ name: string; currency: string; timezone: string }>) {
    await this.getById(id);
    return this.prisma.market.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.getById(id);
    return this.prisma.market.delete({ where: { id } });
  }
}
