import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientManager } from '../database/prisma.service';

@Injectable()
export class PlatformService {
  constructor(private readonly prismaManager: PrismaClientManager) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  list() {
    return this.prisma.platform.findMany({ orderBy: { code: 'asc' } });
  }

  async getById(id: string) {
    const platform = await this.prisma.platform.findUnique({ where: { id } });
    if (!platform) {
      throw new NotFoundException(`Platform ${id} not found`);
    }
    return platform;
  }
}
