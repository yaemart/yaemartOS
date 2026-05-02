---
title: 'feat: W14-W15 多品牌切换 + Spoonlemon + GLM-5 + Cost Tracking'
type: feat
status: active
date: 2026-05-01
origin:
  - docs/yaemartOS-implementation-plan.md
  - docs/adr/ADR-005-ai-services.md
---

# W14–W15：多品牌切换 + Spoonlemon 配置 + GLM-5 + Cost Tracking

## Overview

S2 开端：在 S1 单品牌基础上加入第二品牌 Spoonlemon，补全多品牌运营的三个关键能力——**品牌动态切换**（前端 UI 与 API 会话对齐）、**GLM-5 AI Provider + ModelRouter**（FAQ/菜谱生成由 S1 的纯手工升级为 AI 辅助）、**Cost Tracking 中间件**（每次 AI 调用记录 token 与费用，支撑月度成本报表）。

---

## Problem Frame

- **品牌 API 会话未对齐**：前端 `AdminTopbar` 有品牌切换 `<select>`，但 API 仍从 JWT `user.brandId` 读取品牌，切换 UI 只改变主题 CSS，不改变数据查询范围——运营切换到 Spoonlemon 后看到的还是 Homtone 数据。
- **Spoonlemon 在 DB 无种子**：`Brand` 表仅靠代码建表，没有 Spoonlemon、Davivy、Tysun 的 seed 记录；S2 无法运行。
- **GLM-5 未接入**：ADR-005 设计了 `GlmProvider + ModelRouter`，但 `apps/api/src/ai/` 只有 `GeminiListingGenerationService`；FAQ/菜谱 AI 生成仍是 `NotImplementedException`。
- **Cost Tracking 无表无服务**：`AiCallLog` 仅存在于 ERD 文档，S2 引入多模型后若不追踪成本，月度报表无数据可查。

---

## Requirements Trace

- R1. 品牌切换 UI → API 对齐：前端切换品牌后，API 请求带 `x-yaemart-brand` 头，服务端改用该值作品牌上下文；数据严格隔离
- R2. Spoonlemon 品牌配置：DB 内四品牌 seed；Spoonlemon VI 主题（`data-brand="spoonlemon"` 已有 CSS）与 Logo URL 可配置
- R3. Casbin operator policy 补充：operator 角色可以在其 brand 维度内操作 listings / products / categories，而不仅仅是 `auth:me`
- R4. GLM-5 Provider：实现 `GlmListingGenerationService`，OpenAI 兼容 endpoint，注册到 AI 模块
- R5. ModelRouter：按 `taskType + locale` 选模型（FAQ/recipe → GLM-5；Listing EN → Gemini Pro）；单元测试覆盖 v2.0 全部场景
- R6. Cost Tracking：`ai_call_log` Prisma 表 + `CostTrackingService` 拦截每次 AI 调用；月度成本可按 brand/task 查询
- R7. FAQ 生成服务：`FaqGenerationService`（GLM-5），对接 ProductContent source=ai_generated；3 款产品运营验收

