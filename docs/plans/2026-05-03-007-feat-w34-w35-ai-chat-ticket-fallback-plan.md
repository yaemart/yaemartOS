---
title: 'feat: W34–W35 客户中心 V1 — AI Chat + 工单 + AI Fallback'
type: feat
status: active
date: 2026-05-03
origin: docs/yaemartOS-implementation-plan.md
---

# feat: W34–W35 客户中心 V1 — AI Chat + 工单 + AI Fallback

## Overview

在 W31–W33 交付的 Tenant 架构 + 注册/登录/商品目录基础上，W34–W35 为客户门户引入：

1. **实时 AI 对话**：客户（登录/匿名）向品牌 AI 助手发起文字会话，AI 以 Gemini 2.5 Flash + OpenSearch FAQ 知识库语义检索回复
2. **AI Fallback 机制**：Pro 超时/5xx → 自动 retry Flash → 3 轮未命中 → 自动升级为工单
3. **工单系统**：支持客户自主提交 + AI 自动升级，含消息线程 / 优先级 / SLA / 运营分配
4. **跨品牌管理员聚合看板**：后台 admin panel（apps/web）通过专用聚合服务读取 4 个 tenant schema 工单数据，仅授权管理员可见

W34–W35 为 W36–W37（手册+保修）和 W38（客户中心首页+非登录订单查询）提供会话与工单基础设施。

---

## Problem Frame

W31–W33 完成了客户身份基础（注册/登录/JWT 隔离）和公开商品目录。W34–W35 的核心挑战：

1. **实时推送**：当前 API 无 WebSocket/SSE 通道，需从零建立；选型须兼顾 AI 流式输出
2. **语义搜索**：EmbeddingService 已有 Gemini text-embedding-004，但 OpenSearch 只有全文索引，无 dense_vector mapping；需新建 FAQ 知识库索引并打通嵌入写入与 kNN 查询
3. **AI 可靠性**：Gemini API 偶发超时/限流，当前无任何 fallback；需在 AI 路径引入重试与降级策略，同时不破坏现有 Listing 生成路径
4. **工单数据模型**：tenant.schema.prisma 已有 `Ticket` 壳，但缺 `TicketMessage`（对话线程）和运营字段（assignee/priority/sla/tags）；需扩展并执行 4-schema 迁移
5. **跨 Tenant 聚合**：管理员需要跨 4 个 schema 聚合工单数据，PrismaClientManager 单例 Map 可复用，但聚合 API 需严格 IAM 隔离

---

## Requirements Trace

- R1. 客户（登录或匿名）可在 portal 发起 AI 文字会话，AI 回复基于品牌 FAQ 知识库（语义检索）
- R2. AI 响应通过 SSE 流式推送，P95 首 token < 1.5 s（满足实时体验）
- R3. Gemini Pro 超时/5xx → 自动 retry Flash（≤ 2 次）；3 轮连续未命中 → 自动升级工单 + 提示客户
- R4. 客户可自主提交工单（无需先经 AI）；工单含 subject / 消息线程 / 优先级 / SLA / 标签
- R5. 登录客户工单绑定 customer_id；匿名访客工单绑定 session_id（可后续关联账户）
- R6. 工单状态流：open → in_progress → resolved → closed（支持运营分配/认领）
- R7. 管理员跨品牌聚合 API 返回全部 4 schema 工单；IAM `brand` 维度严格隔离，非授权管理员不可访问
- R8. FAQ 知识库 OpenSearch 索引（`customer-faq_*`）：embedding 写入 pipeline + kNN 查询
- R9. Portal 新增 Chat 页（AI 会话 + 消息线程）和工单列表/详情页
- R10. 跨 tenant 隔离不变：任意工单消息不得泄漏到错误 schema

---

## Scope Boundaries

- 不在本计划实现手册下载（W36–W37）
- 不在本计划实现保修注册（W36–W37）
- 不在本计划实现客户中心首页（W38）
- 不在本计划实现非登录订单查询（W38，需 Lingxing API 接入）
- 不实现语音/图片消息（v2.x）
- 不实现客户之间的消息（C2C）
- 不将 AI Fallback 应用于 Listing 生成路径（不同风险/延迟模型，单独计划）
- 不实现 Davivy / Tysun 品牌（S3 仅 Homtone + Spoonlemon）

### Deferred to Follow-Up Work

