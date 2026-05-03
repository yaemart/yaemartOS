---
title: 'feat: W24-W25 多平台 Listing 批量生成 + 矩阵分析'
type: feat
status: active
date: 2026-05-03
---

# feat: W24-W25 多平台 Listing 批量生成 + 矩阵分析

## Overview

W21-W23 完成了 Path A 存量数据迁移（店铺选择器、质量报告）。W24-W25 交付 S2 的最后两个关键能力：

1. **批量多平台生成**：同一产品一键生成 Amazon + Walmart 两个平台的 Listing（仍限英语），并行触发、分别落库。
2. **L1 审计日志完整化**：为 Listing 写操作补充 before/after 状态快照，满足 M-10（关键写操作 100% 审计）的"变更前后"要求。
3. **L2 矩阵分析 dashboard**：按产品聚合视图，展示同产品下所有 listing（跨店铺、跨 ASIN）的 Title 文本相似度（Gemini embedding 余弦距离）与 `trafficStrategy` 分布。命名中性化（"矩阵分析" / "差异化建议"），不出现任何合规风险字眼。

本计划对应实施方案 §7 S2 W24-W25，是 W26 S2 上线（12 人 beta）前的最后功能块。

---

## Problem Frame

- 运营人员每次只能生成一个平台的 Listing，双平台操作需手动重复两次，耗时且容易遗漏。
- 现有审计日志（`listing.update` 记录 `input`）不含变更前状态，无法做 before/after diff，不满足 M-10 的深度要求。
- 运营缺乏对"同一产品在不同平台/店铺的 Listing 差异化程度"的全局视图，无法判断是否需要调整 traffic strategy。

---

## Requirements Trace

- R1. 同一产品支持对 Amazon + Walmart 双平台并行触发 Listing 生成（英语），结果各自落入对应 Listing 记录
- R2. 每次 Listing 创建/编辑/状态变更/主 listing 切换均记录 before 与 after 完整状态快照
- R3. L2 矩阵分析 API 返回指定产品下所有 listing 的 Title 相似度矩阵与 trafficStrategy 分布
- R4. 矩阵分析前端 dashboard：可按产品查看跨平台 listing 汇总、相似度可视化、strategy 分布
- R5. 所有文案使用"矩阵分析"/"差异化建议"等中性词，不出现"违规"/"合规风险"字眼

---

## Scope Boundaries

- 不含销售额/曝光数据对比（依赖 S4 W40-W42 广告报告同步，届时在矩阵 API 中填充）
- 不含多语言批量生成（ES/FR — S3 W29-W30 交付）
- 不含 ES 向量字段扩展（矩阵相似度直接调 Gemini Embedding API + Redis 缓存，不写入 ES）
- L1 审计仅增强 `metadata` 结构，不新增数据库列（避免 migration）

---

## Context & Research

### Relevant Code and Patterns

- `apps/api/src/listing/listing.service.ts` — 现有 `create`、`update`、`remove` 均调用 `auditService.logWrite`；update 写 `metadata: input`（仅记录 input，缺 before 快照）
- `apps/api/src/listing/listing.controller.ts:86` — `POST /listings/:id/generate` 单条生成；输入 `GenerateListingInput`，调用 `IListingGenerationService.generateListing`
- `apps/api/src/common/audit/audit.service.ts` — `AuditInput.metadata?: unknown`，扩展 before/after 放 metadata 内部即可，无需 schema 变更
- `apps/api/src/ai/providers/gemini-listing-generation.service.ts` — 已有 Gemini Flash 生成实现，可复用接口
- `apps/api/src/ai/interfaces/listing-generation.interface.ts` — `IListingGenerationService.generateListing(input)` 接口
- `apps/api/src/ai/tokens.ts` — `LISTING_GENERATION_SERVICE` 注入 token
- `apps/api/src/listing/dto/create-listing.dto.ts` — 创建 DTO；`apps/api/src/listing/dto/update-listing.dto.ts` — 更新 DTO
- `apps/api/prisma/schema.prisma` — `Listing`（含 `shopId`、`platformId`、`language`、`isPrimary`、`trafficStrategy`）；`ListingVersion`；唯一约束 `(platformId, shopId, platformListingId)`

### Institutional Learnings