（see origin: `docs/yaemartOS-implementation-plan.md` §W14–W15`、`docs/adr/ADR-005-ai-services.md`）

---

## Scope Boundaries

- 不包含 Walmart Listing 适配（W16–W17）
- 不包含路径 A 完整能力（W18–W20）
- 不包含 Davivy / Tysun 品牌配置（S5 全量；本计划只把四品牌 seed 写入，VI 配置只做 Homtone+Spoonlemon）
- 不包含广告管理功能（S4）
- 不包含 AI 成本告警/自动限速（S4 Rate Limiting）
- GLM-5 仅接入 FAQ/菜谱任务；Listing 生成仍用 Gemini Pro

### Deferred to Follow-Up Work

- 月度成本 Dashboard UI（W14–W15 只提供 SQL 报表查询能力；UI 在 S4 指标看板中）
- Casbin 细粒度 policy 的运营自助管理 UI（当前 policy 在代码中初始化）

---

## Context & Research

### Relevant Code and Patterns

- **品牌切换 UI**：`apps/web/components/admin/admin-topbar.tsx`、`apps/web/components/listing/brand-switcher.tsx`（`useBrand()` 已有）；`BrandProvider`：`apps/web/providers/brand-provider.tsx`
- **品牌主题 CSS**：`apps/web/app/globals.css`（`[data-brand="spoonlemon"]` 已有 CSS 变量）
- **API 品牌头**：`apps/api/src/iam/casbin.guard.ts` 有 `x-yaemart-brand` 头读取但未覆盖 JWT brandId；`apps/web/lib/api/auth-client.ts`（`fetchCapabilities` 已接受可选 `brandId`）
- **AI 模块结构**：`apps/api/src/ai/ai.module.ts`；tokens：`LISTING_GENERATION_SERVICE`、`STRUCTURED_EXTRACTION_SERVICE`；`IListingGenerationService` 接口：`apps/api/src/ai/interfaces/listing-generation.interface.ts`
- **Casbin 策略**：`apps/api/src/iam/casbin.service.ts`（`admin` 策略 `*`；`operator` 仅 `auth:me`）；测试：`apps/api/src/iam/casbin.service.spec.ts`
- **Brand Prisma 模型**：`apps/api/prisma/schema.prisma`（`id, name, slug, themeColor, logoUrl`）；无现有 seed
- **Cost Tracking 设计参考**：`docs/erd/domain-model.md`（`AiCallLog` 字段定义）；`docs/adr/ADR-005-ai-services.md`（`@costTracked` 装饰器构想）

### Institutional Learnings

- DI Token（Symbol）+ `useExisting` 模式已在 AI 模块验证；GLM Provider 应使用同一模式注册
- Casbin `enforce` 函数的 `brand` 参数目前优先读 `user.brandId`；W14 需让其可被请求头覆盖（仅对已鉴权用户，且用户必须有该品牌权限）

### External References

- 智谱 GLM-5 OpenAI 兼容 API：`https://open.bigmodel.cn/api/paas/v4/` — `baseURL` 替换 + `ZHIPU_API_KEY`
- Vercel AI SDK `openai-compatible`：通过 `createOpenAI({ baseURL, apiKey })` 接入；已在 `apps/api` 中有 `@ai-sdk/google`，同理引入 `openai` 包（兼容层）

---

## Key Technical Decisions

- **品牌切换方式：请求头 `x-yaemart-brand` 覆盖**：不修改 JWT（避免频繁签发），而是在 API 请求中附加 `x-yaemart-brand: spoonlemon`；Casbin Guard 已有该头读取逻辑但当前不覆盖 `user.brandId`；W14 让其在 admin context 下优先使用。前端 `fetchAPI` 包装函数统一注入该头。安全约束：覆盖仅允许用户已有权限的品牌（enforcer 验证后再换上下文）。
- **四品牌 DB Seed 用 Prisma `db seed`**：不在迁移文件中写死数据，而是用独立 `prisma/seed.ts`（幂等 `upsert`），开发/staging 环境可重复执行。
- **ModelRouter 位于 AI 层内部**：`ModelRouterService` 不对外暴露，由各 task service 委托；路由表存 ConfigService，可热更新（环境变量）。
- **Cost Tracking 使用 NestJS `CallHandler` Interceptor**：`AiCostInterceptor` 包装 AI provider 调用，记录 `promptTokens + completionTokens + estimatedCostUsd`；写 `AiCallLog` 表为 best-effort（写失败不阻断 AI 响应）。
- **`AiCallLog` 放 public schema**：跨品牌成本汇总查询；与 tenant schema 隔离，只有 admin 可见。

---

## Open Questions

### Resolved During Planning

- **Q: 品牌切换用新 JWT 还是请求头？** 请求头方案——S1 已有 `x-yaemart-brand` 头读取，代价最小，无需修改 Auth 流程；安全由 Casbin enforcer 在覆盖前验证权限。
- **Q: GLM-5 用 Vercel AI SDK 还是直接 HTTP？** Vercel AI SDK `createOpenAI({ baseURL })` 兼容层——与现有 Gemini 用法统一，迁移成本低。
- **Q: cost tracking 是同步写还是异步写？** 同步 best-effort——S2 规模小（beta 12 人），异步队列增加复杂度不值得；写失败只记录 warn 日志，不抛异常。

