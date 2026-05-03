import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleService } from './locale.service';

function makeService(overrides?: Record<string, unknown>) {
  const prisma = {
    locale: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: typeof prisma) => unknown) => fn(prisma)),
    ...overrides,
  } as any;
  return { service: new LocaleService(prisma), prisma };
}

describe('LocaleService', () => {
  describe('findByMarket', () => {
    it('returns all locales for the market ordered by isPrimary desc', async () => {
      const { service, prisma } = makeService();
      const rows = [
        { marketId: 'm1', language: 'en', isPrimary: true },
        { marketId: 'm1', language: 'es', isPrimary: false },
      ];
      prisma.locale.findMany.mockResolvedValue(rows);
      const result = await service.findByMarket('m1');
      expect(result).toEqual(rows);
      expect(prisma.locale.findMany).toHaveBeenCalledWith({
        where: { marketId: 'm1' },
        orderBy: [{ isPrimary: 'desc' }, { language: 'asc' }],
      });
    });
  });

  describe('findActive', () => {
    it('only returns isActive=true locales', async () => {
      const { service, prisma } = makeService();
      prisma.locale.findMany.mockResolvedValue([{ language: 'en', isActive: true }]);
      await service.findActive('m1');
      expect(prisma.locale.findMany).toHaveBeenCalledWith({
        where: { marketId: 'm1', isActive: true },
        orderBy: [{ isPrimary: 'desc' }, { language: 'asc' }],
      });
    });
  });

  describe('create', () => {
    it('creates a new locale', async () => {
      const { service, prisma } = makeService();
      prisma.locale.findUnique.mockResolvedValue(null);
      prisma.locale.create.mockResolvedValue({ id: 'loc1', language: 'es' });
      const result = await service.create('m1', 'es', false);
      expect(result).toEqual({ id: 'loc1', language: 'es' });
    });

    it('throws ConflictException when locale already exists', async () => {
      const { service, prisma } = makeService();
      prisma.locale.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.create('m1', 'es', false)).rejects.toThrow(ConflictException);
    });
  });

  describe('setPrimary', () => {
    it('clears other primaries and sets the target as primary', async () => {
      const { service, prisma } = makeService();
      prisma.locale.updateMany.mockResolvedValue({ count: 1 });
      prisma.locale.update.mockResolvedValue({ marketId: 'm1', language: 'es', isPrimary: true });

      const result = await service.setPrimary('m1', 'es');
      expect(prisma.locale.updateMany).toHaveBeenCalledWith({
        where: { marketId: 'm1', isPrimary: true },
        data: { isPrimary: false },
      });
      expect(result.isPrimary).toBe(true);
    });
  });
});
