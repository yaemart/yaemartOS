---
title: 'feat: S4 W43-W45 — AI 广告优化建议 + 执行闸门 + Rate Limiting'
type: feat
status: active
date: 2026-05-04
origin: docs/yaemartOS-implementation-plan.md
---

# S4 W43-W45：AI 广告优化建议 + 执行闸门 + Rate Limiting

## Overview

在 W40-W42 广告看板（数据同步 + 可视化）基础上，实现完整的「AI 建议 → 人工确认闸门 → 执行 → 24h 回滚」闭环。同步完成 S4 AI Rate Limiting 中间件（分模型独立令牌桶）。

这是 yaemartOS §2.2 Agent Native 核心要求：关键写入不得绕过人工确认，AI 建议必须可追溯、可回滚。

---

## Problem Frame

W40-W42 完成后，运营可看到广告日级数据（花费/销售/ACOS/CTR/CVR），但：

1. **没有 AI 建议**：高 ACOS 词、低 CTR campaign 无自动诊断，运营靠目测决策；
2. **执行无闸门**：广告调价/出价修改若将来接入 Lingxing，必须经人工确认（M-09 / §13）；
3. **无 Rate Limiting**：AI 服务（Gemini/GLM-5）高峰期并发建议请求无品牌级配额隔离。

本切片解决上述三个问题，同时满足合规要求（M-09 广告变更可回滚、M-10 审计日志）。

---

## Requirements Trace

- R1. AI 广告优化建议（GLM-5 中文输出）：高 ACOS campaign 识别 + 调价/出价建议
- R2. 执行闸门：AI 建议 → 运营勾选 → 二次确认弹窗 → 执行 → 变更日志（§13 不可绕过确认）
- R3. 变更日志：type / 旧值 / 新值 / 执行人 / 时间戳（M-10，100% 覆盖关键写操作）
- R4. 24h 单次回滚（M-09）：执行后 24h 内可一键回滚到前值；回滚本身也记录日志
- R5. AI Rate Limiting：分模型（Gemini Pro/Flash/GLM-5）独立令牌桶；按 brand 二级配额；超额排队而非直接 429
- R6. Feature Flag 保护：`AD_SUGGESTION` 功能开关，支持按品牌灰度

---

## Scope Boundaries

- 不含：实际调用 Lingxing API 写入广告平台（W43-W45 建议单为「决策辅助」，执行按钮当前调用本地 Change Log 模拟；Lingxing 广告写入 API 接入留 W46+）
- 不含：Dayparting 调度逻辑（W46-W47 计划）
- 不含：自动化批量执行（必须保持单条逐条人工确认）
- 不含：P2-A/P2-B Prompt 模板 DB 化（仍为代码内 prompt）

### Deferred to Follow-Up Work

- Lingxing 广告写入 API 实际调用：W46+ 实现后更新 `executeChange` 方法
- 自然语言查询广告建议（MCP tool `listAdSuggestions`）：W45 末补充工具描述符

---

## Context & Research

### Relevant Code and Patterns

- `apps/api/src/ad-dashboard/ad-dashboard.service.ts` — `queryDashboard()` 返回 spend/sales/impressions/clicks/orders 聚合；ACOS 已计算
- `apps/api/src/ai/providers/glm-generation.service.ts` — `generateText(prompt)` + `generateJson<T>(system, user)` + mock 分支（无 ZHIPU_API_KEY 时）
- `apps/api/src/ai/faq-generation.service.ts` — 完整调用范式：`glm.generateJson` + `CostTrackingService.record(taskType, model, promptTokens, completionTokens, brandId)`
- `apps/api/src/common/audit/audit.service.ts` — `logWrite({ action, entity, entityId, metadata: {before, after} })`；`AuditLog` 表已有 userId/tenant/action/entity/entityId/metadata/createdAt
- `apps/api/src/listing/listing-version.service.ts` — `activateVersion()` / `archiveActiveVersions()` 体现了"AI 写 draft、人工 activate"的门控语义
- `apps/web/components/shop/shop-binding-list.tsx` — `ConfirmDialog` 二次确认组件范式
- `apps/api/src/app.module.ts` — `ThrottlerModule.forRoot` 全局配置；`customer-portal` chat controller 的 `@Throttle` 为控制器级覆盖范本
- `apps/api/src/common/feature-flag/feature-flag.guard.ts` — `FeatureFlagGuard` + `RequireFeatureFlag` 模式