### Deferred to Implementation

- GLM-5 具体模型名称（`glm-4-flash` 等）和 token pricing 需上线前从智谱控制台确认
- `estimatedCostUsd` 计算精度（按官方最新定价表写死常量，S4 引入动态定价）

---

## High-Level Technical Design

> _方向性说明，供评审验证，不是实现规范。_

### 品牌切换数据流

```
前端 AdminTopbar.setBrand('spoonlemon')
  → BrandProvider 更新 data-brand（主题立即切换）
  → fetchAPI 所有请求附加 x-yaemart-brand: spoonlemon
  → CasbinGuard:
      1. 读 x-yaemart-brand 头
      2. 验证 user 是否有 spoonlemon 品牌权限
      3. 若有 → 覆盖 req.brandId = 'spoonlemon'
      4. 后续 service 从 req.brandId 读取（非 user.brandId）
```

### ModelRouter 路由表

```
taskType=listing, locale=en    → gemini-pro
taskType=listing, locale=de    → glm-5（S3 多语言起）
taskType=faq, locale=*         → glm-5
taskType=recipe, locale=*      → glm-5
taskType=extraction, locale=*  → gemini-flash
```

### AiCallLog 写入时机

```
AiCostInterceptor (NestJS Interceptor)
  → 包装 IListingGenerationService / IFaqGenerationService 调用
  → 捕获 response + usage（tokens）
  → 计算 estimatedCostUsd
  → 异步写 AiCallLog（best-effort）
```

---

## Implementation Units

- [ ] U1. **四品牌 DB Seed + Spoonlemon 品牌配置**

**Goal:** 建立幂等 DB seed 脚本，写入四品牌基础数据；配置 Spoonlemon Logo URL 和 themeColor。

**Requirements:** R2

**Dependencies:** 无

**Files:**

- Create: `apps/api/prisma/seed.ts`
- Modify: `apps/api/package.json`（添加 `prisma.seed` 字段）
- Modify: `apps/api/prisma/schema.prisma`（确认无缺失字段；如需加 `faviconUrl` 等字段则加迁移）

**Approach:**

- `seed.ts` 使用 `prisma.brand.upsert({ where: { id }, create, update })` 对四品牌幂等写入
- 品牌 ID 与 S1 代码硬编码保持一致（`homtone`, `spoonlemon`, `davivy`, `tysun`）
- Spoonlemon 写入 `logoUrl`（占位 URL）和 `themeColor`（绿色系 `#059669`）
- `package.json` 添加 `"prisma": { "seed": "ts-node prisma/seed.ts" }`

**Test scenarios:**

- Happy path: `pnpm db:seed` 第一次执行 → 四条品牌记录插入
- Edge case: 重复执行幂等，不报 UniqueConstraint 错误，行数不增加
- Edge case: Spoonlemon 记录包含 `logoUrl` 和 `themeColor` 非空

**Verification:**

- `prisma studio` 或 `SELECT id, name, slug FROM "Brand"` 可见四条记录
- 重复执行 seed 零错误

---

- [ ] U2. **品牌切换 API 对齐（`x-yaemart-brand` 头覆盖）**

**Goal:** 前端切换品牌后，API 请求以该品牌身份查询数据；Casbin Guard 在鉴权后允许已授权用户的品牌头覆盖。

**Requirements:** R1, R3

**Dependencies:** U1

**Files:**

- Modify: `apps/api/src/iam/casbin.guard.ts`（添加品牌头覆盖逻辑）
- Modify: `apps/web/providers/brand-provider.tsx`（`setBrand` 时持久化到 localStorage）
- Modify: `apps/web/lib/api/fetch-api.ts`（或 `auth-client.ts`）（统一注入 `x-yaemart-brand` 头）
- Create: `apps/api/src/iam/casbin.guard.spec.ts`（补充品牌覆盖相关测试用例）