- 100 题离线评测集（M-03 命中率验证）：W35 末或 W39 sprint 专项追加
- Ticket SLA 到期提醒（cron job）：W36 同期实现
- 管理员跨品牌聚合看板前端组件（admin panel UI）：W35 末完成 API 后可以追加；若时间不足延至 W36

---

## Context & Research

### Relevant Code and Patterns

- `apps/api/src/customer-portal/customer-portal.module.ts` — 模块边界，新增 Chat/Ticket 注册于此
- `apps/api/src/customer-portal/customer-auth/customer.guard.ts` — CustomerGuard，Chat/Ticket 需登录路由复用
- `apps/api/src/customer-portal/article-public/article-public.service.ts` — 公开 API 无 guard 模式参考
- `apps/api/src/ai/embedding.service.ts` — Gemini text-embedding-004 + Redis 24h 缓存，已就绪
- `apps/api/src/ai/model-router.service.ts` — 按任务类型/locale 路由 Gemini/GLM；W34 扩展 `chat` 任务类型
- `apps/api/src/ai/cost-tracking.service.ts` — AI 调用成本记录（chat 调用同样需要记录）
- `apps/api/src/search/search.service.ts` — OpenSearch 客户端（`@opensearch-project/opensearch`），ELASTICSEARCH_URL
- `apps/api/src/search/es-index-registry.ts` — 现有三个 ops 索引（`ops-product_knowledge`, `ops-listing_draft`, `ops-keyword_corpus`）；注释已预留 customer 域索引 W34–W35
- `apps/api/prisma/tenant.schema.prisma` — `Ticket` 壳（id/customerId/ticketNo/subject/status/createdAt）；无 `TicketMessage`
- `scripts/migrate-tenant-schemas.ts` — 4-schema 迁移脚本，W34 需追加新建表的 SQL
- `apps/api/src/common/tenant/tenant-context.service.ts` — CLS tenant，Chat/Ticket 复用
- `apps/portal/lib/api/customer-api-client.ts` — Portal fetch 封装（x-yaemart-brand header），需扩展 chat/ticket 方法
- `apps/portal/app/[locale]/(auth)/` — 已有 Auth 页面（Chat 页需要登录 guard，复用 cookie 检查模式）

### Institutional Learnings

- **NestJS + Prisma + Neon 多租户 Schema**（`docs/solutions/backend-patterns/nestjs-prisma-neon-multitenant-2026-04-30.md`）：
  - `getTenantClient()` 通过 CLS `tenantId` 选 schema；4-schema 迁移脚本模式（`CREATE TABLE IF NOT EXISTS`）
  - Neon PgBouncer transaction mode 下 `set_config(..., TRUE)` is_local 约束
- **SSE in NestJS**：NestJS `@Sse()` + `@nestjs/common` 的 `Observable<MessageEvent>` 方案，无需 `@nestjs/websockets`；使用 RxJS `from(asyncGenerator)` 可接流式 Gemini AI SDK 响应
- **Gemini 流式 SDK**：`streamText` from `ai` (Vercel AI SDK) 返回 `AsyncIterable`；可用 `for await` 逐 token 推送 SSE
- **OpenSearch dense_vector**：mapping 中 `"type": "knn_vector"`, `"dimension": 768`（Gemini text-embedding-004 维度）；查询用 `knn: { field, query_vector, k }` 语法（AWS OpenSearch KNN plugin）

### External References

- 无需额外外部研究：现有 AI SDK、OpenSearch 客户端、NestJS SSE API 均在代码库中已有使用示例

---

## Key Technical Decisions

- **SSE 而非 WebSocket**：AI 回复本质上是服务端推流（客户 POST 消息 → 服务端 SSE 流响应）；无需全双工通道，SSE 更简单（无需额外适配器/协议握手），且与 Next.js Server Components 的流式渲染天然契合。未来若需客服实时通知（运营侧），可独立引入 WebSocket Gateway
- **AI Fallback 为 NestJS Interceptor 而非装饰器**：Interceptor 可拦截方法调用并包裹 retry/fallback 逻辑，不依赖参数元数据，适合包裹任意 `generateText/streamText` 调用；装饰器方案在流式 Observable 中的错误边界更难控制
- **OpenSearch kNN 而非 in-memory 余弦相似度**：现有 `EmbeddingService.pairwiseSimilarity` 在内存算，不可扩展到大型 FAQ 库；kNN index 支持增量写入、持久化、ANN 近似查询，延迟 < 10ms（同集群内）
- **工单消息统一存 TicketMessage 表**：AI 回复与人工回复均落 `TicketMessage`，`sender_type` 字段区分 `customer/ai/agent`；避免 AI 消息和人工消息分表导致的查询复杂度
- **Chat session ≠ 工单**：会话（`ChatSession`）是轻量的 in-tenant 状态（session_id / 匿名或绑定 customer_id）；工单在"升级"或"手动提交"时从 session 中派生，会话继续存在不受工单状态影响
- **跨 Tenant 聚合服务（admin 专用）**：在 `apps/api/src/admin/` 新建 `TicketAggregationService`，直接调用 `PrismaClientManager.getTenantClient()` 遍历 TENANT_SCHEMAS；路由受 `JwtAuthGuard + CasbinGuard`（role=admin, brand=\*）保护，**绝不**通过 CustomerPortalModule 暴露

