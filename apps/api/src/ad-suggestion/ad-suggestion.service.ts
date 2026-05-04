import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaClientManager } from '../database/prisma.service';
import { GlmGenerationService } from '../ai/providers/glm-generation.service';
import { CostTrackingService } from '../ai/cost-tracking.service';
import { AuditService } from '../common/audit/audit.service';
import {
  AdActionType,
  AdChangeStatus,
  AdSuggestionStatus,
  AdType as PrismaAdType,
} from '../generated/prisma';

const ROLLBACK_WINDOW_HOURS = 24;
const SUGGESTION_TTL_DAYS = 7;
const TARGET_ACOS = 30; // %
const ACOS_BREACH_THRESHOLD = 39; // 130% of target
const CTR_BREACH_THRESHOLD = 0.1; // %

export interface AdSuggestionItem {
  campaignId: string;
  campaignName?: string;
  actionType: AdActionType;
  field: string;
  currentValue: number;
  suggestedValue: number;
  reason: string;
}

export interface CampaignMetrics {
  campaignId: string;
  campaignName: string | null;
  adType: PrismaAdType;
  spend: number;
  sales: number;
  impressions: number;
  clicks: number;
  orders: number;
  acos: number | null;
  ctr: number | null;
}

@Injectable()
export class AdSuggestionService {
  private readonly logger = new Logger(AdSuggestionService.name);

  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly glm: GlmGenerationService,
    private readonly costTracking: CostTrackingService,
    private readonly audit: AuditService,
  ) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  async generate(opts: {
    shopId: string;
    brandId: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const end = opts.endDate ? new Date(opts.endDate + 'T23:59:59.999Z') : new Date();
    const start = opts.startDate
      ? new Date(opts.startDate + 'T00:00:00.000Z')
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const metrics = await this.aggregateCampaignMetrics(opts.shopId, start, end);
    const breaching = metrics.filter(
      (m) =>
        (m.acos !== null && m.acos > ACOS_BREACH_THRESHOLD) ||
        (m.ctr !== null && m.ctr < CTR_BREACH_THRESHOLD && m.impressions > 1000),
    );

    if (breaching.length === 0) {
      return {
        batchId: null,
        count: 0,
        message: '当前广告数据表现良好，无需优化建议',
      };
    }

    const startedAt = Date.now();
    let suggestions: AdSuggestionItem[] = [];

    try {
      const result = await this.glm.generateJson<{ suggestions: AdSuggestionItem[] }>(
        SYSTEM_PROMPT,
        buildUserPrompt(breaching),
      );
      suggestions = Array.isArray(result?.suggestions) ? result.suggestions : [];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`GLM generate failed for shop=${opts.shopId}: ${message}`);
      throw err;
    } finally {
      const promptChars = SYSTEM_PROMPT.length + JSON.stringify(breaching).length;
      await this.costTracking.record({
        model: process.env.GLM_MODEL ?? 'glm-4-flash',
        taskType: 'ads.suggest',
        brandId: opts.brandId,
        promptTokens: Math.ceil(promptChars / 4),
        completionTokens: Math.ceil(JSON.stringify(suggestions).length / 4),
        durationMs: Date.now() - startedAt,
      });
    }

    if (suggestions.length === 0) {
      return {
        batchId: null,
        count: 0,
        message: 'AI 未给出可行建议（可能数据样本不足或表现已良好）',
      };
    }

    const batchId = randomUUID();
    const expiresAt = new Date(Date.now() + SUGGESTION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const campaignByid = new Map(metrics.map((m) => [m.campaignId, m]));

    const created = await this.prisma.adSuggestion.createMany({
      data: suggestions
        .filter((s) => campaignByid.has(s.campaignId))
        .map((s) => {
          const m = campaignByid.get(s.campaignId)!;
          return {
            batchId,
            shopId: opts.shopId,
            brandId: opts.brandId,
            campaignId: s.campaignId,
            campaignName: s.campaignName ?? m.campaignName,
            adType: m.adType,
            actionType: s.actionType,
            field: s.field,
            currentValue: s.currentValue,
            suggestedValue: s.suggestedValue,
            reason: s.reason,
            status: AdSuggestionStatus.pending,
            generatedBy: opts.userId,
            expiresAt,
          };
        }),
    });

    return {
      batchId,
      count: created.count,
      message: `生成 ${created.count} 条建议`,
    };
  }

  async list(opts: {
    shopId?: string;
    brandId: string;
    status?: AdSuggestionStatus;
    page?: number;
    limit?: number;
  }) {
    const take = Math.min(opts.limit ?? 50, 200);
    const skip = ((opts.page ?? 1) - 1) * take;

    // Lazy-expire: any pending suggestion past expiresAt is treated as expired in the response
    const now = new Date();
    const where = {
      brandId: opts.brandId,
      ...(opts.shopId ? { shopId: opts.shopId } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    };

    const [records, total] = await Promise.all([
      this.prisma.adSuggestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.adSuggestion.count({ where }),
    ]);

    const projected = records.map((r) => ({
      ...r,
      status:
        r.status === AdSuggestionStatus.pending && r.expiresAt < now
          ? AdSuggestionStatus.expired
          : r.status,
    }));

    return { records: projected, total, page: opts.page ?? 1, limit: take };
  }

  async findOne(id: string, brandId: string) {
    const suggestion = await this.prisma.adSuggestion.findUnique({ where: { id } });
    if (!suggestion || suggestion.brandId !== brandId) {
      throw new NotFoundException(`AdSuggestion ${id} not found`);
    }
    return suggestion;
  }

  /**
   * Executes a pending suggestion: marks it `executed` and records an `AdChange`
   * carrying the before/after values needed for rollback. The MVP does not push
   * to upstream Lingxing — the change exists purely as a local record so the
   * gate, audit trail, and rollback semantics can be exercised end-to-end.
   *
   * Rollback window: 24h from execution. The change row carries `reversibleBefore`
   * so future jobs can lock the row once the window closes.
   */
  async execute(id: string, brandId: string, userId?: string) {
    const suggestion = await this.findOne(id, brandId);

    if (suggestion.status !== AdSuggestionStatus.pending) {
      throw new ConflictException(`Suggestion is in status=${suggestion.status}, cannot execute`);
    }
    if (suggestion.expiresAt < new Date()) {
      throw new BadRequestException('Suggestion has expired and can no longer be executed');
    }

    const now = new Date();
    const reversibleBefore = new Date(now.getTime() + ROLLBACK_WINDOW_HOURS * 60 * 60 * 1000);

    const change = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.adSuggestion.update({
        where: { id },
        data: { status: AdSuggestionStatus.executed, updatedAt: now },
      });

      // ConflictException-safe guard: the where clause above only matches the
      // current row, but if a concurrent request raced through findOne it could
      // double-execute. Reject here when status drifted.
      if (updated.status !== AdSuggestionStatus.executed) {
        throw new ConflictException('Suggestion status changed mid-execution');
      }

      const newChange = await tx.adChange.create({
        data: {
          suggestionId: suggestion.id,
          shopId: suggestion.shopId,
          brandId: suggestion.brandId,
          campaignId: suggestion.campaignId,
          actionType: suggestion.actionType,
          field: suggestion.field,
          valueBefore: suggestion.currentValue,
          valueAfter: suggestion.suggestedValue,
          executedBy: userId,
          reversibleBefore,
          status: AdChangeStatus.executed,
          metadata: {
            campaignName: suggestion.campaignName,
            adType: suggestion.adType,
            reason: suggestion.reason,
          },
        },
      });
      return newChange;
    });

    await this.audit.logWrite({
      userId,
      tenant: brandId,
      action: 'ads.suggestion.execute',
      entity: 'AdSuggestion',
      entityId: id,
      metadata: {
        before: { status: AdSuggestionStatus.pending },
        after: { status: AdSuggestionStatus.executed },
        changeId: change.id,
        field: suggestion.field,
        valueBefore: suggestion.currentValue?.toString() ?? null,
        valueAfter: suggestion.suggestedValue?.toString() ?? null,
      },
    });

    return { suggestion: { ...suggestion, status: AdSuggestionStatus.executed }, change };
  }

  async reject(id: string, brandId: string, userId?: string) {
    const suggestion = await this.findOne(id, brandId);
    if (suggestion.status !== AdSuggestionStatus.pending) {
      throw new ConflictException(`Suggestion is in status=${suggestion.status}, cannot reject`);
    }
    const updated = await this.prisma.adSuggestion.update({
      where: { id },
      data: { status: AdSuggestionStatus.rejected, updatedAt: new Date() },
    });

    await this.audit.logWrite({
      userId,
      tenant: brandId,
      action: 'ads.suggestion.reject',
      entity: 'AdSuggestion',
      entityId: id,
      metadata: {
        before: { status: AdSuggestionStatus.pending },
        after: { status: AdSuggestionStatus.rejected },
      },
    });

    return updated;
  }

  /**
   * Rolls back an executed change within the 24h reversibility window. Sets
   * `AdChange.status = rolled_back` and reverts the source `AdSuggestion` from
   * `executed` back to `pending` so it can be re-evaluated.
   */
  async rollback(changeId: string, brandId: string, userId?: string) {
    const change = await this.prisma.adChange.findUnique({ where: { id: changeId } });
    if (!change || change.brandId !== brandId) {
      throw new NotFoundException(`AdChange ${changeId} not found`);
    }
    if (change.status !== AdChangeStatus.executed) {
      throw new ConflictException(`AdChange is in status=${change.status}, cannot rollback`);
    }
    if (change.reversibleBefore < new Date()) {
      throw new BadRequestException(
        `AdChange is past its 24h rollback window (reversibleBefore=${change.reversibleBefore.toISOString()})`,
      );
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedChange = await tx.adChange.update({
        where: { id: changeId },
        data: {
          status: AdChangeStatus.rolled_back,
          rolledBackAt: now,
          rolledBackBy: userId,
        },
      });
      if (change.suggestionId) {
        await tx.adSuggestion.update({
          where: { id: change.suggestionId },
          data: { status: AdSuggestionStatus.pending, updatedAt: now },
        });
      }
      return updatedChange;
    });

    await this.audit.logWrite({
      userId,
      tenant: brandId,
      action: 'ads.change.rollback',
      entity: 'AdChange',
      entityId: changeId,
      metadata: {
        before: { status: AdChangeStatus.executed },
        after: { status: AdChangeStatus.rolled_back },
        suggestionId: change.suggestionId,
        valueAfter: change.valueAfter?.toString() ?? null,
        valueBefore: change.valueBefore?.toString() ?? null,
      },
    });

    return result;
  }

  async listChanges(opts: { brandId: string; shopId?: string; page?: number; limit?: number }) {
    const take = Math.min(opts.limit ?? 50, 200);
    const skip = ((opts.page ?? 1) - 1) * take;
    const where = {
      brandId: opts.brandId,
      ...(opts.shopId ? { shopId: opts.shopId } : {}),
    };
    const [records, total] = await Promise.all([
      this.prisma.adChange.findMany({
        where,
        orderBy: { executedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.adChange.count({ where }),
    ]);
    return { records, total, page: opts.page ?? 1, limit: take };
  }

  private async aggregateCampaignMetrics(
    shopId: string,
    start: Date,
    end: Date,
  ): Promise<CampaignMetrics[]> {
    const rows = await this.prisma.adDailyStat.groupBy({
      by: ['campaignId', 'campaignName', 'adType'],
      where: { shopId, date: { gte: start, lte: end } },
      _sum: {
        spend: true,
        sales: true,
        impressions: true,
        clicks: true,
        orders: true,
      },
    });

    return rows.map((row) => {
      const spend = row._sum.spend?.toNumber() ?? 0;
      const sales = row._sum.sales?.toNumber() ?? 0;
      const impressions = row._sum.impressions ?? 0;
      const clicks = row._sum.clicks ?? 0;
      const orders = row._sum.orders ?? 0;
      const acos = sales > 0 ? (spend / sales) * 100 : null;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
      return {
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        adType: row.adType,
        spend,
        sales,
        impressions,
        clicks,
        orders,
        acos,
        ctr,
      };
    });
  }
}

const SYSTEM_PROMPT = `你是一位专业的跨境电商广告优化顾问，专长于 Amazon/Walmart Sponsored Products/Brands/Display 广告优化。

任务：根据用户提供的过去30天 campaign 维度广告数据，识别并给出具体的优化建议。

输出格式 (严格 JSON)：
{
  "suggestions": [
    {
      "campaignId": "string",
      "campaignName": "string",
      "actionType": "increase_bid | decrease_bid | pause | enable",
      "field": "bid | budget | status",
      "currentValue": number,
      "suggestedValue": number,
      "reason": "中文简短说明，1-2 句话"
    }
  ]
}

约束：
- 每条建议 actionType 必须为枚举之一
- field 通常为 "bid"（出价）、"budget"（预算）或 "status"（状态）
- currentValue 是当前数值（出价或预算的近似值，可基于花费推断）
- suggestedValue 是建议数值（保留 2 位小数）
- reason 必须为中文，简短、含具体数据依据
- 若无可行建议，返回空数组 { "suggestions": [] }
- 不要添加额外解释文字，仅输出 JSON 对象`;

function buildUserPrompt(metrics: CampaignMetrics[]): string {
  const baseline = `目标 ACOS 基准：${TARGET_ACOS}%；CTR 基准：${CTR_BREACH_THRESHOLD * 5}%；高 ACOS 阈值（>${ACOS_BREACH_THRESHOLD}%）；低 CTR 阈值（<${CTR_BREACH_THRESHOLD}%，需 impressions > 1000）`;
  const json = JSON.stringify(
    metrics.map((m) => ({
      campaignId: m.campaignId,
      name: m.campaignName,
      adType: m.adType,
      spend: m.spend.toFixed(2),
      sales: m.sales.toFixed(2),
      acos: m.acos?.toFixed(2),
      ctr: m.ctr?.toFixed(3),
      impressions: m.impressions,
      clicks: m.clicks,
      orders: m.orders,
    })),
    null,
    2,
  );
  return `${baseline}\n\n以下是问题 campaign 的近30天数据：\n${json}\n\n请针对每个 campaign 给出 1 条最有价值的优化建议。`;
}