**Approach:**

- Guard：鉴权通过后，读 `x-yaemart-brand` 头；若与 `user.brandId` 不同，再次 enforce 验证 `user.role` 对目标 brand 是否有权限；通过则 `req['resolvedBrandId'] = headerBrand`，否则忽略头（不报错，降级到 JWT brand）
- 前端：`useBrand().setBrand` 触发时更新 localStorage + context；所有 API 调用函数从 context 读取 `currentBrand` 并附加头
- Service 层：`ListingService` 等直接使用 `query.brandId`（已由前端传参），无需改动；Guard 覆盖的是 Casbin enforce 的 brand 维度

**Patterns to follow:**

- `apps/api/src/iam/casbin.guard.ts` 现有头读取模式（`x-market`, `x-platform` 等）

**Test scenarios:**

- Happy path: admin 用 `x-yaemart-brand: spoonlemon` 请求 → `resolvedBrandId = 'spoonlemon'`，数据按 spoonlemon 过滤
- Security: operator 用 `x-yaemart-brand: spoonlemon`，但其 JWT 仅有 homtone 权限 → 头被忽略，仍用 JWT brandId
- Edge case: 头缺失 → 行为与 S1 完全一致（回退到 `user.brandId`）
- Integration: 切换品牌后 `GET /listings?brandId=spoonlemon` 只返回 spoonlemon 的 listing

**Verification:**

- 跨品牌越权测试通过（E2E 或 API test）
- 切换后刷新页面，品牌选择从 localStorage 恢复

---

- [ ] U3. **Casbin operator policy 补充**

**Goal:** 给 operator 角色补充 listings / products / categories 的读写策略，按品牌维度隔离。

**Requirements:** R3

**Dependencies:** U1

**Files:**

- Modify: `apps/api/src/iam/casbin.service.ts`（`initializePolicies` 补充 operator 策略）
- Modify: `apps/api/src/iam/casbin.service.spec.ts`（新增 operator 跨品牌越权测试）

**Approach:**

- 补充策略：`operator` 对 `listings`, `products`, `categories` 在 `brand=*`（自身品牌匹配由 Guard 的 brand 参数保证）下 `read/write`
- 保持 `admin` 的全通策略不变
- 不在此引入复杂 ABAC；细粒度留 S3

**Test scenarios:**

- Happy path: operator 角色 + homtone brand → `GET /listings` 允许
- Security: operator 角色 + spoonlemon brand（但 JWT 是 homtone）→ 拒绝
- Happy path: admin 角色任意 brand → 允许
- Edge case: operator `DELETE /listings/:id` → 应该被允许（operator 有 write 权限）

**Verification:**

- `casbin.service.spec.ts` 新增 operator 测试用例全通过

---

- [ ] U4. **GLM-5 Provider 接入**

**Goal:** 实现 `GlmProvider`，通过 Vercel AI SDK OpenAI 兼容层接入智谱 GLM-5；可与 Gemini 同时运行；通过 `hello world` 验证。

**Requirements:** R4

**Dependencies:** 无（可与 U1/U2/U3 并行）

**Files:**

- Create: `apps/api/src/ai/providers/glm-generation.service.ts`
- Create: `apps/api/src/ai/providers/glm-generation.service.spec.ts`
- Modify: `apps/api/.env.local.example`（添加 `ZHIPU_API_KEY`、`GLM_MODEL=glm-4-flash`）

**Approach:**

- `createOpenAI({ baseURL: 'https://open.bigmodel.cn/api/paas/v4/', apiKey: ZHIPU_API_KEY })` 创建 client
- 实现 `helloWorld()` 和 `generateText(prompt)` 两个基础方法
- 无 `ZHIPU_API_KEY` 时 no-op 并记录 warn（与 GeminiService 相同的 mock fallback 模式）
- 不直接实现 `IListingGenerationService`（Listing 仍走 Gemini）；GLM 的任务接口在 U5 ModelRouter 中路由

**Patterns to follow:**

- `apps/api/src/ai/providers/gemini-listing-generation.service.ts`（mock fallback + WARN 日志模式）