---

## Open Questions

### Resolved During Planning

- **是否用 WebSocket**：否，SSE 足够（见 Key Technical Decisions）
- **AI 回复是否需要上下文窗口**：是，每次调用注入最近 10 轮会话消息（截断长会话）
- **匿名用户 Chat 数据如何存储**：用 session_id（UUID，存 httpOnly cookie）标识匿名会话，session 表单独建于 tenant schema；登录后可将 session_id 绑定到 customer_id
- **Gemini Pro vs Flash 对 Chat 的选择**：Chat 延迟敏感，默认 Gemini 2.5 Flash；`model-router.service.ts` 新增 `chat` 任务类型，支持 DB/env 覆盖
- **工单 ticketNo 格式**：`{BRAND_PREFIX}-{YYYYMMDD}-{SEQ}`，例如 `HT-20260503-0001`；SEQ 在 tenant schema 内自增

### Deferred to Implementation

- OpenSearch kNN 查询性能调优（`ef_search` / `nmsw` 参数）：依赖真实 FAQ 数据量，实施时压测
- ChatSession TTL 策略（无活动 N 小时后过期）：实施时根据产品决策设定具体值
- 工单 SLA 时钟（`sla_due_at`）的精确计算逻辑：实施时参考客服负责人提供的 SLA 规则
- Portal Chat UI 的 Optimistic Update 策略：实施时评估是否需要 SWR/React Query，或 Server Action + `router.refresh()`

---

## High-Level Technical Design

> _此图展示 W34–W35 的消息流设计，供架构评审用，是方向性指引而非实现规范。_

```
客户（Portal）
  │
  │ POST /customer/chat/sessions/{id}/messages   ← REST，发送消息
  │
  ▼ apps/api (NestJS)
  │ CustomerTenantGuard  (x-yaemart-brand → CLS)
  │ CustomerGuard (可选：匿名会话用 session cookie，登录会话用 JWT)
  │
  ▼ ChatService.handleMessage(sessionId, content)
  │   1. 保存 customer 消息到 ChatMessage 表
  │   2. 拉取最近 10 轮上下文
  │   3. EmbeddingService.embed(content) → 向量
  │   4. OpenSearch kNN → top-K FAQ chunks
  │   5. 构建 system prompt (brand tone + FAQ context + history)
  │   6. AiFallbackInterceptor 包裹：
  │        Gemini Flash streamText → 流式 token
  │        Pro 5xx/timeout → retry Flash × 2
  │        3 次连续 "unknown / 无命中" → 升级工单
  │
  │ GET /customer/chat/sessions/{id}/stream      ← SSE，客户端订阅
  │   Observable<MessageEvent> 推送 AI token chunks
  │
  ▼ 工单升级路径（AI 3 次未命中 / 客户手动提交）
  │ TicketService.create(tenantId, sessionId?, customerId?, dto)
  │   → INSERT INTO {tenant}.ticket (ticketNo, subject, status='open')
  │   → INSERT INTO {tenant}.ticket_message (sender_type='ai', content='...')
  │
  ▼ 管理员聚合（apps/web admin panel）
  GET /admin/tickets  (JwtAuthGuard + CasbinGuard role=admin brand=*)
  │ TicketAggregationService
  │   for tenant in TENANT_SCHEMAS:
  │     PrismaClientManager.getTenantClient(tenant)
  │     SELECT * FROM ticket WHERE ...
  └── 合并、分页、返回跨品牌视图
```

---

## Implementation Units

- [ ] U1. **Tenant Schema 扩展：TicketMessage + ChatSession + Ticket 字段补全**