- `docs/solutions/backend-patterns/nestjs-prisma-neon-multitenant-2026-04-30.md` — NestJS + Prisma 事务/并发模式

---

## Key Technical Decisions

- **Embedding 缓存策略**：Redis key = `listing:embed:{listingId}:{sha256(title, 8 chars)}`，TTL 24h。标题变更时 hash 变化自动失效，无需主动清除。缓存未命中时调 Gemini `text-embedding-004`，结果以 `Float32Array` 序列化后存 Redis。
- **相似度计算**：服务端计算余弦相似度（`dotProduct / (|a| × |b|)`）；每产品 listing 数量小（≤ 20），无需向量数据库。
- **批量生成并发控制**：`Promise.allSettled` 并行触发各平台生成，每个任务独立返回成功/失败；单个平台失败不影响其他平台结果。
- **审计 before/after**：在 `assertExists` 拿到旧记录后立刻快照存入 before；操作完成后将结果存入 after；两者合并进 `metadata: { before, after, changedFields }` — 无 schema 变更。
- **矩阵 API 幂等性**：GET 接口可重复调用，embedding 从 Redis 读取（miss 时补全），不产生副作用。
- **命名规则**：前端所有标签/标题均使用"矩阵分析"/"差异化建议"/"相似度评分"，禁止"违规""合规风险"。

---

## Open Questions

### Resolved During Planning

- **Q: 矩阵分析是否需要实时销售数据？** → 不需要；R3/R4 只要求相似度 + strategy 分布。销售数据 S4 W40-W42 接入后在矩阵 API 中用 `null` 占位字段暴露，前端标注"数据将于 S4 上线后可用"。
- **Q: Embedding 是否需要写入 ES kNN 索引？** → 不需要；产品维度的 listing 数量极小，服务端 cosine 即可，ES 向量字段推迟到 S3 语义搜索。
- **Q: before/after 审计是否需要新数据库列？** → 不需要；放入现有 `metadata`（`Json` 类型）字段即可。

### Deferred to Implementation

- `changedFields` 数组的精确 diff 算法（深度对比 JSON vs. 字段级列举）— 实现时决定粒度。
- Gemini Embedding API 速率限制处理 — 视实际 quota 调整重试策略。

---

## High-Level Technical Design

> _此设计图仅说明意图，为审查提供方向，不作为实现规范。_

```
批量生成请求:
POST /listings/batch-generate
{ productId, shopIds: [{shopId, platformCode}], language }
        │
        ├── Promise.allSettled([
        │     generateForShop(shopId1, amazon),
        │     generateForShop(shopId2, walmart)
        │   ])
        │
        └── 每个 generateForShop:
              1. 查询 or 创建 Listing 记录（draft）
              2. 调用 IListingGenerationService.generateListing
              3. 写入生成内容 + 创建 ListingVersion
              4. 审计日志（L1 before/after）
              └── 返回 { listingId, platform, status }

矩阵分析:
GET /listings/matrix?productId=xxx
        │
        ├── findMany listings (含 title, trafficStrategy, platform, shop)
        ├── 对每个有 title 的 listing:
        │     Redis.GET(embed:key) → 命中直接用
        │     命中失败 → Gemini text-embedding-004 → Redis.SET
        ├── 计算 N×N 余弦相似度矩阵
        └── 返回 { listings, similarityMatrix, strategyDistribution, salesAvailableFrom: 'S4' }
```

---

## Implementation Units

- [ ] U1. **批量多平台 Listing 生成 API**

**Goal:** 一次请求触发指定产品在多个店铺（不同平台）的 Listing 并行生成，结果独立落库。

**Requirements:** R1

**Dependencies:** 无（已有单条生成服务）

**Files:**

- Modify: `apps/api/src/listing/listing.controller.ts`
- Modify: `apps/api/src/listing/listing.service.ts`
- Create: `apps/api/src/listing/dto/batch-generate-listing.dto.ts`
- Test: `apps/api/src/listing/listing.service.spec.ts`

**Approach:**

