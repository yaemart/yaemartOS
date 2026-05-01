import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CategoryService } from './category.service';

function createService() {
  const prisma = {
    category: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    product: {
      count: vi.fn(),
    },
    categoryContentTemplate: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  };

  const prismaManager = {
    getPublicClient: () => prisma,
  } as any;

  const auditService = {
    logWrite: vi.fn(),
  } as any;

  const service = new CategoryService(prismaManager, auditService);
  return { service, prisma, auditService };
}

describe('CategoryService', () => {
  it('creates category and writes audit log', async () => {
    const { service, prisma, auditService } = createService();
    prisma.category.create.mockResolvedValue({
      id: 'cat_1',
      brandId: 'homtone',
      slug: 'slow-cooker',
    });

    const result = await service.create({
      brandId: 'homtone',
      name: '慢炖锅',
      slug: 'slow-cooker',
    });

    expect(result.id).toBe('cat_1');
    expect(auditService.logWrite).toHaveBeenCalledOnce();
  });

  it('throws conflict on duplicate slug', async () => {
    const { service, prisma } = createService();
    prisma.category.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.create({
        brandId: 'homtone',
        name: '慢炖锅',
        slug: 'slow-cooker',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws conflict when deleting category with products', async () => {
    const { service, prisma } = createService();
    prisma.category.findUnique.mockResolvedValue({ id: 'cat_1' });
    prisma.product.count.mockResolvedValue(2);

    await expect(service.remove('cat_1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws not found when category is missing', async () => {
    const { service, prisma } = createService();
    prisma.category.findUnique.mockResolvedValue(null);

    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