**Goal:** 将 tenant.schema.prisma 的 `Ticket` 壳扩展为可用的工单 + 消息线程 + AI 会话模型，
并为全部 4 个品牌 schema 执行幂等迁移。

**Requirements:** R4, R5, R6, R10

**Dependencies:** 无（PrismaClientManager + migrate-tenant-schemas.ts 已就绪）

**Files:**

- Modify: `apps/api/prisma/tenant.schema.prisma`
- Modify: `scripts/migrate-tenant-schemas.ts`（追加 SQL 迁移段）
- Create: `apps/api/prisma/tenant-migrations/002-chat-ticket.sql`

**Approach:**

- `Ticket` 追加字段：`priority String @default("normal")`、`tags String[]`、`assigneeId String?`、`slaHours Int @default(24)`、`slaDueAt DateTime?`、`closedAt DateTime?`
- 新增 `TicketMessage` model：`id`, `ticketId`, `senderType`（enum: customer/ai/agent）、`content`, `createdAt`；关联 `Ticket`
- 新增 `ChatSession` model：`id`（UUID）、`customerId String?`（登录客户）、`sessionToken String @unique`（匿名 cookie）、`brandId String`、`lastActivityAt DateTime`、`createdAt DateTime`
- 新增 `ChatMessage` model：`id`, `sessionId`, `role`（enum: user/assistant）、`content`, `createdAt`；关联 `ChatSession`
- SQL 迁移：`CREATE TABLE IF NOT EXISTS` 风格，保证幂等
- `scripts/migrate-tenant-schemas.ts` 追加读取 `002-chat-ticket.sql` 并对 4 个 schema 执行

**Patterns to follow:**

- `apps/api/prisma/tenant.schema.prisma` — 现有 Customer/CustomerEmailVerification 模型风格
- `docs/solutions/backend-patterns/nestjs-prisma-neon-multitenant-2026-04-30.md` §6.1 迁移脚本

**Test scenarios:**

- Happy path: 执行 `pnpm tsx scripts/migrate-tenant-schemas.ts` 对 4 个 schema 成功，各含 ticket_message / chat_session / chat_message 表
- Idempotent: 二次执行不报错
- Error path: DIRECT_URL 未设置 → 明确错误，退出非零状态码

**Verification:**

- `psql $DIRECT_URL -c "\dt homtone.*"` 可见新增 4 张表
- 同上验证 spoonlemon/davivy/tysun

---

- [ ] U2. **AI Fallback Interceptor + 知识库 ES 索引**

**Goal:** 实现可复用的 AI 调用失败重试与降级机制，并建立 FAQ 知识库的 OpenSearch 向量索引，
为 Chat Service 提供语义检索能力。

**Requirements:** R1, R2, R3, R8

**Dependencies:** U1（ChatSession/ChatMessage 表），`embedding.service.ts`（已就绪）

**Files:**

- Create: `apps/api/src/ai/interceptors/ai-fallback.interceptor.ts`
- Modify: `apps/api/src/search/es-index-registry.ts`（追加 customer-faq 索引定义）
- Create: `apps/api/src/search/faq-knowledge.service.ts`（embedding 写入 + kNN 查询）
- Create: `apps/api/src/search/faq-knowledge.service.spec.ts`

**Approach:**

- `AiFallbackInterceptor` 为 NestJS `NestInterceptor`，实现 `intercept(context, next)`：
  - 捕获 `Observable`；若 throw（5xx / timeout）则 retry 最多 2 次（延迟递增）
  - 若仍失败，转换 error 为特殊信号对象 `{ status: 'DEGRADED' }`，调用方据此决定是否升级工单
  - 通过 `callHandler.handle()` 接 RxJS `retryWhen` 或 `catchError`
- `es-index-registry.ts` 新增 `customer-faq` 索引 mapping：
  ```
  properties: {
    faq_id: keyword, question: text, answer: text,
    brand_id: keyword, locale: keyword, product_id: keyword,
    question_vector: { type: knn_vector, dimension: 768 }
  }
  ```
- `FaqKnowledgeService.index(faqItem)` — 调用 `EmbeddingService.embed(question)` 得向量，写 OS
- `FaqKnowledgeService.search(query, brandId, locale, k=5)` — embed query，OS kNN 查询，返回 chunks

**Patterns to follow:**

- `apps/api/src/ai/embedding.service.ts` — embed 调用与 Redis 缓存
- `apps/api/src/search/search.service.ts` — OpenSearch 客户端使用模式

