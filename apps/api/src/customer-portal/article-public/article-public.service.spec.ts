import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticlePublicService } from './article-public.service';

const mockActiveEnContent = {
  id: 'content-001',
  productId: 'prod-001',
  locale: 'en',
  source: 'manual',
  status: 'active',
  payload: {
    title: 'EN Product Title',
    description: 'EN Description',
    imageUrls: ['https://example.com/image.jpg'],
    faq: [{ question: 'What is this?', answer: 'A great product.' }],
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockActiveEsContent = {
  ...mockActiveEnContent,
  id: 'content-002',
  locale: 'es',
  payload: {
    title: 'ES Título del Producto',
    description: 'ES Descripción',
    imageUrls: ['https://example.com/image-es.jpg'],
    faq: [],
  },
};

const makeProduct = (override: Partial<typeof baseProduct> = {}) => ({
  ...baseProduct,
  ...override,
});

const baseProduct = {
  id: 'prod-001',
  brandId: 'brand-001',
  categoryId: 'cat-001',
  sku: 'SKU-001',
  title: 'Fallback Title',
  description: 'Fallback description',
  createdAt: new Date(),
  updatedAt: new Date(),
  category: { name: 'Electronics', slug: 'electronics' },
  contents: [mockActiveEnContent],
};

function buildMockPrisma() {
  return {
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    productContent: {
      findFirst: vi.fn(),
    },
    systemConfig: {
      findUnique: vi.fn(),
    },
  };
}

describe('ArticlePublicService', () => {
  let service: ArticlePublicService;
  let mockPrisma: ReturnType<typeof buildMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = buildMockPrisma();
    // Bypass NestJS DI: pass the mock directly as the injected PrismaClient
    service = new ArticlePublicService(mockPrisma as never);
  });

  describe('listProducts', () => {
    it('happy path: returns correct pagination for locale=en', async () => {
      const products = [makeProduct({ contents: [mockActiveEnContent] })];
      mockPrisma.product.findMany.mockResolvedValue(products);
      mockPrisma.product.count.mockResolvedValue(1);

      const result = await service.listProducts({ locale: 'en', page: 1, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'prod-001',
        sku: 'SKU-001',
        title: 'EN Product Title',
        description: 'EN Description',
        imageUrls: ['https://example.com/image.jpg'],
        locale: 'en',
        category: 'electronics',
        slug: 'SKU-001',
      });
    });

    it('happy path: locale=es returns only products with ES ProductContent', async () => {
      const esProduct = makeProduct({ contents: [mockActiveEsContent] });
      mockPrisma.product.findMany.mockResolvedValue([esProduct]);
      mockPrisma.product.count.mockResolvedValue(1);

      const result = await service.listProducts({ locale: 'es' });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contents: { some: { locale: 'es', status: 'active' } },
          }),
        }),
      );
      expect(result.data[0].title).toBe('ES Título del Producto');
      expect(result.data[0].locale).toBe('es');
    });

    it('clamps limit to 50 when limit exceeds max', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);

      const result = await service.listProducts({ limit: 999 });

      expect(result.limit).toBe(50);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });

  describe('getProduct', () => {
    it('happy path: returns product detail with faq from payload', async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce(
        makeProduct({ contents: [mockActiveEnContent] }),
      );

      const result = await service.getProduct('SKU-001', 'en');

      expect(result.id).toBe('prod-001');
      expect(result.slug).toBe('SKU-001');
      expect(result.title).toBe('EN Product Title');
      expect(result.faq).toEqual([{ question: 'What is this?', answer: 'A great product.' }]);
    });

    it('edge case: locale=fr with no FR content falls back to locale=en', async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce(makeProduct({ contents: [] }));
      mockPrisma.productContent.findFirst.mockResolvedValueOnce(mockActiveEnContent);

      const result = await service.getProduct('SKU-001', 'fr');

      expect(mockPrisma.productContent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ locale: 'en', status: 'active' }),
        }),
      );
      expect(result.locale).toBe('en');
      expect(result.title).toBe('EN Product Title');
    });

    it('error path: non-existent slug throws NotFoundException', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(service.getProduct('NON-EXISTENT-SKU')).rejects.toThrow(NotFoundException);
      await expect(service.getProduct('NON-EXISTENT-SKU')).rejects.toThrow('PRODUCT_NOT_FOUND');
    });
  });
});
