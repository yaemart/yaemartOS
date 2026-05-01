import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ListingStatus, LocaleCode, Prisma, ProductContentSource } from '../../generated/prisma';
import { CategoryService } from '../category/category.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaClientManager } from '../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type Actor = {
  id?: string;
  brandId?: string;
};

type ListProductsQuery = {
  page?: number;
  pageSize?: number;
  brandId?: string;
  categoryId?: string;
  search?: string;
  source?: ProductContentSource;
};

@Injectable()
export class ProductService {
  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly auditService: AuditService,
    private readonly categoryService: CategoryService,
  ) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  async list(query: ListProductsQuery) {
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100);

    const where: Prisma.ProductWhereInput = {
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.source
        ? {
            contents: {
              some: {
                source: query.source,
              },
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          brand: true,
          category: true,
          contents: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              listings: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        category: true,
        contents: { orderBy: { updatedAt: 'desc' } },
        listings: {
          select: {
            id: true,
            status: true,
            language: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product not found: ${id}`);
    }

    return product;
  }

  async create(input: CreateProductDto, actor?: Actor) {
    const locale = (input.locale ?? 'en') as LocaleCode;
    const category = await this.categoryService.getById(input.categoryId);
    const template = await this.categoryService.getTemplate(input.categoryId, locale);

    const inheritedPayload = template
      ? {
          titleTemplate: template.titleTemplate,
          bulletsTemplate: template.bulletsTemplate,
          descriptionGuide: template.descriptionGuide,
          specParams: template.specParams,
          featureWords: template.featureWords,
          sellingPoints: template.sellingPoints,
          faqTemplate: template.faqTemplate,
          recipeTemplate: category.requiresRecipe ? template.recipeTemplate : null,
        }
      : null;

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            brandId: input.brandId,
            categoryId: input.categoryId,
            sku: input.sku,
            title: input.title,
            description: input.description ?? null,
          },
        });

        if (inheritedPayload) {
          await tx.productContent.create({
            data: {
              productId: created.id,
              locale,
              source: ProductContentSource.category_inherit,
              payload: inheritedPayload as Prisma.InputJsonValue,
            },
          });
        }

        return created;
      });

      await this.auditService.logWrite({
        userId: actor?.id,
        tenant: actor?.brandId ?? input.brandId,
        action: 'product.create',
        entity: 'Product',
        entityId: product.id,
        metadata: { sku: product.sku, categoryId: product.categoryId },
      });

      return this.getById(product.id);
    } catch (error) {
      this.rethrowConflict(error, 'sku already exists for this brand');
    }
  }

  async update(id: string, input: UpdateProductDto, actor?: Actor) {
    await this.assertExists(id);

    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(input.sku !== undefined ? { sku: input.sku } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
      });

      await this.auditService.logWrite({
        userId: actor?.id,
        tenant: actor?.brandId,
        action: 'product.update',
        entity: 'Product',
        entityId: product.id,
        metadata: input,
      });

      return product;
    } catch (error) {
      this.rethrowConflict(error, 'sku already exists for this brand');
    }
  }

  async remove(id: string, actor?: Actor) {
    await this.assertExists(id);

    const activeListings = await this.prisma.listing.count({
      where: {
        productId: id,
        status: {
          not: ListingStatus.archived,
        },
      },
    });
    if (activeListings > 0) {
      throw new ConflictException('Cannot delete product while non-archived listings exist');
    }

    await this.prisma.product.delete({ where: { id } });

    await this.auditService.logWrite({
      userId: actor?.id,
      tenant: actor?.brandId,
      action: 'product.delete',
      entity: 'Product',
      entityId: id,
    });

    return { id, deleted: true };
  }

  async updateContent(id: string, input: UpdateContentDto, actor?: Actor) {
    await this.assertExists(id);
    const locale = input.locale as LocaleCode;
    const payload = (input.payload ?? {}) as Prisma.InputJsonValue;

    const manual = await this.prisma.productContent.findUnique({
      where: {
        productId_locale_source: {
          productId: id,
          locale,
          source: ProductContentSource.manual,
        },
      },
    });

    const inherited = await this.prisma.productContent.findUnique({
      where: {
        productId_locale_source: {
          productId: id,
          locale,
          source: ProductContentSource.category_inherit,
        },
      },
    });

    let content;
    if (manual) {
      content = await this.prisma.productContent.update({
        where: { id: manual.id },
        data: { payload },
      });
    } else if (inherited) {
      content = await this.prisma.productContent.update({
        where: { id: inherited.id },
        data: {
          source: ProductContentSource.manual,
          payload,
        },
      });
    } else {
      content = await this.prisma.productContent.create({
        data: {
          productId: id,
          locale,
          source: ProductContentSource.manual,
          payload,
        },
      });
    }

    await this.auditService.logWrite({
      userId: actor?.id,
      tenant: actor?.brandId,
      action: 'product.content.update',
      entity: 'ProductContent',
      entityId: content.id,
      metadata: { productId: id, locale, source: content.source },
    });

    return content;
  }

  private async assertExists(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException(`Product not found: ${id}`);
    }
  }

  private rethrowConflict(error: unknown, fallback: string): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      throw new ConflictException(fallback);
    }
    throw error;
  }
}
