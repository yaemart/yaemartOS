import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClientManager } from '../database/prisma.service';
import { UpsertConfigDto } from './dto/upsert-config.dto';
import { UpdateBrandThemeDto } from './dto/update-brand-theme.dto';

export type ConnectionId =
  | 'gemini'
  | 'glm'
  | 'cloudinary'
  | 'lingxing'
  | 'opensearch'
  | 'redis'
  | 'postgres';

export interface ConnectionHealth {
  id: ConnectionId;
  label: string;
  configured: boolean;
  envKey: string;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly config: ConfigService,
  ) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  getConnectionHealth(): ConnectionHealth[] {
    const checks: Array<{ id: ConnectionId; label: string; envKey: string }> = [
      { id: 'gemini', label: 'Gemini Pro', envKey: 'GEMINI_API_KEY' },
      { id: 'glm', label: '智谱 GLM-5', envKey: 'GLM_API_KEY' },
      { id: 'cloudinary', label: 'Cloudinary', envKey: 'CLOUDINARY_CLOUD_NAME' },
      { id: 'lingxing', label: '领星 OpenAPI', envKey: 'LINGXING_APP_KEY' },
      { id: 'opensearch', label: 'OpenSearch (Bonsai)', envKey: 'ELASTICSEARCH_URL' },
      { id: 'redis', label: 'Redis (Upstash)', envKey: 'REDIS_URL' },
      { id: 'postgres', label: 'PostgreSQL (Neon)', envKey: 'DATABASE_URL' },
    ];

    return checks.map(({ id, label, envKey }) => ({
      id,
      label,
      envKey,
      configured: Boolean(this.config.get<string>(envKey)),
    }));
  }

  async getByCategory(category: string) {
    return this.prisma.systemConfig.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });
  }

  async upsert(key: string, category: string, dto: UpsertConfigDto, userId?: string) {
    return this.prisma.systemConfig.upsert({
      where: { key },
      update: {
        value: dto.value,
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        updatedBy: userId,
      },
      create: {
        key,
        category,
        value: dto.value,
        label: dto.label,
        updatedBy: userId,
      },
    });
  }

  async getAiCostSummary() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [budgetRows, monthlySpend] = await Promise.all([
      this.getByCategory('ai_budget'),
      this.prisma.aiCallLog.groupBy({
        by: ['model'],
        where: { createdAt: { gte: startOfMonth } },
        _sum: { estimatedCostUsd: true, promptTokens: true, completionTokens: true },
        _count: { id: true },
      }),
    ]);

    const budgetMap = Object.fromEntries(budgetRows.map((r) => [r.key, r.value]));
    const geminiMonthlyUsd = Number(budgetMap['ai_budget.gemini_monthly_usd'] ?? 50);
    const glmMonthlyCny = Number(budgetMap['ai_budget.glm_monthly_cny'] ?? 500);
    const alertThresholdPct = Number(budgetMap['ai_budget.alert_threshold_pct'] ?? 80);

    const geminiSpend = monthlySpend
      .filter((r) => r.model.startsWith('gemini'))
      .reduce((sum, r) => sum + Number(r._sum.estimatedCostUsd ?? 0), 0);

    const glmSpend = monthlySpend
      .filter((r) => r.model.startsWith('glm'))
      .reduce((sum, r) => sum + Number(r._sum.estimatedCostUsd ?? 0), 0);

    const totalCalls = monthlySpend.reduce((sum, r) => sum + r._count.id, 0);

    return {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      budgets: {
        geminiMonthlyUsd,
        glmMonthlyCny,
        alertThresholdPct,
      },
      spend: {
        geminiUsd: Number(geminiSpend.toFixed(4)),
        glmUsd: Number(glmSpend.toFixed(4)),
        totalCalls,
        byModel: monthlySpend.map((r) => ({
          model: r.model,
          calls: r._count.id,
          estimatedCostUsd: Number(r._sum.estimatedCostUsd ?? 0).toFixed(4),
          promptTokens: r._sum.promptTokens ?? 0,
          completionTokens: r._sum.completionTokens ?? 0,
        })),
      },
      alerts: {
        geminiOverBudget:
          geminiMonthlyUsd > 0 && geminiSpend / geminiMonthlyUsd >= alertThresholdPct / 100,
        glmOverBudget:
          glmMonthlyCny > 0 && glmSpend / (glmMonthlyCny / 7) >= alertThresholdPct / 100,
      },
    };
  }

  async getBrands() {
    return this.prisma.brand.findMany({
      select: { id: true, name: true, slug: true, themeColor: true, logoUrl: true },
      orderBy: { id: 'asc' },
    });
  }

  async updateBrandTheme(brandId: string, dto: UpdateBrandThemeDto, userId?: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      throw new NotFoundException(`Brand not found: ${brandId}`);
    }

    return this.prisma.brand.update({
      where: { id: brandId },
      data: {
        ...(dto.themeColor !== undefined ? { themeColor: dto.themeColor } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
      },
      select: { id: true, name: true, slug: true, themeColor: true, logoUrl: true },
    });
  }
}
