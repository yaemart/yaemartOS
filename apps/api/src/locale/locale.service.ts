import { ConflictException, Injectable } from '@nestjs/common';
import { LocaleCode } from '../generated/prisma';
import { PrismaClientManager } from '../database/prisma.service';

@Injectable()
export class LocaleService {
  constructor(private readonly prismaManager: PrismaClientManager) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  async findByMarket(marketId: string) {
    return this.prisma.locale.findMany({
      where: { marketId },
      orderBy: [{ isPrimary: 'desc' }, { language: 'asc' }],
    });
  }

  async findActive(marketId: string) {
    return this.prisma.locale.findMany({
      where: { marketId, isActive: true },
      orderBy: [{ isPrimary: 'desc' }, { language: 'asc' }],
    });
  }

  async create(marketId: string, language: LocaleCode, isPrimary = false) {
    const existing = await this.prisma.locale.findUnique({
      where: { marketId_language: { marketId, language } },
    });
    if (existing) {
      throw new ConflictException(`Locale ${language} already exists for market ${marketId}`);
    }
    return this.prisma.locale.create({
      data: { marketId, language, isPrimary },
    });
  }

  /** Sets isPrimary=true for the given locale, clears it for all others in the same market. */
  async setPrimary(marketId: string, language: LocaleCode) {
    return this.prisma.$transaction(async (tx) => {
      await tx.locale.updateMany({
        where: { marketId, isPrimary: true },
        data: { isPrimary: false },
      });
      return tx.locale.update({
        where: { marketId_language: { marketId, language } },
        data: { isPrimary: true },
      });
    });
  }
}