**Test scenarios:**

- Happy path (Interceptor): `next.handle()` 成功 → 透传结果
- Error path (Interceptor): 第 1 次 throw 5xx → retry → 成功 → 返回结果
- Error path (Interceptor): 连续 3 次失败 → 返回 `DEGRADED` 对象，不 throw
- Happy path (FaqKnowledgeService): `search()` mock OpenSearch 返回 3 hits → 返回 question/answer 对
- Integration: embed 调用被 mock → index 写入 OS 时 knn_vector 字段含正确维度数组

**Verification:**

- `apps/api` 单元测试全绿
- 手动：ES 集群创建 `customer-faq_dev` 索引，写入 3 条 FAQ，kNN 查询返回最近邻

---

- [ ] U3. **Chat Service（AI 自动回复 + SSE 流）**

**Goal:** 实现 AI 问答的核心逻辑：上下文构建 → FAQ 检索 → Gemini Flash 流式生成 →
3 轮未命中自动升级工单；提供 SSE 端点供 Portal 订阅。

**Requirements:** R1, R2, R3

**Dependencies:** U1（ChatSession/ChatMessage），U2（AiFallbackInterceptor + FaqKnowledgeService）

**Files:**

- Create: `apps/api/src/customer-portal/chat/chat.service.ts`
- Create: `apps/api/src/customer-portal/chat/chat.service.spec.ts`
- Create: `apps/api/src/customer-portal/chat/chat.controller.ts`
- Modify: `apps/api/src/customer-portal/customer-portal.module.ts`（注册 ChatModule 或直接注册）

**Approach:**

- `POST /customer/chat/sessions` — 创建 ChatSession，返回 `{ sessionId, sessionToken }`
  （匿名用 sessionToken 存 httpOnly cookie；登录用 JWT 绑定 customerId）
- `POST /customer/chat/sessions/:sessionId/messages` — 保存消息，触发 AI 回复：
  1. 存 `ChatMessage(role=user, content)`
  2. 拉取最近 10 条历史 + 系统 prompt（品牌 tone，从 SystemConfig 读取）
  3. `FaqKnowledgeService.search(content, brandId, locale)` → top-5 FAQ chunks
  4. 拼装 prompt，调 `streamText(model=gemini-flash, messages)`
  5. 消费流，逐 chunk 存 `ChatMessage(role=assistant)` + 推送到 SSE channel
  6. 若 `AiFallbackInterceptor` 返回 `DEGRADED` 或无命中计数 ≥ 3 → `TicketService.escalate()`
- `GET /customer/chat/sessions/:sessionId/stream` — `@Sse()` 端点：
  订阅该 session 的内存 Subject（按 sessionId 分组），推送 `{ data: token }` 事件流
  - 使用 RxJS `Subject<string>`，ChatService 写入，SSE controller 订阅
  - 连接断开后 cleanup（unsubscribe）
- 速率限制：`@Throttle({ default: { limit: 30, ttl: 60000 } })`（每分钟 30 条消息）

**Patterns to follow:**

- `apps/api/src/customer-portal/article-public/article-public.controller.ts` — CustomerTenantGuard 用法
- `apps/api/src/ai/providers/gemini-listing-generation.service.ts` — Vercel AI SDK `streamText` 用法

**Test scenarios:**

- Happy path: mock `FaqKnowledgeService.search` 返回 1 chunk → `ChatService.handleMessage` 调用 `streamText`，消息存入 DB
- Integration: 3 次 AI 回复均含 "UNKNOWN" 信号 → `TicketService.escalate()` 被调用 1 次
- Error path: `AiFallbackInterceptor` 返回 DEGRADED → SSE 推送 `{ data: null, event: 'escalated' }`
- Edge case: sessionId 不属于当前 tenant → 404
- Edge case: 会话消息超 10 轮 → 截断后仍调用 AI，不报错

**Verification:**

- `apps/api` 测试全绿
- 手动：Postman SSE + POST 消息 → 控制台可见流式 token

---

- [ ] U4. **工单 CRUD API（lifecycle + 消息线程）**

**Goal:** 提供客户自主提交工单、查看工单列表和消息线程，以及运营分配/状态流转的完整 API。

**Requirements:** R4, R5, R6

**Dependencies:** U1（Ticket/TicketMessage schema）

**Files:**

