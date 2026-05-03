import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TerminologyService } from './terminology.service';

function makeService() {
  const prisma = {
    terminologyEntry: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
  } as any;
  const prismaManager = { getPublicClient: () => prisma } as any;
  return { service: new TerminologyService(prismaManager), prisma };
}

const BASE_DTO = {
  brandId: 'homtone',
  locale: 'es' as const,
  term: 'HomPure',
  definition: 'Our flagship purification line',
};

describe('TerminologyService', () => {
  describe('create', () => {
    it('creates a new entry', async () => {
      const { service, prisma } = makeService();
      prisma.terminologyEntry.findUnique.mockResolvedValue(null);
      prisma.terminologyEntry.create.mockResolvedValue({ id: 't1', ...BASE_DTO });
      const result = await service.create(BASE_DTO);
      expect(result.id).toBe('t1');
    });

    it('throws ConflictException when term already exists', async () => {
      const { service, prisma } = makeService();
      prisma.terminologyEntry.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.create(BASE_DTO)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates an existing entry', async () => {
      const { service, prisma } = makeService();
      prisma.terminologyEntry.findUnique.mockResolvedValue({ id: 't1' });
      prisma.terminologyEntry.update.mockResolvedValue({ id: 't1', definition: 'updated' });
      const result = await service.update('t1', { definition: 'updated' });
      expect(result.definition).toBe('updated');
    });

    it('throws NotFoundException for missing entry', async () => {
      const { service, prisma } = makeService();
      prisma.terminologyEntry.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { definition: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes an existing entry', async () => {
      const { service, prisma } = makeService();
      prisma.terminologyEntry.findUnique.mockResolvedValue({ id: 't1' });
      prisma.terminologyEntry.delete.mockResolvedValue({ id: 't1' });
      await expect(service.remove('t1')).resolves.not.toThrow();
    });

    it('throws NotFoundException for missing entry', async () => {
      const { service, prisma } = makeService();
      prisma.terminologyEntry.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('importCsv', () => {
    it('imports 3 rows from valid CSV', async () => {
      const { service, prisma } = makeService();
      prisma.terminologyEntry.upsert.mockResolvedValue({});
      const csv = Buffer.from(
        'term,definition,example\nHomPure,flagship line,HomPure X1\nHydraFlow,water tech\nBreezeLux,air series',
      );
      const result = await service.importCsv('homtone', 'es', csv);
      expect(result).toEqual({ imported: 3, skipped: 0 });
      expect(prisma.terminologyEntry.upsert).toHaveBeenCalledTimes(3);
    });

    it('skips empty term rows', async () => {
      const { service, prisma } = makeService();
      prisma.terminologyEntry.upsert.mockResolvedValue({});
      const csv = Buffer.from(
        'term,definition\nHomPure,flagship\n,empty term row\nHydraFlow,water',
      );
      const result = await service.importCsv('homtone', 'es', csv);
      expect(result).toEqual({ imported: 2, skipped: 1 });
    });

    it('counts duplicate upserts as imported (overwrite semantic)', async () => {
      const { service, prisma } = makeService();
      prisma.terminologyEntry.upsert.mockResolvedValue({});
      const csv = Buffer.from('term,definition\nHomPure,v1\nHomPure,v2');
      const result = await service.importCsv('homtone', 'es', csv);
      expect(result.imported).toBe(2);
    });

    it('throws BadRequestException when CSV lacks required headers', async () => {
      const { service } = makeService();
      const csv = Buffer.from('name,description\nHomPure,line');
      await expect(service.importCsv('homtone', 'es', csv)).rejects.toThrow(BadRequestException);
    });

    it('returns { imported: 0, skipped: 0 } for empty buffer', async () => {
      const { service } = makeService();
      const result = await service.importCsv('homtone', 'es', Buffer.from(''));
      expect(result).toEqual({ imported: 0, skipped: 0 });
    });
  });
});