- 新增 `POST /listings/batch-generate` 端点，接受 `BatchGenerateListingDto`：`{ productId, targets: [{shopId, platformCode, language}] }`
- `ListingService.batchGenerate` 用 `Promise.allSettled` 并行调用 `generateForTarget(target)`
- `generateForTarget`：如果 `(productId, shopId, platformCode, language)` 对应的 draft listing 已存在则复用，否则创建新 listing → 调用 `IListingGenerationService.generateListing` → 更新 listing 内容 → 创建 `ListingVersion`
- 返回 `{ results: [{ listingId, shopId, platformCode, status: 'completed'|'failed', error? }] }`
- 若全部失败抛 `BadRequestException`；部分失败返回 200 含各条错误原因

**Patterns to follow:**

- 并发模式参考 `migration.controller.ts` `Promise.all`；DTO 风格参考 `create-listing.dto.ts`
- `IListingGenerationService` 注入参考 `listing.controller.ts:LISTING_GENERATION_SERVICE`

**Test scenarios:**

- Happy path: 两个 targets (amazon + walmart) 均成功 → results 包含 2 条 status=completed 的 listingId
- 部分失败: 一个 target 生成抛异常 → results 包含 1 completed + 1 failed(error)，HTTP 200
- 全部失败: 所有 target 失败 → HTTP 400
- 幂等性: 相同 target 重复调用 → 复用已有 draft listing，不新建重复记录
- Edge case: `targets` 为空数组 → HTTP 400
- Authorization: 无 token → 401；`listings:write` 策略未通过 → 403

**Verification:**

- TypeScript 零报错
- 测试全绿
- Postman/curl 对实际运行实例可触发两条 Listing 记录（一 Amazon 一 Walmart）

---

- [ ] U2. **L1 审计日志 before/after 增强**

**Goal:** 所有 Listing 写操作的审计条目包含完整的 before/after 状态快照，满足 M-10 要求。

**Requirements:** R2

**Dependencies:** 无

**Files:**

- Modify: `apps/api/src/listing/listing.service.ts`
- Modify: `apps/api/src/common/audit/audit.service.ts`（扩展 `AuditInput` type 文档）
- Test: `apps/api/src/listing/listing.service.spec.ts`

**Approach:**

- 在 `AuditInput` 的 JSDoc 中说明 `metadata` 可携带 `{ before, after, changedFields }` 结构（无需修改 Prisma schema 或 `AuditLog` 模型）
- `listing.service.ts` 的三处 `logWrite` 调用改为携带 before/after：
  - `create`：before = null，after = 创建结果（id、status、title、isPrimary 等核心字段快照）
  - `update`：调用前通过已有 `assertExists` 取到旧记录作为 before，操作后取 updated 记录作为 after；changedFields 为 `Object.keys(input)`
  - `isPrimary` 切换：额外记录被降级的其他 listing ids（`demotedIds: string[]`）
  - `delete`：before = 删除前记录快照，after = null
- 快照只包含可审计字段（id、status、title、isPrimary、trafficStrategy、updatedAt），不含 bullets/description 大文本（防止 metadata 过大）

**Patterns to follow:**

- 现有 `logWrite` 调用方式不变；`metadata` 扩展类型定义参考 `shops/shop.service.ts`

**Test scenarios:**

- Happy path: 调用 `update` 后，读取 `AuditLog` 记录的 `metadata.before.status` 应等于变更前值
- Happy path: `isPrimary=true` 的 update → `metadata.demotedIds` 包含被降级的 listing ids
- Edge case: `create` 的审计条目 `metadata.before` 为 null，`metadata.after.id` 非空
- Edge case: `delete` 的审计条目 `metadata.after` 为 null，`metadata.before.status === 'archived'`
- Integration: 完整 update 操作 → 验证 before ≠ after（当内容确实变化时）

**Verification:**

- 运行 `listing.service.spec.ts` 全绿
- DB 中 `AuditLog.metadata` 包含 before/after 结构（集成环境抽查）

---

- [ ] U3. **矩阵分析后端 API + EmbeddingService**

**Goal:** 提供 `GET /listings/matrix` 端点，返回指定产品下所有 listing 的相似度矩阵与 strategy 分布；新建 `EmbeddingService` 封装 Gemini Embedding 调用与 Redis 缓存。

**Requirements:** R3

**Dependencies:** 无

**Files:**

- Create: `apps/api/src/ai/embedding.service.ts`
- Create: `apps/api/src/ai/embedding.service.spec.ts`
- Modify: `apps/api/src/listing/listing.controller.ts`
- Modify: `apps/api/src/listing/listing.service.ts`
- Modify: `apps/api/src/listing/listing.module.ts`（注入 EmbeddingService）
- Modify: `apps/api/src/ai/ai.module.ts`（导出 EmbeddingService）