- Create: `apps/api/src/customer-portal/ticket/ticket.service.ts`
- Create: `apps/api/src/customer-portal/ticket/ticket.service.spec.ts`
- Create: `apps/api/src/customer-portal/ticket/ticket.controller.ts`

**Approach:**

- `POST /customer/tickets` — 客户手动提交工单（需登录，`CustomerGuard`）：
  `{ subject, initialMessage, priority?, tags? }` → INSERT ticket（status=open）+ TicketMessage（sender_type=customer）→ 返回 ticket + ticketNo
- `GET /customer/tickets` — 登录客户查自己的工单列表（分页）
- `GET /customer/tickets/:ticketId/messages` — 查消息线程（含 AI / agent 消息）
- `POST /customer/tickets/:ticketId/messages` — 客户追加消息（仅 open / in_progress 状态可追加）
- `PATCH /customer/tickets/:ticketId` — 客户关闭工单（status → closed）
- 运营侧（operator admin，需 JwtAuthGuard + RequirePolicy）：
  - `PATCH /tickets/:ticketId/assign` — 分配 assigneeId
  - `PATCH /tickets/:ticketId/status` — 状态流转（open → in_progress → resolved → closed）
  - `POST /tickets/:ticketId/messages` — 运营追加消息（sender_type=agent）
- `TicketService.escalate(sessionId, lastMessages)` — 供 ChatService 调用，从 session 派生工单

**Patterns to follow:**

- `apps/api/src/customer-portal/customer-auth/customer-auth.service.ts` — tenant Prisma 查询 + CustomerGuard 用法
- `apps/api/src/listing/listing.controller.ts` — RequirePolicy 运营鉴权模式

**Test scenarios:**

- Happy path: `POST /customer/tickets` 返回 ticketNo（格式 HT-20260503-0001），DB 含 status=open
- Happy path: 客户追加消息 → DB 含 sender_type=customer 的 TicketMessage
- Error path: status=closed 的工单追加消息 → 400 `TICKET_CLOSED`
- Error path: 客户访问不属于自己 tenant 的工单 → 403 或 404
- Integration: `TicketService.escalate()` 写入正确 tenant schema（通过 CLS tenantId）
- Happy path: 运营 `PATCH /tickets/:id/assign` → assigneeId 更新，返回更新后工单

**Verification:**

- `apps/api` 测试全绿
- E2E：客户完整工单流程（提交→运营分配→回复→关闭）

---

- [ ] U5. **跨品牌工单聚合 API（管理员）**

**Goal:** 在 apps/web admin 后台提供可跨 4 个 tenant schema 聚合查询工单的 API，
严格 IAM 隔离（仅 role=admin 且 brand=\* 的 token 可访问）。

**Requirements:** R7, R10

**Dependencies:** U4（TicketService），U1（各 tenant 含 ticket 表）

**Files:**

- Create: `apps/api/src/admin/ticket-aggregation/ticket-aggregation.service.ts`
- Create: `apps/api/src/admin/ticket-aggregation/ticket-aggregation.service.spec.ts`
- Create: `apps/api/src/admin/ticket-aggregation/ticket-aggregation.controller.ts`
- Create: `apps/api/src/admin/admin.module.ts`
- Modify: `apps/api/src/app.module.ts`（注册 AdminModule）

**Approach:**

- `GET /admin/tickets` — 路由受 `JwtAuthGuard + CasbinGuard + RequirePolicy({ obj: 'tickets', act: 'read', field: '*' })`
  query: `status`, `priority`, `brandId`, `page`, `limit`