**Test scenarios:**

- Happy path: mock `generateText` → 返回预期文本
- Edge case: `ZHIPU_API_KEY` 未设置 → 返回 mock 内容，不抛异常
- Unit: `helloWorld()` 调用时 SDK 被调用 + 参数正确

**Verification:**

- `GlmGenerationService` 单元测试通过
- `GET /ai/hello` 端点（AiController）可切换 provider 返回 GLM 内容（通过 `GLM_HELLO_WORLD=true` 环境变量触发）

---

- [ ] U5. **ModelRouter + FAQ 生成服务**

**Goal:** 实现 `ModelRouterService`，按 `taskType + locale` 路由到 Gemini 或 GLM；实现 `FaqGenerationService`（GLM-5）并对接 `ProductContent source=ai_generated`。

**Requirements:** R5, R7

**Dependencies:** U4

**Files:**

- Create: `apps/api/src/ai/model-router.service.ts`
- Create: `apps/api/src/ai/model-router.service.spec.ts`
- Create: `apps/api/src/ai/providers/faq-generation.service.ts`
- Create: `apps/api/src/ai/providers/faq-generation.service.spec.ts`
- Modify: `apps/api/src/ai/ai.module.ts`（注册 ModelRouterService + FaqGenerationService）
- Modify: `apps/api/src/product/product.service.ts`（`updateContent` 方法添加 `triggerFaqGeneration` 选项）
- Modify: `apps/api/.env.local.example`（添加 `AI_TASK_ROUTER` 路由配置示例）

**Approach:**

- `ModelRouterService.getProvider(taskType: 'listing'|'faq'|'recipe'|'extraction', locale: string)` 返回对应 provider 实例
- 路由规则从 env var 读取（可覆盖），默认：`faq/*` → GLM；`listing/en` → Gemini Pro；`extraction/*` → Gemini Flash
- `FaqGenerationService.generateFaq(productId, locale)`:
  1. 从 ProductContent 读取 product 基本信息
  2. 组装 prompt（支持品类卖点/特征）
  3. 调用 GLM-5 生成 3–5 条 FAQ（Q+A 对）
  4. Upsert `ProductContent(source=ai_generated, locale, payload={faqs})`

**Test scenarios:**

- Happy path (router): `taskType=faq, locale=en` → 返回 GLM provider
- Happy path (router): `taskType=listing, locale=en` → 返回 Gemini provider
- Edge case (router): 未知 `taskType` → 返回 Gemini（默认安全 fallback）
- Happy path (faq): mock GLM → 生成 3 条 FAQ，写入 ProductContent
- Edge case (faq): GLM unavailable → 抛出 ServiceUnavailableException（不 fallback，避免 FAQ 质量差）
- Integration: `POST /products/:id/faq` → ProductContent 中出现 `source=ai_generated` 记录

**Verification:**

- ModelRouter 单元测试覆盖 v2.0 全部 taskType 场景
- 3 款产品 FAQ AI 生成结果运营验收（staging 环境）

---

- [ ] U6. **Cost Tracking：`AiCallLog` 表 + `CostTrackingService`**

**Goal:** 建立 `ai_call_log` Prisma 表，实现 best-effort cost tracking，支持按 brand/task 月度查询。

**Requirements:** R6

**Dependencies:** U4, U5

**Files:**

- Modify: `apps/api/prisma/schema.prisma`（新增 `AiCallLog` model）
- Create: `apps/api/prisma/migrations/YYYYMMDDHHMMSS_add_ai_call_log/migration.sql`（通过 `prisma migrate dev` 生成）
- Create: `apps/api/src/ai/cost-tracking.service.ts`
- Create: `apps/api/src/ai/cost-tracking.service.spec.ts`
- Modify: `apps/api/src/ai/ai.module.ts`（提供 CostTrackingService）
- Modify: `apps/api/src/ai/providers/gemini-listing-generation.service.ts`（调用后写 log）
- Modify: `apps/api/src/ai/providers/faq-generation.service.ts`（调用后写 log）

**Approach:**

