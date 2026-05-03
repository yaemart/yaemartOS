import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LocaleCode, ProductContentStatus, type PrismaClient } from '../../generated/prisma';
import { PRISMA_PUBLIC_CLIENT } from '../../database/database.tokens';

interface ProductPayload {
  title?: string;
  description?: string;
  imageUrls?: string[];
  faq?: Array<{ question: string; answer: string }>;
  [key: string]: unknown;
}

export interface ProductPublicItem {
  id: string;
  sku: string;
  title: string;
  description: string;
  imageUrls: string[];
  locale: string;
  category: string;
  slug: string;
}

export interface ProductPublicDetail extends ProductPublicItem {
  faq: Array<{ question: string; answer: string }>;
}

export interface ListProductsQuery {
  locale?: string;
  brandId?: string;
  page?: number;
  limit?: number;
}

export interface ListProductsResult {
  data: ProductPublicItem[];
  total: number;
  page: number;
  limit: number;
}

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

@Injectable()
export class ArticlePublicService {
  constructor(@Inject(PRISMA_PUBLIC_CLIENT) private readonly prisma: PrismaClient) {}

  async listProducts(query: ListProductsQuery): Promise<ListProductsResult> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? DEFAULT_LIMIT));
    const skip = (page - 1) * limit;

    const locale = query.locale ? (query.locale as LocaleCode) : undefined;
    const contentFilter = locale
      ? { locale, status: ProductContentStatus.active }
      : { status: ProductContentStatus.active };

    const productWhere = {
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(locale ? { contents: { some: { locale, status: ProductContentStatus.active } } } : {}),
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: productWhere,
        include: {
          category: { select: { name: true, slug: true } },
          contents: {
            where: contentFilter,
            take: 1,
            orderBy: { updatedAt: 'desc' },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where: productWhere }),
    ]);

    const data = products.map((p) => {
      const content = p.contents[0];
      const payload = (content?.payload ?? {}) as ProductPayload;
      return {
        id: p.id,
        sku: p.sku,
        title: payload.title ?? p.title,
        description: payload.description ?? p.description ?? '',
        imageUrls: payload.imageUrls ?? [],
        locale: content?.locale ?? locale ?? LocaleCode.en,
        category: p.category.slug,
        slug: p.sku,
      };
    });

    return { data, total, page, limit };
  }

  async getProduct(slugOrSku: string, locale?: string): Promise<ProductPublicDetail> {
    const resolvedLocale = locale ? (locale as LocaleCode) : LocaleCode.en;
    const contentFilter = { locale: resolvedLocale, status: ProductContentStatus.active };

    const productInclude = {
      category: { select: { name: true, slug: true } },
      contents: {
        where: contentFilter,
        orderBy: { updatedAt: 'desc' as const },
        take: 1,
      },
    };

    let product = await this.prisma.product.findFirst({
      where: { sku: slugOrSku },
      include: productInclude,
    });

    if (!product) {
      product = await this.prisma.product.findFirst({
        where: { id: slugOrSku },
        include: productInclude,
      });
    }

    if (!product) {
      throw new NotFoundException('PRODUCT_NOT_FOUND');
    }

    let content = product.contents[0];

    if (!content && resolvedLocale !== LocaleCode.en) {
      const fallback = await this.prisma.productContent.findFirst({
        where: {
          productId: product.id,
          locale: LocaleCode.en,
          status: ProductContentStatus.active,
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (fallback) {
        content = fallback;
      }
    }

    const payload = (content?.payload ?? {}) as ProductPayload;

    return {
      id: product.id,
      sku: product.sku,
      title: payload.title ?? product.title,
      description: payload.description ?? product.description ?? '',
      imageUrls: payload.imageUrls ?? [],
      locale: content?.locale ?? resolvedLocale,
      category: product.category.slug,
      slug: product.sku,
      faq: payload.faq ?? [],
    };
  }

  async getPrivacyPolicy(brandId: string, locale?: string): Promise<{ content: string }> {
    const lang = locale ?? 'en';
    const key = `privacy.policy.${brandId}.${lang}`;

    const config = await this.prisma.systemConfig.findUnique({ where: { key } });
    return { content: config?.value ?? '' };
  }
}
