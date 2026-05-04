import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaClientManager } from '../database/prisma.service';
import { GlmGenerationService } from '../ai/providers/glm-generation.service';
import { CostTrackingService } from '../ai/cost-tracking.service';
import { AuditService } from '../common/audit/audit.service';
import { RealtimeBusService } from '../realtime/realtime-bus.service';
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
/** Cap the number of campaigns sent to GLM to keep prompt size bounded and tokens predictable. */
const MAX_CAMPAIGNS_PER_PROMPT = 50;
const VALID_ACTION_TYPES: ReadonlySet<string> = new Set([
  'increase_bid',
  'decrease_bid',
  'pause',
  'enable',
] satisfies AdActionType[]);
const VALID_FIELDS: ReadonlySet<string> = new Set(['bid', 'budget', 'status']);

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
    private readonly config: ConfigService,
    private readonly realtimeBus: RealtimeBusService,
  ) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  /**
   * Verifies the shop belongs to the given brand. Required before any cross-tenant
   * read/write. Throws ForbiddenException if the shop is owned by a different brand,
   * NotFoundException if it does not exist.
   */
  private async assertShopOwnership(shopId: string, brandId: string): Promise<void> {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { brandId: true },
    });
    if (!shop) {
      throw new NotFoundException(`Shop ${shopId} not found`);
    }
    if (shop.brandId !== brandId) {
      throw new ForbiddenException('Shop does not belong to current brand');
    }
  }

  async generate(opts: {
    shopId: string;
    brandId: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    // P0: enforce cross-brand isolation before reading any shop-scoped data.
    await this.assertShopOwnership(opts.shopId, opts.brandId);

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

    // Bound prompt size: rank by spend desc and take top N. High-spend campaigns
    // dominate ROI impact, so this is an intentional triage rather than truncation.
    const promptCampaigns = [...breaching]
      .sort((a, b) => b.spend - a.spend)
      .slice(0, MAX_CAMPAIGNS_PER_PROMPT);

    const startedAt = Date.now();
    let suggestions: AdSuggestionItem[] = [];
    let glmError: unknown = null;

    try {
      const result = await this.glm.generateJson<{ suggestions: AdSuggestionItem[] }>(
        SYSTEM_PROMPT,
        buildUserPrompt(promptCampaigns),
      );
      suggestions = Array.isArray(result?.suggestions) ? result.suggestions : [];
    } catch (err) {
      glmError = err;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`GLM generate failed for shop=${opts.shopId}: ${message}`);
    }

    // Cost tracking is best-effort: never let it shadow the GLM result or rethrow.
    // Run after the GLM call so success-path tokens are recorded; on GLM failure
    // we still record the prompt tokens consumed.
    try {
      const promptChars = SYSTEM_PROMPT.length + JSON.stringify(promptCampaigns).length;
      await this.costTracking.record({
        model: this.config.get<string>('GLM_MODEL') ?? 'glm-4-flash',
        taskType: 'ads.suggest',
        brandId: opts.brandId,
        promptTokens: Math.ceil(promptChars / 4),
        completionTokens: Math.ceil(JSON.stringify(suggestions).length / 4),
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Cost tracking record failed (non-fatal): ${message}`);
    }

    if (glmError) {
      throw glmError;
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

    // Validate each GLM suggestion before persistence. Defensive against
    // (1) hallucinated campaignIds, (2) invalid actionType / field strings,
    // (3) non-numeric or out-of-range values.
    const validSuggestions = suggestions
      .filter((s) => {
        if (!campaignByid.has(s.campaignId)) {
          return false;
        }
        if (!VALID_ACTION_TYPES.has(s.actionType)) {
          return false;
        }
        if (!VALID_FIELDS.has(s.field)) {
          return false;
        }
        if (typeof s.currentValue !== 'number' || !Number.isFinite(s.currentValue)) {
          return false;
        }
        if (typeof s.suggestedValue !== 'number' || !Number.isFinite(s.suggestedValue)) {
          return false;
        }
        if (s.currentValue < 0 || s.suggestedValue < 0) {
          return false;
        }
        if (typeof s.reason !== 'string' || s.reason.trim().length === 0) {
          return false;
        }
        return true;
      })
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
      });

    if (validSuggestions.length < suggestions.length) {
      this.logger.warn(
        `Filtered ${suggestions.length - validSuggestions.length}/${suggestions.length} GLM suggestions for shop=${opts.shopId} due to validation failures`,
      );
    }

    if (validSuggestions.length === 0) {
      return {
        batchId: null,
        count: 0,
        message: 'AI 输出未通过校验，请稍后重试',
      };
    }

    const created = await this.prisma.adSuggestion.createMany({ data: validSuggestions });

    // Realtime fanout: the suggestions table refreshes from a single event
    // because the UI re-fetches the page list rather than upserting per-row.
    // We pass `shopId` so client code can ignore events for other shops.
    if (created.count > 0) {
      void this.realtimeBus.publish({
        entity: 'ad-suggestion',
        action: 'create',
        brandId: opts.brandId,
        ids: [batchId],
        actorType: opts.userId ? 'user' : 'agent',
        actorId: opts.userId,
        timestamp: Date.now(),
        metadata: { shopId: opts.shopId, count: created.count },
      });
    }

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

    // Lazy-expire: callers asking for `pending` should not see lazy-expired rows.
    // Apply the expiresAt filter in the WHERE clause so `total` matches the
    // projected `records` and pagination is correct.
    const now = new Date();
    const baseWhere = {
      brandId: opts.brandId,
      ...(opts.shopId ? { shopId: opts.shopId } : {}),
    };
    const where =
      opts.status === AdSuggestionStatus.pending
        ? { ...baseWhere, status: AdSuggestionStatus.pending, expiresAt: { gt: now } }
        : opts.status === AdSuggestionStatus.expired
          ? {
              ...baseWhere,
              OR: [
                { status: AdSuggestionStatus.expired },
                { status: AdSuggestionStatus.pending, expiresAt: { lte: now } },
              ],
            }
          : opts.status
            ? { ...baseWhere, status: opts.status }
            : baseWhere;

    const [records, total] = await Promise.all([
      this.prisma.adSuggestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.adSuggestion.count({ where }),
    ]);

    // Project pending+expired rows to logical `expired` for the UI.
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
    // Pre-flight read for ownership + readable error messages. The actual
    // status transition is gated by an atomic compare-and-set inside the tx.
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
      // Atomic CAS: only flip pending -> executed, and only if not yet expired.
      // updateMany returns count=0 when WHERE doesn't match, so two concurrent
      // requests cannot both transition the same row.
      const cas = await tx.adSuggestion.updateMany({
        where: { id, brandId, status: AdSuggestionStatus.pending, expiresAt: { gt: now } },
        data: { status: AdSuggestionStatus.executed, updatedAt: now },
      });
      if (cas.count === 0) {
        throw new ConflictException(
          'Suggestion is no longer pending or has expired (concurrent update)',
        );
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

    const ts = Date.now();
    const actorType = userId ? 'user' : 'agent';
    void this.realtimeBus.publish({
      entity: 'ad-suggestion',
      action: 'update',
      brandId,
      ids: [id],
      actorType,
      actorId: userId,
      timestamp: ts,
      metadata: { shopId: suggestion.shopId, status: AdSuggestionStatus.executed },
    });
    void this.realtimeBus.publish({
      entity: 'ad-change',
      action: 'create',
      brandId,
      ids: [change.id],
      actorType,
      actorId: userId,
      timestamp: ts,
      metadata: { shopId: suggestion.shopId, suggestionId: id },
    });

    return { suggestion: { ...suggestion, status: AdSuggestionStatus.executed }, change };
  }

  async reject(id: string, brandId: string, userId?: string) {
    const suggestion = await this.findOne(id, brandId);
    if (suggestion.status !== AdSuggestionStatus.pending) {
      throw new ConflictException(`Suggestion is in status=${suggestion.status}, cannot reject`);
    }
    // Atomic CAS to guard against concurrent reject/execute racing past findOne.
    const cas = await this.prisma.adSuggestion.updateMany({
      where: { id, brandId, status: AdSuggestionStatus.pending },
      data: { status: AdSuggestionStatus.rejected, updatedAt: new Date() },
    });
    if (cas.count === 0) {
      throw new ConflictException('Suggestion is no longer pending (concurrent update)');
    }

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

    void this.realtimeBus.publish({
      entity: 'ad-suggestion',
      action: 'update',
      brandId,
      ids: [id],
      actorType: userId ? 'user' : 'agent',
      actorId: userId,
      timestamp: Date.now(),
      metadata: { shopId: suggestion.shopId, status: AdSuggestionStatus.rejected },
    });

    return { ...suggestion, status: AdSuggestionStatus.rejected };
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
      // Atomic CAS on the change row: only one rollback can win.
      const cas = await tx.adChange.updateMany({
        where: {
          id: changeId,
          brandId,
          status: AdChangeStatus.executed,
          reversibleBefore: { gt: now },
        },
        data: {
          status: AdChangeStatus.rolled_back,
          rolledBackAt: now,
          rolledBackBy: userId,
        },
      });
      if (cas.count === 0) {
        throw new ConflictException(
          'Change is no longer reversible (already rolled back or window closed)',
        );
      }

      // Reload the updated change row for the response. Since we just CAS-updated
      // it, this read is safe inside the transaction.
      const updatedChange = await tx.adChange.findUniqueOrThrow({ where: { id: changeId } });

      // Best-effort: revert the source suggestion to a coherent post-rollback
      // state. We pick `pending` only when it is still within its TTL — an
      // already-expired suggestion must transition to `expired` instead, never
      // back to pending (otherwise list() would mark it expired-via-projection
      // again and execute() would refuse it, leaving the UI confused).
      // updateMany silently no-ops if the suggestion was deleted, which is the
      // intended degraded behaviour rather than a 500.
      if (change.suggestionId) {
        const suggestion = await tx.adSuggestion.findUnique({
          where: { id: change.suggestionId },
          select: { expiresAt: true },
        });
        const nextStatus =
          suggestion && suggestion.expiresAt < now
            ? AdSuggestionStatus.expired
            : AdSuggestionStatus.pending;
        await tx.adSuggestion.updateMany({
          where: { id: change.suggestionId, brandId },
          data: { status: nextStatus, updatedAt: now },
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

    const ts = Date.now();
    const actorType = userId ? 'user' : 'agent';
    void this.realtimeBus.publish({
      entity: 'ad-change',
      action: 'update',
      brandId,
      ids: [changeId],
      actorType,
      actorId: userId,
      timestamp: ts,
      metadata: { shopId: change.shopId, status: AdChangeStatus.rolled_back },
    });
    if (change.suggestionId) {
      void this.realtimeBus.publish({
        entity: 'ad-suggestion',
        action: 'update',
        brandId,
        ids: [change.suggestionId],
        actorType,
        actorId: userId,
        timestamp: ts,
        metadata: { shopId: change.shopId, action: 'rollback' },
      });
    }

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