### Institutional Learnings

- `docs/solutions/backend-patterns/nestjs-prisma-neon-multitenant-2026-04-30.md`：审计日志双层方案（Prisma Extension + PG 触发器）；BullMQ worker 里 `ClsService` 需手动 `cls.run()` 才能保留 userId 上下文

### External References

- 无需外部研究：GLM-5 调用、Throttler、AuditLog 在库内都有现成示例

---

## Key Technical Decisions

- **建议单粒度为 Campaign**：`AdDailyStat` 已有 `campaignId + campaignName`，以 campaign 为最小建议单元（而非关键词），符合当前数据粒度，实现可行
- **AdSuggestion + AdChange 新表（而非复用 AuditLog.metadata）**：建议单和变更需单独查询、分页、状态管理，JSON blob 无法高效索引；两张专用表更清晰
- **GLM-5 建议格式**：用 `generateJson<AdSuggestion[]>` 返回结构化数组（actionType/campaignId/field/currentValue/suggestedValue/reason），避免前端解析自由文本
- **Rate Limiting 策略**：扩展现有 Throttler，用自定义 `ThrottlerStorageRedisService` + key 策略 `${model}:${brandId}:${userId}`，而不是另起一套 Redis 计数器；超额时在 BullMQ 队列异步处理（非 429 直拒）
- **24h 回滚**：`AdChange` 表存 `executedAt + reversibleBefore`（+24h）+ `snapshotBefore JSON`；`rollback()` 方法检查时间窗口，执行反向操作并写 Audit
- **执行动作 MVP（本期）**：建议单执行仅更新 `AdChange` 状态为 `executed`（本地模拟），不真正写 Lingxing；待 W46+ Lingxing 写 API 接入后注入 `executeChange` 实现

---

## Open Questions

### Resolved During Planning

- Q: CTR/CVR 是否需要在 DB 计算还是推导？
  Resolution: 后端建议生成时在 service 内按 `clicks/impressions` 和 `orders/clicks` 实时计算；不增加派生字段到 DB
- Q: 建议单超时 / 运营未处理 — 如何过期？
  Resolution: `AdSuggestion` 增加 `expiresAt`（默认创建后 7 天），过期自动变 `expired` 状态（定时任务或查询时懒过期）
- Q: Rate Limiting 超额是 429 还是排队？
  Resolution: 广告建议生成是非实时操作（运营点"生成建议"），走 BullMQ 排队；实时 dashboard 查询不限速

### Deferred to Implementation

- 最优 GLM-5 prompt 措辞（中文）：在实际生成测试中迭代
- Lingxing 广告执行 API 具体字段（W46+ 接入时更新 `executeChange`）

---

## High-Level Technical Design

> _这是方案的方向性概述，作为审查指导而非实现规格。_

```
运营点「生成建议」
  │
  ▼
POST /ads/suggestions/generate
  ├── 检查 feature flag AD_SUGGESTION
  ├── Rate Limit: ${GLM_MODEL}:${brandId} token bucket → BullMQ 排队
  ├── AdDashboardService.queryDashboard(30天) → 识别高ACOS/低CTR campaigns
  └── GlmGenerationService.generateJson<AdSuggestion[]>(systemPrompt, metricsJson)
        └── 结果持久化 AdSuggestion[] (status=pending)
              └── 返回 suggestionBatchId

运营看建议单 → 勾选 → 点「执行」
  │
  ▼
POST /ads/suggestions/:id/execute        (执行闸门：仅能执行 pending 状态)
  ├── 校验 status=pending, userId=operator
  ├── 前端已弹确认弹窗（浏览器端 ConfirmDialog）
  ├── AuditService.logWrite(before: campaign当前, after: suggested)
  ├── AdChange.create(status=executed, snapshotBefore, reversibleBefore=now+24h)
  ├── [MVP] 本地状态变更（不写 Lingxing）
  └── 返回 {changeId, reversibleBefore}

运营点「回滚」（24h 内）
  │
  ▼
POST /ads/changes/:changeId/rollback
  ├── 检查 reversibleBefore > now
  ├── AuditService.logWrite(action: rollback, before: executed, after: snapshot)
  └── AdChange.status = rolled_back
```