- `TicketAggregationService.findAll(filters)`:
  1. 确定要查询的 schema：若 `brandId` 指定则单 schema，否则遍历 `TENANT_SCHEMAS`
  2. 对每个 schema：`PrismaClientManager.getTenantClient(schema).$queryRaw<Ticket[]>`SELECT ... FROM ticket WHERE ...`
  3. 合并结果集，按 `createdAt` 倒序，截断到 `limit`
  4. 返回 `{ results: [{...ticket, brand: schema}], total }`
- **安全约束**：此 API 绝不暴露给 `/customer/*` 路由组；AdminModule 仅注册于后台 admin 路由

**Patterns to follow:**

- `apps/api/src/database/prisma.service.ts` — `PrismaClientManager.getTenantClient()` 模式
- `packages/db/src/index.ts` — `TENANT_SCHEMAS` 枚举
- `apps/api/src/iam/casbin.module.ts` — CasbinGuard + RequirePolicy 模式

**Test scenarios:**

- Happy path: 2 个 tenant 各有 3 条工单，返回 6 条合并结果
- Security: operator token（非 admin）→ 403
- Security: `brandId=homtone` 过滤后只返回 homtone schema 数据
- Edge case: 某 tenant schema 查询失败（DB 超时）→ 降级：该 schema 结果置空，其他 schema 正常返回，response 含 `partialFailures` 字段

**Verification:**

- `apps/api` 测试全绿
- 手动：admin token 调 `GET /admin/tickets` 可见跨品牌数据；operator token 返回 403

---

- [ ] U6. **Portal Chat UI + 工单列表/详情页**

**Goal:** 在 apps/portal 新增 AI 对话页面（SSE 实时流式显示）和工单管理页面，
集成到现有 Auth + 商品目录导航体系。

**Requirements:** R9

**Dependencies:** U3（Chat SSE API），U4（工单 API），U5 可选（聚合 API 是管理员侧）

**Files:**

- Create: `apps/portal/app/[locale]/(protected)/chat/page.tsx`
- Create: `apps/portal/app/[locale]/(protected)/tickets/page.tsx`
- Create: `apps/portal/app/[locale]/(protected)/tickets/[id]/page.tsx`
- Create: `apps/portal/components/chat/chat-window.tsx`（客户端组件，SSE 消费）
- Create: `apps/portal/components/chat/message-bubble.tsx`
- Create: `apps/portal/components/ticket/ticket-list.tsx`
- Create: `apps/portal/components/ticket/ticket-form.tsx`
- Modify: `apps/portal/lib/api/customer-api-client.ts`（新增 chat/ticket fetch 方法）
- Modify: `apps/portal/app/[locale]/(protected)/layout.tsx`（如需要 auth guard layout）

**Approach:**

- `(protected)` route group：layout 中检查 `customer_token` cookie，未登录 → redirect `/login`
- Chat 页（Client Component）：
  - mount 时 `GET /customer/chat/sessions` 或 create session
  - 使用 `EventSource('/customer/chat/sessions/:id/stream')` 消费 SSE token 流
  - `POST /customer/chat/sessions/:id/messages` 发送消息；Optimistic UI 立即显示用户消息
  - AI 回复 token 实时追加到最后一条 assistant 消息气泡
  - 收到 `event: escalated` → 显示"已转人工服务，正在创建工单"提示
- 工单列表页（Server Component + `revalidate`）：
  `GET /customer/tickets` 分页列表；点击进入详情
- 工单详情页：服务端渲染消息线程（静态部分）+ Client Component 追加新消息
- 新建工单按钮：`<TicketForm>` dialog，提交后 `router.refresh()`

**Patterns to follow:**

- `apps/portal/app/[locale]/(auth)/login/page.tsx` — 表单错误处理模式
- `apps/portal/app/[locale]/(public)/products/page.tsx` — Server Component + 分页模式
- `apps/web/app/[locale]/(admin)/listings/page.tsx` — `router.refresh()` + searchParams

**Test scenarios:**

- Happy path: `NEXT_PUBLIC_BRAND=homtone` 下 Chat 页 mount → EventSource 建立连接
- Happy path: 发送消息 → 消息气泡立即出现（Optimistic），AI token 流式追加
- Error path: SSE 连接断开 → 显示"连接已断开，点击重试"提示，不白屏
- Happy path: 工单列表页 SSR 渲染列表，含工单编号 / 状态 / 创建时间
- Edge case: 未登录访问 `/en/chat` → redirect to `/en/login`

**Verification:**

- `pnpm dev:portal` 启动无报错
- 浏览器：完整对话 → AI 流式回复可见 → 工单列表更新

---

## System-Wide Impact

- **Interaction graph:** `ChatService` 依赖 `FaqKnowledgeService`（OpenSearch）、`EmbeddingService`（Gemini）、`TicketService`（自动升级）、`CostTrackingService`（记录 chat 调用成本）；新增对 OpenSearch 写入路径（FAQ 索引 bootstrap）
- **Error propagation:** AI Fallback Interceptor 捕获 Gemini 异常；网络层错误（OS / DB）正常传播为 503；工单写入失败不应阻塞 AI 流式响应（fire-and-forget escalate）
- **State lifecycle risks:** ChatSession 无 TTL 清理机制（deferred）；工单状态机只允许单向流转（open→resolved，resolved 不可回退 open），需在 service 层显式校验
- **API surface parity:** `/customer/*` 路由仅供 Portal；`/admin/*` 路由仅供 admin panel；两者不共享 token（audience claim 不同）
- **Integration coverage:** 关键集成路径：Portal SSE → Nest `@Sse()` → RxJS Subject → Gemini streamText；需端到端测试验证 token 流正确到达客户端；单元 mock 无法证明 SSE 推送正确
- **Unchanged invariants:** 现有 Listing 生成路径（`/listings/:id/generate`）、operator auth（`/auth/login`）、Casbin 策略、`PRISMA_PUBLIC_CLIENT` 查询均不受本计划影响；`AiFallbackInterceptor` **不**应用于 Listing 生成（独立模块，不同延迟模型）

---

## Risks & Dependencies

| Risk                                                                         | Mitigation                                                                               |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **P0** 跨 Tenant 工单聚合 API 未正确隔离 → 管理员可读取任意品牌数据          | `TicketAggregationService` 严格走 IAM；E2E 安全测试（operator token → 403）              |
| **P0** ChatSession 在错误 tenant schema 创建 → 数据泄漏                      | 所有 chat 写操作通过 CLS tenantId 取 client，unit test mock CLS 验证                     |
| **P1** OpenSearch kNN index 首次 bootstrap 耗时长（全量 FAQ embedding）      | U2 实施时 bootstrap 脚本按 brand+locale 分批写入；CI 不需要真实索引（mock）              |
| **P1** SSE 连接泄漏（客户端断开未 cleanup）                                  | Controller `onClientDisconnect` 或 `request.on('close')` 钩子 unsubscribe Subject        |
| **P1** Gemini Flash API 限流在高并发 chat 下触发 429                         | `AiFallbackInterceptor` 429 同样 retry；`model-router.service.ts` 可配置 fallback-to-glm |
| AI 流式回复 incomplete（网络中断）                                           | SSE `event: done` 终止信号；客户端超时 30s 后显示重试 UI                                 |
| TicketMessage 表增长过快                                                     | 暂无归档策略（W39 上线前数据量可控）；W38 追加 index on `ticket_id, created_at`          |
| Portal SSE 与 Next.js Middleware 冲突（next-intl 重写规则匹配 /stream 路由） | middleware.ts `matcher` 排除 `/api/*` 和 SSE 路径                                        |

---

## Documentation / Operational Notes

- **新增 env vars**（`apps/api/.env.local.example`）：
  - `OPENAI_EMBED_DIMENSION=768`（Gemini text-embedding-004 维度，kNN index 用）
  - `OPENSEARCH_FAQ_INDEX_PREFIX=customer-faq`（按 env 后缀区分 dev/staging/prod）
  - `CHAT_SESSION_TTL_HOURS=48`（可选，暂 deferred）
- **Neon 分支 CI**：`scripts/migrate-tenant-schemas.ts` 追加 `002-chat-ticket.sql` 后，PR preview 流水线需验证迁移幂等
- **OpenSearch FAQ 索引 bootstrap**：S3 上线前需运行 `pnpm tsx scripts/bootstrap-faq-index.ts`（新建，读 ProductContent.payload.faq → embedding 写入）；非 CI 强依赖
- **工单 SLA 到期提醒**：W36 追加 cron job（`@nestjs/schedule`）；本计划仅创建 `sla_due_at` 字段
- **管理员看板前端**：本计划交付 API；前端 admin panel UI（apps/web 新增工单看板页）可在 W35 末或 W36 追加

---

## Sources & References

- **Origin document:** `docs/yaemartOS-implementation-plan.md` §8 W34–W35
- W31–W33 前置计划: `docs/plans/2026-05-03-006-feat-w31-w33-customer-portal-v1-tenant-plan.md`
- Multi-tenant pattern: `docs/solutions/backend-patterns/nestjs-prisma-neon-multitenant-2026-04-30.md`
- CustomerPortalModule: `apps/api/src/customer-portal/`
- EmbeddingService: `apps/api/src/ai/embedding.service.ts`
- ModelRouterService: `apps/api/src/ai/model-router.service.ts`
- OpenSearch 客户端: `apps/api/src/search/search.service.ts`
- ES 索引注册: `apps/api/src/search/es-index-registry.ts`
- Tenant schema: `apps/api/prisma/tenant.schema.prisma`
- PrismaClientManager: `apps/api/src/database/prisma.service.ts`