- `AiCallLog` schema 字段：`id, model, taskType, brandId, marketId(nullable), promptTokens, completionTokens, estimatedCostUsd, durationMs, createdAt`
- `CostTrackingService.record(input)` 写 `AiCallLog`，捕获所有异常只记录 warn（best-effort）
- 月度 SQL 报表查询（文档说明 SQL，暂不建 API 端点）：`SELECT brandId, taskType, SUM(estimatedCostUsd) FROM AiCallLog WHERE createdAt >= ... GROUP BY brandId, taskType`

**Patterns to follow:**

- `apps/api/src/common/audit/audit.service.ts`（best-effort 写 DB 的同步 try/catch 模式）

**Test scenarios:**

- Happy path: `record({ model, taskType, brandId, promptTokens:100, completionTokens:50 })` → DB 有一条记录
- Edge case: DB 写失败 → 仅 warn 日志，不抛异常（调用方无感知）
- Edge case: `estimatedCostUsd` 为 0 时仍写入（0 成本模型）
- Integration: Gemini listing 生成一次后 `AiCallLog` 有对应记录

**Verification:**

- `CostTrackingService` 单元测试通过
- 一次 FAQ 生成后 `SELECT * FROM "AiCallLog"` 有记录，字段非空

---

## System-Wide Impact

- **品牌切换**：Guard 变更影响所有带 `x-yaemart-brand` 头的请求；无该头的请求行为不变——S1 所有代码无需修改
- **Casbin policy 补充**：仅追加 operator 策略，不修改 admin 策略；不影响现有 S1 权限
- **AI 模块新增 provider**：`ai.module.ts` 新增 providers 不影响现有 `LISTING_GENERATION_SERVICE` 注册；Gemini 继续作为默认 listing provider
- **Cost Tracking**：best-effort 设计确保写 DB 失败不阻断 AI 响应；existing Gemini service 需添加 `CostTrackingService` 调用
- **不变量**：`IListingGenerationService` 接口签名不变；`AiModule` 现有 exports 不变；`ListingModule` 无需修改

---

## Risks & Dependencies

| 风险                                          | 缓解                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| GLM-5 API 国内/国际网络问题（GFW）            | staging 环境部署在国内或使用代理；S2 beta 限 12 人，失败率高时可 fallback 到 Gemini              |
| 智谱 API 定价变化导致 `estimatedCostUsd` 不准 | 常量定义在单独文件 `ai-pricing.constants.ts`，方便按季度更新；注释标注「参考价格，仅供趋势分析」 |
| 品牌切换头被滥用（伪造品牌）                  | Guard 二次 enforce 验证用户有目标品牌权限；JWT 仍是最终权威；无权限时静默忽略头                  |
| operator 追加策略范围过宽                     | policy 补充精确到 `listing/products/categories`，不使用通配符 `*`；跨品牌越权测试覆盖            |
| GLM FAQ 质量低于预期                          | 3 款产品运营验收是 R7 完成标准；验收不过不上线                                                   |

---

## Documentation / Operational Notes

- `apps/api/.env.local.example` 新增 `ZHIPU_API_KEY`、`GLM_MODEL` 占位
- 月度 AI 成本查询 SQL 写入 `docs/runbooks/ai-cost-report.md`
- Spoonlemon brand seed 首次执行需要 `pnpm db:seed`，CI 不自动执行（种子数据含真实 logoUrl，需手动确认）

---

## Sources & References

- **Origin:** [docs/yaemartOS-implementation-plan.md §W14–W15](docs/yaemartOS-implementation-plan.md)
- **ADR-005 AI Services:** [docs/adr/ADR-005-ai-services.md](docs/adr/ADR-005-ai-services.md)
- 品牌切换 UI：`apps/web/components/admin/admin-topbar.tsx`
- AI 模块：`apps/api/src/ai/ai.module.ts`、`apps/api/src/ai/tokens.ts`
- Casbin：`apps/api/src/iam/casbin.service.ts`、`apps/api/src/iam/casbin.guard.ts`
- ERD cost 字段：`docs/erd/domain-model.md`（`AiCallLog`）