---

## Implementation Units

- [ ] U1. **AdSuggestion + AdChange 数据模型**

**Goal:** 新建 `AdSuggestion`（建议单）和 `AdChange`（执行变更记录）两张表，以支持执行闸门和 24h 回滚。

**Requirements:** R1, R2, R3, R4

**Dependencies:** None

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_ad_suggestion_change/migration.sql`

**Approach:**

- `AdSuggestion`：`id, shopId, brandId, batchId, campaignId, campaignName, adType, actionType (enum: increase_bid/decrease_bid/pause/enable), field, currentValue(Decimal), suggestedValue(Decimal), reason, status(enum: pending/accepted/rejected/executed/expired), generatedBy(userId?), expiresAt, createdAt`；`@@index([shopId, status])`；`@@schema("public")`
- `AdChange`：`id, suggestionId(FK→AdSuggestion?), shopId, brandId, campaignId, actionType, field, valueBefore(Decimal), valueAfter(Decimal), executedAt, executedBy, reversibleBefore, rolledBackAt, rolledBackBy, status(enum: executed/rolled_back), metadata(Json?)`；`@@index([shopId, executedAt])`；`@@schema("public")`
- `AdType` 枚举已存在，`actionType` 新枚举 `AdActionType`

**Test scenarios:**

- Happy path：`AdSuggestion` unique constraint 不冲突（同 batch 同 campaignId 同 field 允许）
- Edge case：`expiresAt` 7 天后状态应懒标记为 `expired`
- Integration：`AdChange.suggestionId` FK 级联删除（或 SetNull）行为验证

**Verification:** Prisma migration 运行无报错；TypeScript generated types 包含新模型；`prisma studio` 可查两张表

---

- [ ] U2. **AI Rate Limiting 中间件**

**Goal:** 为 AI 建议生成端点添加品牌级 + 模型级速率控制，超额走 BullMQ 排队而非直接拒绝。

**Requirements:** R5

**Dependencies:** None（独立于其他 unit）

**Files:**

- Create: `apps/api/src/ai/rate-limit/ai-rate-limit.guard.ts`
- Create: `apps/api/src/ai/rate-limit/ai-rate-limit.module.ts`
- Create: `apps/api/src/ai/rate-limit/ai-rate-limit.decorator.ts`（`@AiRateLimit(model, requestsPerMinute)` 装饰器）
- Modify: `apps/api/src/ai/ai.module.ts`（导出 `AiRateLimitModule`）

**Approach:**

- 基于 Redis (`REDIS_URL`) 实现滑动窗口计数：key = `ai_rl:${model}:${brandId}`，60s 窗口
- Guard 读取 `request.resolvedBrandId`（由 `TenantGuard` 注入）+ 装饰器 metadata 中的 model slug
- 超额时 throw `TooManyRequestsException` 并在 response header 带 `X-Rate-Limit-Reset`（若广告建议改成 BullMQ 异步，此 guard 可降级为排队逻辑）
- S4 引入时仅 GLM-5 建议生成路由使用 `@AiRateLimit('glm-4-flash', 10)`（10 次/分/品牌）

**Patterns to follow:**

- `apps/api/src/customer-portal/chat/chat.controller.ts` 的 `@Throttle` 装饰器覆盖方式
- `apps/api/src/common/feature-flag/feature-flag.guard.ts` Guard 结构

**Test scenarios:**

- Happy path：第 1-10 次请求通过（同 brandId，60s 内）
- Edge case：第 11 次请求被拒；60s 后重置允许通过
- Edge case：不同 brandId 互不影响（Homtone 达限不影响 Spoonlemon）
- Error path：Redis 不可用时 Guard fail-open（放行，打 warn log），不中断业务

**Verification:** 单元测试模拟 Redis 计数；集成测试验证不同品牌独立计数

---

- [ ] U3. **AdSuggestionService — GLM-5 建议生成**

**Goal:** 从 `AdDailyStat` 聚合最近 30 天数据，识别高 ACOS（>目标 ACOS 130%）或低 CTR（<0.3%）的 campaigns，调用 GLM-5 生成结构化中文建议单。

**Requirements:** R1, R6

**Dependencies:** U1（AdSuggestion 表），U2（Rate Limiting guard 需先存在）

**Files:**

- Create: `apps/api/src/ad-suggestion/ad-suggestion.service.ts`
- Create: `apps/api/src/ad-suggestion/ad-suggestion.controller.ts`
- Create: `apps/api/src/ad-suggestion/ad-suggestion.module.ts`
- Create: `apps/api/src/ad-suggestion/dto/generate-suggestion.dto.ts`（shopId required; startDate/endDate optional 默认 30 天）
- Modify: `apps/api/src/app.module.ts`（导入 `AdSuggestionModule`）
- Test: `apps/api/src/ad-suggestion/ad-suggestion.service.spec.ts`

**Approach:**

- `POST /ads/suggestions/generate`：受 `JwtAuthGuard` + `CasbinGuard`（ads:write）+ `FeatureFlagGuard`（AD_SUGGESTION）+ `@AiRateLimit('glm-4-flash', 10)` 保护
- `GET /ads/suggestions?shopId=&status=&page=`：分页列出建议单（ads:read 权限）
- Service 内：1) 查 30 天 `AdDailyStat groupBy campaignId`，计算 ACOS/CTR；2) 过滤出问题 campaigns；3) 构造 system prompt + metrics JSON（中文）；4) `GlmGenerationService.generateJson<AdSuggestionItem[]>`；5) 批量 `AdSuggestion.createMany`
- `CostTrackingService.record('ads.suggest', process.env.GLM_MODEL, ...)` 记录 AI 成本
- `batchId = cuid()` 标记同一次生成的所有建议

**GLM prompt 骨架（方向性）**：

```
System: 你是专业跨境电商广告优化顾问，根据提供的广告数据给出具体的调价或暂停建议。
        输出格式为 JSON 数组，每条包含：campaignId, campaignName, actionType, field, currentValue, suggestedValue, reason。
        actionType 枚举：increase_bid / decrease_bid / pause / enable
