import { ConflictException } from '@nestjs/common';
import { ProductContentSource } from '../../generated/prisma';
import { describe, expect, it, vi } from 'vitest';
import { ProductService } from './product.service';

function createService() {
  const prisma = {
    product: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    productContent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    listing: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const prismaManager = {
    getPublicClient: () => prisma,
  } as any;

  const auditService = {
    logWrite: vi.fn(),
  } as any;

  const categoryService = {
    getById: vi.fn(),
    getTemplate: vi.fn(),
  } as any;

  const service = new ProductService(prismaManager, auditService, categoryService);
  return { service, prisma, categoryService, auditService };
}

describe('ProductService', () => {
  it('creates inherited product content on product create', async () => {
    const { service, prisma, categoryService } = createService();

    categoryService.getById.mockResolvedValue({ id: 'cat_1', requiresRecipe: true });
    categoryService.getTemplate.mockResolvedValue({
      titleTemplate: 'template title',
      bulletsTemplate: ['a'],
      descriptionGuide: 'guide',
      specParams: { power: '200W' },
      featureWords: ['slow cook'],
      sellingPoints: ['easy'],
      faqTemplate: [{ q: 'q1', a: 'a1' }],
      recipeTemplate: [{ name: 'recipe' }],
    });

    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn({
        product: {
          create: vi.fn().mockResolvedValue({
            id: 'prd_1',
            brandId: 'homtone',
            categoryId: 'cat_1',
            sku: 'SKU-1',
            title: 'title',
          }),
        },
        productContent: {
          create: vi.fn().mockResolvedValue({ id: 'pc_1' }),
        },
      }),
    );
    prisma.product.findUnique.mockResolvedValue({
      id: 'prd_1',
      brand: {},
      category: {},
      contents: [],
      listings: [],
    });

    await service.create({
      brandId: 'homtone',
      categoryId: 'cat_1',
      sku: 'SKU-1',
      title: 'title',
      locale: 'en',
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('switches source from category_inherit to manual on content update', async () => {
    const { service, prisma } = createService();
    prisma.product.findUnique.mockResolvedValue({ id: 'prd_1' });
    prisma.productContent.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'pc_1',
      source: ProductContentSource.category_inherit,
    });
    prisma.productContent.update.mockResolvedValue({
      id: 'pc_1',
      source: ProductContentSource.manual,
      payload: { faq: [] },
    });

    const result = await service.updateContent('prd_1', {
      locale: 'en',
      payload: { faq: [] },
    });

    expect(result.source).toBe(ProductContentSource.manual);
  });

  it('blocks delete when non-archived listings exist', async () => {
    const { service, prisma } = createService();
    prisma.product.findUnique.mockResolvedValue({ id: 'prd_1' });
    prisma.listing.count.mockResolvedValue(1);

    await expect(service.remove('prd_1')).rejects.toBeInstanceOf(ConflictException);
  });
});
