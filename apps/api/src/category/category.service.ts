import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LocaleCode, Prisma } from '../../generated/prisma';
import { AuditService } from '../common/audit/audit.service';
import { PrismaClientManager } from '../database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

type Actor = {
  id?: string;
  brandId?: string;
};

type ListCategoriesQuery = {
  page?: number;
  pageSize?: number;
  brandId?: string;
  search?: string;
};

@Injectable()
export class CategoryService {
  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly auditService: AuditService,
  ) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  async list(query: ListCategoriesQuery) {
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100);

    const where: Prisma.CategoryWhereInput = {
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: {
          parent: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: [{ brandId: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.category.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category not found: ${id}`);
    }

    return category;
  }

  async create(input: CreateCategoryDto, actor?: Actor) {
    try {
      const category = await this.prisma.category.create({
        data: {
          brandId: input.brandId,
          parentId: input.parentId ?? null,
          name: input.name,
          slug: input.slug,
          isActive: input.isActive ?? true,
          requiresRecipe: input.requiresRecipe ?? false,
        },
      });

      await this.auditService.logWrite({
        userId: actor?.id,
        tenant: actor?.brandId ?? input.brandId,
        action: 'category.create',
        entity: 'Category',
        entityId: category.id,
        metadata: { slug: category.slug, brandId: category.brandId },
      });

      return category;
    } catch (error) {
      this.rethrowConflict(error, 'slug already exists for this brand');
    }
  }

  async update(id: string, input: UpdateCategoryDto, actor?: Actor) {
    await this.assertExists(id);

    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: {
          ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.slug !== undefined ? { slug: input.slug } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.requiresRecipe !== undefined ? { requiresRecipe: input.requiresRecipe } : {}),
        },
      });

      await this.auditService.logWrite({
        userId: actor?.id,
        tenant: actor?.brandId,
        action: 'category.update',
        entity: 'Category',
        entityId: id,
        metadata: input,
      });

      return category;
    } catch (error) {
      this.rethrowConflict(error, 'slug already exists for this brand');
    }
  }

  async remove(id: string, actor?: Actor) {
    await this.assertExists(id);

    const relatedProducts = await this.prisma.product.count({
      where: { categoryId: id },
    });
    if (relatedProducts > 0) {
      throw new ConflictException('Cannot delete category with linked products');
    }

    await this.prisma.category.delete({ where: { id } });
    await this.auditService.logWrite({
      userId: actor?.id,
      tenant: actor?.brandId,
      action: 'category.delete',
      entity: 'Category',
      entityId: id,
    });

    return { id, deleted: true };
  }

  async getTemplate(categoryId: string, locale: LocaleCode = LocaleCode.en) {
    await this.assertExists(categoryId);
    const template = await this.prisma.categoryContentTemplate.findUnique({
      where: {
        categoryId_locale: {
          categoryId,
          locale,
        },
      },
    });

    return template;
  }

  async upsertTemplate(categoryId: string, input: UpdateTemplateDto, actor?: Actor) {
    await this.assertExists(categoryId);

    const updateData: Prisma.CategoryContentTemplateUpdateInput = {
      ...(input.titleTemplate !== undefined
        ? { titleTemplate: this.toStringOrNull(input.titleTemplate) }
        : {}),
      ...(input.bulletsTemplate !== undefined
        ? { bulletsTemplate: this.toJsonInput(input.bulletsTemplate) }
        : {}),
      ...(input.descriptionGuide !== undefined
        ? { descriptionGuide: this.toStringOrNull(input.descriptionGuide) }
        : {}),
      ...(input.specParams !== undefined ? { specParams: this.toJsonInput(input.specParams) } : {}),
      ...(input.featureWords !== undefined
        ? { featureWords: this.toJsonInput(input.featureWords) }
        : {}),
      ...(input.sellingPoints !== undefined
        ? { sellingPoints: this.toJsonInput(input.sellingPoints) }
        : {}),
      ...(input.faqTemplate !== undefined
        ? { faqTemplate: this.toJsonInput(input.faqTemplate) }
        : {}),
      ...(input.recipeTemplate !== undefined
        ? { recipeTemplate: this.toJsonInput(input.recipeTemplate) }
        : {}),
    };

    const createData: Prisma.CategoryContentTemplateCreateInput = {
      category: { connect: { id: categoryId } },
      locale: input.locale as LocaleCode,
      ...(input.titleTemplate !== undefined
        ? { titleTemplate: this.toStringOrNull(input.titleTemplate) }
        : {}),
      ...(input.bulletsTemplate !== undefined
        ? { bulletsTemplate: this.toJsonInput(input.bulletsTemplate) }
        : {}),
      ...(input.descriptionGuide !== undefined
        ? { descriptionGuide: this.toStringOrNull(input.descriptionGuide) }
        : {}),
      ...(input.specParams !== undefined ? { specParams: this.toJsonInput(input.specParams) } : {}),
      ...(input.featureWords !== undefined
        ? { featureWords: this.toJsonInput(input.featureWords) }
        : {}),
      ...(input.sellingPoints !== undefined
        ? { sellingPoints: this.toJsonInput(input.sellingPoints) }
        : {}),
      ...(input.faqTemplate !== undefined
        ? { faqTemplate: this.toJsonInput(input.faqTemplate) }
        : {}),
      ...(input.recipeTemplate !== undefined
        ? { recipeTemplate: this.toJsonInput(input.recipeTemplate) }
        : {}),
    };

    const template = await this.prisma.categoryContentTemplate.upsert({
      where: {
        categoryId_locale: {
          categoryId,
          locale: input.locale as LocaleCode,
        },
      },
      update: updateData,
      create: createData,
    });

    await this.auditService.logWrite({
      userId: actor?.id,
      tenant: actor?.brandId,
      action: 'category.template.upsert',
      entity: 'CategoryContentTemplate',
      entityId: template.id,
      metadata: { categoryId, locale: input.locale },
    });

    return template;
  }

  private async assertExists(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Category not found: ${categoryId}`);
    }
    return category;
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

  private toJsonInput(value: unknown) {
    if (value === null) {
      return Prisma.JsonNull;
    }
    return value as Prisma.InputJsonValue;
  }

  private toStringOrNull(value: unknown): string | null {
    if (typeof value === 'string') {
      return value;
    }
    return null;
  }
}