User: 以下是过去30天广告数据（品牌: ${brandId}）：[{...}]
      目标 ACOS 基准：30%，CTR 基准：0.3%
      请针对 ACOS 超过基准 130%（>39%）或 CTR 低于 0.1% 的 campaign 给出建议。
```

**Patterns to follow:**

- `apps/api/src/ai/faq-generation.service.ts` — `generateJson` + `CostTrackingService` 完整范式

**Test scenarios:**

- Happy path：mockGlm 返回 2 条建议 → service 持久化 2 条 `AdSuggestion`，status=pending
- Edge case：所有 campaign ACOS 达标 → GLM 返回空数组 → 返回 `{count: 0, message: "当前数据无需优化"}`
- Edge case：30 天内无数据（新店）→ 提前 return，不调 GLM
- Error path：GLM 返回非法 JSON → `generateJson` 抛出 → controller 返回 500，已有 mock 分支保障测试可运行
- Integration：生成的建议 `batchId` 相同；`expiresAt` 为 now+7 天

**Verification:** 394 已有测试不退化；新增测试覆盖上述场景；TypeScript clean

---

- [ ] U4. **执行闸门 API — 执行 / 拒绝 / 回滚**

**Goal:** 提供建议单的执行、拒绝、回滚端点，确保所有写操作都有审计日志且 24h 内可回滚。

**Requirements:** R2, R3, R4

**Dependencies:** U1（AdChange 表），U3（AdSuggestion service 已存在）

**Files:**

- Modify: `apps/api/src/ad-suggestion/ad-suggestion.controller.ts`（新增路由）
- Modify: `apps/api/src/ad-suggestion/ad-suggestion.service.ts`（新增 execute/reject/rollback 方法）
- Create: `apps/api/src/ad-suggestion/dto/execute-suggestion.dto.ts`
- Test: 更新 `apps/api/src/ad-suggestion/ad-suggestion.service.spec.ts`

**Approach:**

- `PATCH /ads/suggestions/:id/execute`（ads:write）：
  1. 校验 suggestion.status === 'pending'，否则 `BadRequestException`
  2. `AdChange.create({ suggestionId, snapshotBefore: currentValue, status: 'executed', reversibleBefore: now+24h })`
  3. `AdSuggestion.update({ status: 'accepted' })`
  4. `AuditService.logWrite({ action: 'ad_suggestion_execute', entity: 'AdSuggestion', entityId, metadata: { before: currentValue, after: suggestedValue } })`
  5. [MVP] 返回 `{ changeId, reversibleBefore }`（不调 Lingxing，TODO 注释标记接入点）
- `PATCH /ads/suggestions/:id/reject`（ads:write）：update status=rejected + audit
- `POST /ads/changes/:changeId/rollback`（ads:write）：
  1. 校验 change.status === 'executed' && change.reversibleBefore > now
  2. `AdChange.update({ status: 'rolled_back', rolledBackAt: now, rolledBackBy: userId })`
  3. `AdSuggestion.update({ status: 'pending' })` 或保持 accepted（视业务决策）
  4. `AuditService.logWrite({ action: 'ad_change_rollback', ... })`
- `GET /ads/changes?shopId=&page=`（ads:read）：变更历史列表

**Test scenarios:**

- Happy path：execute 成功 → AdChange status=executed，AdSuggestion status=accepted，AuditLog 有记录
- Happy path：rollback 在 24h 内 → 状态 rolled_back，AuditLog 有回滚记录
- Error path：execute 已 accepted 建议 → 返回 400 BadRequest
- Error path：rollback 超过 24h → 返回 400 "回滚窗口已过期"
- Error path：rollback 已回滚的变更 → 返回 400
- Integration：AuditLog.entity = 'AdSuggestion' 可被 AuditService 正确写入

**Verification:** 执行后 `AdChange` 表有记录；回滚后 status 正确；AuditLog 完整；TypeScript clean

---

- [ ] U5. **前端：建议单页面 + 确认弹窗 + 变更历史**

**Goal:** 在广告看板旁新增「优化建议」Tab，展示建议单列表（可勾选执行/拒绝），执行前弹确认弹窗，并提供变更历史查看和 24h 回滚按钮。

**Requirements:** R2, R4

**Dependencies:** U3（建议生成 API），U4（执行/回滚 API）

**Files:**

- Create: `apps/web/app/[locale]/(admin)/ads/suggestions/page.tsx`（SSR 服务端组件）
- Create: `apps/web/app/[locale]/(admin)/ads/suggestions/suggestion-list-client.tsx`（客户端交互）
- Create: `apps/web/app/[locale]/(admin)/ads/suggestions/change-history-client.tsx`
- Create: `apps/web/lib/api/ad-suggestion-client.ts`（API fetch 函数）
- Modify: `apps/web/app/[locale]/(admin)/ads/dashboard/page.tsx`（或广告导航新增 Tab）

**Approach:**

- 建议单列表：以卡片展示每条 `AdSuggestion`（campaign 名、当前/建议值、理由、状态徽章）
- 勾选 → 「执行」按钮激活 → 弹 `AlertDialog`（shadcn/ui `@radix-ui/react-alert-dialog`）：二次确认内容展示变更详情
- 执行成功后：`router.refresh()` 更新列表；toast 提示「已执行，24h 内可回滚」
- 变更历史 Tab：按时间倒序展示 `AdChange`，`reversibleBefore > now` 时显示「回滚」按钮
- Feature flag `AD_SUGGESTION=false` 时页面返回 null（与 AD_DASHBOARD 模式一致）
- 空状态处理：无建议时提示「当前广告数据表现良好，无需优化」

**Patterns to follow:**

- `apps/web/app/[locale]/(admin)/ads/dashboard/ad-dashboard-client.tsx` — 品牌/功能 flag 处理模式
- `apps/web/components/shop/shop-binding-list.tsx` — `ConfirmDialog` 二次确认模式
- `apps/web/components/migration/import-job-progress.tsx` — 状态徽章 + 轮询更新模式

**Test scenarios:**

- Happy path：建议列表渲染 3 条，勾选 → 弹窗 → 确认 → 列表刷新，badge 变为 accepted
- Happy path：变更历史显示 1 条执行记录，回滚按钮点击 → 确认弹窗 → 回滚成功
- Edge case：24h 回滚窗口已过 → 回滚按钮不显示（UI 层隐藏，API 层兜底拒绝）
- Edge case：AD_SUGGESTION feature flag 关闭 → 页面不渲染（返回 null）
- Error path：execute API 返回 400 → toast 展示错误信息，不清空勾选

**Verification:** 建议单页面可访问、确认弹窗正常弹出、执行后状态刷新、回滚后 toast 出现；`pnpm build --filter @yaemartos/web` 无报错

---

## System-Wide Impact

- **Interaction graph**：`AdSuggestionModule` 依赖 `AdDashboardModule`（数据查询）、`AiModule`（GLM-5）、`AdminModule` 内 AuditService；前端新增 `/ads/suggestions` 路由，不影响 `/ads/dashboard`
- **Error propagation**：GLM-5 调用失败 → service 抛 `ServiceUnavailableException`，建议单不写库，前端显示"生成失败"；执行失败 → 返回 500，`AdChange` 不写库（事务保护）
- **State lifecycle risks**：`AdSuggestion.status` 状态机：`pending → accepted | rejected`，`accepted + executed → (see AdChange)`；状态转换应在 service 事务中完成
- **API surface parity**：新增 `listAdSuggestions`、`generateAdSuggestions`、`executeAdSuggestion`、`rollbackAdChange` 需同步添加 MCP 工具描述符（`apps/api/src/ai/tools/yaemartos-tools.ts`），见 Deferred
- **Integration coverage**：`AuditService.logWrite` 在 U4 跨越 AuditModule 边界，需确认 `AdSuggestionModule` imports 中包含 AuditModule
- **Unchanged invariants**：`AdDailyStat` 数据写入路径（`AdSyncService`）不变；`AdDashboardController` 端点不变；现有 394 单元测试全量不退化

---

## Risks & Dependencies

| Risk                                       | Mitigation                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| GLM-5 中文建议质量不稳定                   | prompt 中明确 JSON schema + 枚举值约束；`generateJson` 失败时返回友好错误而非原始响应   |
| 运营误操作执行后无法恢复                   | 24h 回滚是硬约束（`reversibleBefore` 时间窗口）；变更历史常驻显示                       |
| Rate Limit Redis 不可达                    | Guard fail-open（放行 + warn log），业务不中断                                          |
| Lingxing 广告写入 API 未接入（MVP 空实现） | `executeChange` 方法内留 `// TODO: call lingxing.ads.update()` 注释；MVP 仅更新本地状态 |
| `AdSuggestion.expiresAt` 过期清理          | 懒过期（查询时过滤）+ 可选后台 cron（W46+ 时加入）；不阻塞本期上线                      |

---

## Documentation / Operational Notes

- Feature Flag：在 `SystemConfig` 表添加 `feature_flag.AD_SUGGESTION=false` 种子数据（`apps/api/prisma/seed.ts`）
- 环境变量：`GLM_MODEL` 已有；确认 `ZHIPU_API_KEY` 在 staging `.env.local` 中已配置，否则 mock 分支兜底
- 上线顺序：U1 migration → U2/U3/U4 后端（可并行）→ U5 前端；Feature Flag 先关闭上线，验证后按品牌开启

---

## Sources & References

- **Origin document:** [docs/yaemartOS-implementation-plan.md](docs/yaemartOS-implementation-plan.md) §9 W43-W45
- Related code: `apps/api/src/ad-dashboard/`, `apps/api/src/ai/providers/glm-generation.service.ts`, `apps/api/src/common/audit/audit.service.ts`
- Plan 002: [docs/plans/2026-05-04-002-agent-native-improvements-plan.md](docs/plans/2026-05-04-002-agent-native-improvements-plan.md)