**Approach:**

- `EmbeddingService`：
  - 注入 `ConfigService`（读 `GEMINI_API_KEY`、`GEMINI_EMBED_MODEL`）和 `RedisService`（已有 IORedis 注入）
  - `embed(text: string): Promise<number[]>`：先查 Redis `listing:embed:{hash8}` → miss 则调 Vercel AI SDK `embedMany` 或 `@ai-sdk/google` embed → 序列化（JSON float array）存 Redis TTL 86400s
  - `cosineSimilarity(a: number[], b: number[]): number`：纯函数，不依赖外部服务
  - `pairwiseSimilarity(texts: { id: string; text: string }[]): Promise<Record<string, Record<string, number>>>`：对每对 listing 计算相似度，返回对称矩阵
- `GET /listings/matrix?productId=xxx`（`RequirePolicy: listings:read`）：
  - 查出 productId 下所有非 archived listing（含 platform、shop 关联）
  - 过滤有 title 的记录，调用 `pairwiseSimilarity`
  - 统计 `trafficStrategy` 分布（按策略值计数）
  - 返回 `{ listings, similarityMatrix, strategyDistribution, salesAvailableFrom: 'S4' }`
- `listings` 数组每条含：`id, title, platformCode, shopName, trafficStrategy, isPrimary, status`

**Patterns to follow:**

- Redis 注入模式参考 `packages/lingxing-client/src/client/auth-manager.ts`（IORedis SET/GET/DEL）
- Vercel AI SDK embed 参考官方文档：`embed` from `ai`，`google.textEmbeddingModel('text-embedding-004')`
- 模块导出模式参考 `apps/api/src/ai/ai.module.ts`

**Test scenarios:**

- Happy path: 3 条 listing（2 amazon + 1 walmart），标题各异 → similarityMatrix 3×3，对角线为 1
- Happy path: Redis 命中时不再调用 Gemini embed API（mock 验证调用次数）
- Edge case: 所有 listing 无 title → similarityMatrix 为空对象 `{}`
- Edge case: 只有 1 条 listing → similarityMatrix 含单条自身相似度 1.0
- Error path: Gemini API 失败 → 对应 listing 相似度返回 null 而非抛 500
- Edge case: `productId` 不存在 → 返回 `{ listings: [], similarityMatrix: {}, strategyDistribution: {} }`

**Verification:**

- `embedding.service.spec.ts` 全绿
- 端点返回包含 `strategyDistribution` 和 `similarityMatrix` 的 JSON
- Redis 中可见 `listing:embed:*` 键（集成环境验证）

---

- [ ] U4. **矩阵分析前端 Dashboard**

**Goal:** 运营可在 Listing 列表页或产品详情页触发"矩阵分析"视图，查看同产品的跨平台 listing 汇总、相似度评分与 strategy 分布。

**Requirements:** R4, R5

**Dependencies:** U3

**Files:**

- Create: `apps/web/components/listing/listing-matrix-dashboard.tsx`
- Create: `apps/web/lib/api/listing-client.ts`（新增 `getListingMatrix` 函数）或 Modify 已有 listing API client
- Modify: `apps/web/app/[locale]/(admin)/listings/[id]/page.tsx`（或适当入口页面，新增矩阵分析 Tab）

**Approach:**

- `listing-matrix-dashboard.tsx`（`'use client'`）：
  - 接受 `productId: string` 和 `token: string`
  - 调用 `getListingMatrix(token, productId)` 获取数据；展示 loading / error 状态
  - 布局分三区：
    1. **汇总卡片行**：listing 总数、平台分布（Amazon N / Walmart N）、primary listing 标注
    2. **相似度矩阵表**：以 listing 标题的前 30 字符为行列头，单元格显示 0–100% 相似度，用颜色梯度（低→高 = zinc-100→brand-primary/30%）表示；对角线为自身不显示
    3. **策略分布小图**：水平 bar chart（纯 CSS + tailwind），每条策略一行（`primary / variant / bundle / keyword_grab / seasonal / cohort_test`），用 `rgb(var(--brand-primary))` 填充
  - 空状态：listing 不足 2 条时显示提示"当前产品仅有 1 条 Listing，暂无可对比数据"
  - 标题/标签全部使用"矩阵分析"/"差异化建议"/"相似度评分"，不出现任何合规/风险字眼（R5）
- `getListingMatrix`：GET `${API_BASE}/listings/matrix?productId=${productId}` 带 Authorization header

**Patterns to follow:**

- Loading/error UI 参考 `apps/web/components/migration/trigger-import-form.tsx`（AbortController + 分支渲染）
- 颜色系统参考现有组件：`rgb(var(--brand-primary))`，不使用硬编码颜色
- API client 函数风格参考 `apps/web/lib/api/shop-client.ts`（`authHeaders` + `request<T>`）

**Test scenarios:**

- Happy path: 渲染包含相似度矩阵和 strategy 分布的完整 dashboard
- Edge case: 无数据（空 listings）→ 空状态 UI，不报错
- Edge case: 只有 1 条 listing → 提示"暂无可对比数据"，不渲染矩阵
- Edge case: API 返回 `salesAvailableFrom: 'S4'` → 销售数据区域显示"S4 上线后可用"占位提示
- Compliance: 渲染输出不含"违规"/"合规风险"等字样（文本快照测试或人工审查）

**Verification:**

- TypeScript 零报错，无 linter 警告
- 浏览器中可见矩阵分析视图（开发环境 dev preview）
- 所有文案符合 R5 中性化要求（运营 PM 走查）

---

## System-Wide Impact

- **API surface parity**: 批量生成（`POST /listings/batch-generate`）与单条生成（`POST /listings/:id/generate`）共享同一 `IListingGenerationService`，Agent 可通过 API 调用批量生成。
- **Audit log before/after**: `AuditLog.metadata` 结构变更对查询审计日志的已有代码（仅读取 `action`、`entityId`）无影响；before/after 为 opt-in 新字段。
- **EmbeddingService**: 新增 Gemini API 调用路径，需在 `.env` 中确认 `GEMINI_EMBED_MODEL=text-embedding-004` 已配置（实施方案 §3.1 已规定 S1 起需要）。
- **Redis 缓存**: 新增 `listing:embed:*` 命名空间，与现有 `lingxing:*` / `rate:*` 键不冲突。
- **Unchanged invariants**: Listing 双重唯一约束（`(platformId, shopId, platformListingId)` 全局唯一；`isPrimary` 部分唯一）由批量生成函数继续遵守，不绕过。

---

## Risks & Dependencies

| Risk                                                       | Mitigation                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Gemini `text-embedding-004` quota 不足（开发期间调用频繁） | EmbeddingService 单次 `embed` 加 Redis 缓存；开发环境使用 mock embedding（零向量）跑测试    |
| 批量生成部分失败对用户不透明                               | `batchGenerate` 返回 per-target 错误详情；前端逐条展示成功/失败状态                         |
| 矩阵相似度计算在大量 listing 时 N² 耗时                    | 每产品 listing 上限现实为 20 以内；若将来超出，可在 U3 后续迭代加分页或限制比较数量         |
| `AuditLog.metadata` 快照过大                               | 快照仅含核心字段（id、status、title、isPrimary、trafficStrategy），排除 bullets/description |

---

## Documentation / Operational Notes

- W26 上线前，在 `.env.example` 中确认 `GEMINI_EMBED_MODEL=text-embedding-004`
- Redis `listing:embed:*` 键 TTL 24h，正常运营无需手动管理；若 Gemini 模型版本升级，可 `redis-cli KEYS "listing:embed:*" | xargs redis-cli DEL` 批量清除

---

## Sources & References

- 实施方案 §7 S2 W24-W25：多平台 Listing 批量生成 + Listing 矩阵分析
- 实施方案 §2.2 AI Agent Native：`POST /listings/batch-generate` 为 Agent 可调工具
- 实施方案 §5 M-10 审计日志覆盖率：关键写操作 100%（before/after 增强）
- 实施方案 §16 决策摘要：矩阵分析命名中性化，不出现违规字眼
- Related code: `apps/api/src/listing/listing.service.ts`, `apps/api/src/listing/listing.controller.ts`
- Related plan: `docs/plans/2026-05-03-001-feat-w21-23-migration-shop-picker-validation-plan.md`
