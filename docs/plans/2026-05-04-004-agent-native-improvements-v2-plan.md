# Agent-Native Architecture Improvements v2 — S4 后段横切落地（Scope-cut 版）

**Date**: 2026-05-04
**Source**: `/ce-agent-native-audit` 第二轮全量审计（Overall Score 59.4%）+ `/ce-doc-review` 7-persona 评审
**Audit dump**: [`docs/audits/2026-05-W45-agent-native-audit-v2.md`](../audits/2026-05-W45-agent-native-audit-v2.md)（已完成 2026-05-04，含 1/29 / 3/8 等分母方法论说明 + v1→v2 评分差异表）
**Scope**: 在 S4 W46–W52 与业务轨道并行，把审计发现的**架构债部分**落到具体工程任务；**战略性重构（广告 prompt-native 化）整体推至 S5**
**Predecessor**: [`2026-05-04-002-agent-native-improvements-plan.md`](./2026-05-04-002-agent-native-improvements-plan.md)（v1，已部分完成）
**Sprint window**: W46–W52（与 §9 S4 业务节奏并行）
**Predecessor handoff**: v1 P3-A 三件事（侧栏链接、Listing copilot 遮罩、`/help` slash）已被本计划 §3 + §5 P2-B 吸收

---

## 0. 评审产出与 Scope-cut 决策

7 个 persona reviewer 给出整体裁定：「方向对，但当前 v1 写法在 W46 启动会失败」。本版本采纳 product-lens + scope-guardian + adversarial 的核心建议：**砍掉战略性高风险项，保留架构债清理**。

### Scope cut 列表

| 原 v1 项目                                                      | 决策                           | 原因                                                                                                                                                              | 接收方                                      |
| --------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| P1-A 广告建议 Prompt-Native 化 (4 人日)                         | **整体推至 S5**                | product-lens：静默删除 `impressions > 1000` 数据保护 → GLM 在低数据下推 increase_bid 会损钱（P0 product 风险）；scope-guardian：与 S5 prompt 模板 DB 化合并更合理 | S5 W53+ 统一计划                            |
| P1-D `uploadAsset` (~0.75 人日)                                 | **推至 S5**                    | feasibility：multipart 与 LLM 工具调用范式不兼容，需要 base64/presigned URL 重新设计；security：当前 `/upload` 端点无鉴权，先补 auth 再考虑 agent 化              | S5 与 IAM 收尾合并                          |
| P2-A `getBrand` / `getMetric` / `getProductContent` (3 个 CRUD) | **砍掉**                       | scope-guardian：无 agent 用例佐证，YAGNI；单条 metric `getById` 在时序数据中无意义                                                                                | 不做                                        |
| P2-B-2 Onboarding tour (2 人日)                                 | **降为 P3 候选**，先做最小验证 | product-lens：38 人内部产品，能力发现需求未经证伪；adversarial：无用户信号下投资 4 人日是赌                                                                       | 由 P2-C 配合的 PostHog 埋点产生信号后再决定 |
| P2-B-3 Slash command (1 人日)                                   | **整体推至 S5**                | product-lens + scope-guardian：投在即将被 S5 chat agent 取代的 listing copilot 上；feasibility：`ai-copilot-panel.tsx` 当前没有承载 slash 的输入框                | S5 chat agent 同期                          |
| P1-B "注入 customer-portal/chat"                                | **改注入域**                   | feasibility：customer-portal/chat 是 C 端会话，不该暴露运营工具；改为注入到 listing copilot 与未来运营 agent 共享的公共模块                                       | 同窗口处理                                  |

### 总工时变化

**v1: 20 人日 → v2 scope-cut: ~14.25 人日**（实际负载下调约 30%，与 §9 业务带容量对齐）

---

## 1. 审计结果回顾（修正版）

> ⚠️ §0 v1 切片标签存在张冠李戴（Action Parity 误标 P1-A、Prompt-Native 误标 P2-C），下表已更正。

| 原则                      | 当前        | 目标 (S4 末) | 落地切片 (本计划)                                                | 推至 S5                                                    |
| ------------------------- | ----------- | ------------ | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| 1. Action Parity          | 24/26 (92%) | 25/26 (96%)  | P1-D（search bootstrap / keywords import / web client 修齐）     | uploadAsset                                                |
| 2. Tools as Primitives    | 87/91 (96%) | 87/91 (96%)  | 维持（无下行）                                                   | —                                                          |
| 3. Context Injection      | 8/10 (80%)  | 9/10 (90%)   | P1-B-mod（MCP 工具注入 listing copilot）                         | customer-portal/chat 工具调用                              |
| 4. Shared Workspace       | 20/22 (91%) | 22/22 (100%) | P1-C（审计覆盖补齐）                                             | —                                                          |
| 5. CRUD Completeness      | 7/21 (33%)  | 11/21 (52%)  | P2-A（updateShop / getListingVersion / getAdChange / getLocale） | getBrand / getMetric / getProductContent（不做）           |
| 6. UI Integration         | 1/29 (3%)   | 18/29 (62%)  | P0（实时同步层）                                                 | —                                                          |
| 7. Capability Discovery   | 3/7 (43%)   | 4/7 (57%)    | P2-B-1（/help） + P2-C（空状态 + PostHog 埋点）                  | onboarding tour / slash command                            |
| 8. Prompt-Native Features | 3/8 (38%)   | 3/8 (38%)    | **不动**（推至 S5）                                              | 广告 prompt-native + prompt 模板 DB 化 + brand voice DB 化 |
| **Overall**               | **59.4%**   | **~70%**     | —                                                                | S5 末目标 ≥ 80%                                            |

> **目标调整说明**：v1 声称"Overall ≥ 78%"被 product-lens 与 scope-guardian 标记为 vanity metric goal。v2 改为：
>
> - **量化目标**：Overall ~70%（S4 末），由架构债修复贡献
> - **行为型目标**（见 §8 DoD）：P0 SSE 上线 4 周内运营对 listing/ads agent 写入的"未知改动→手动 refresh"事件下降 ≥ 50%

---

## 2. 优先级与里程碑（修正版）

| 优先级 | 主题                                                                                  | 周次窗口 | 工时 (人日) | 依赖                     | Score Δ                             |
| ------ | ------------------------------------------------------------------------------------- | -------- | ----------- | ------------------------ | ----------------------------------- |
| **P0** | 修复 admin-sidebar 假帮助链接                                                         | W46      | 0.5         | —                        | Discovery +0/7（止血）              |
| **P0** | UI Integration 实时同步层                                                             | W46–W47  | 7           | ADR + 审计 dump 完成     | UI Integration 1/29 → 18/29 (+17)   |
| **P1** | MCP 工具自述 → listing copilot                                                        | W48      | 2           | P0 完成                  | Context Injection 8/10 → 9/10 (+1)  |
| **P1** | 审计覆盖补齐                                                                          | W48      | 1           | —                        | Shared Workspace 20/22 → 22/22 (+2) |
| **P1** | 搜索 / web client agent 工具补齐                                                      | W49      | 0.75        | —                        | Action Parity 24/26 → 25/26 (+1)    |
| **P2** | 核心 CRUD 缺口（4 项有用例）                                                          | W50      | 1           | —                        | CRUD 7/21 → 11/21 (+4)              |
| **P2** | `/help` 页面                                                                          | W50      | 1           | P1 工具自述完成          | Discovery 3/7 → 4/7 (+1)            |
| **P2** | 空状态 AI 入口 + PostHog 埋点                                                         | W51      | 1           | P2 /help 完成            | Discovery 信号收集 (条件项验证)     |
| **P3** | （推至 S5）广告 prompt-native + uploadAsset + onboarding tour + slash + chat 工具调用 | S5 W53+  | 单独计划    | 与 prompt 模板 DB 化合并 | —                                   |

**总工时**：14.25 人日 ≈ 1 名前端 + 1 名后端 × 1.5 周；与 §9 业务带容量算账见 §9。

---

## 3. P0：UI Integration 实时同步层

> **痛点**：审计 1/29 (3%)，agent 写入对 UI 几乎全部不可见。
> **前置硬约束**（feasibility + security 共识）：W46 启动前必须完成 ADR 与 4 个架构决策。

### P0-pre：ADR + 4 项架构决策（W46 day 1，0.5 人日，已计入 P0-A）

ADR [`docs/adr/ADR-011-realtime-sync-strategy.md`](../adr/ADR-011-realtime-sync-strategy.md)（已草稿，待 leadership 签字）必须明确以下 4 项才能进 P0-A：

| 决策项                    | 必须给出的答案                                                                                                                                          | feasibility / security 担忧                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **SSE 鉴权机制**          | 用 **HttpOnly cookie + JwtAuthGuard 改写支持 cookie 抽取**，**不**用 Authorization header（浏览器 EventSource 无法带 header）                           | feasibility P0 #1 + security F1（SSE 端点无授权） |
| **跨 pod fanout**         | 用 **Redis pub/sub** 作发布总线（`@nestjs/microservices` 已具备）；进程内 `Subject` 仅用于本 pod 订阅广播                                               | feasibility P0 #2（多副本 K8s 会丢消息）          |
| **mid-edit 数据竞争策略** | UI 侧 SSE 事件命中"用户正在编辑的实体" → 仅显示 toast `"Agent X 修改了此 listing，[查看变更]"`，**不**自动 invalidate；用户主动点击才刷新               | design F1/F2（编辑期数据丢失）                    |
| **Feature flag**          | `feature_flag.AGENT_NATIVE_REALTIME_UI`，按品牌灰度；默认 off；W46 dev 开 / W48 staging 开 / W52 prod 开（满足 AGENTS.md "每模块上线前必须有功能开关"） | adversarial F8（违反 AGENTS.md）                  |

> **若 ADR 未在 W46 day 1 完成 → P0-A 自动顺延**，不接受"先做后补"。

### P0-A：选型 + 框架引入（W46，3 人日，含 ADR）

| 任务                                                                                                                                                  | 完成标准                                                                                                                                 | 文件 / 校验                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 写完 P0-pre ADR 4 项决策                                                                                                                              | leadership 签字（或异步评审 24h 无异议视为通过）                                                                                         | [`docs/adr/ADR-011-realtime-sync-strategy.md`](../adr/ADR-011-realtime-sync-strategy.md) |
| 引入 `@tanstack/react-query` 到 `apps/web`                                                                                                            | `pnpm install @tanstack/react-query`；`QueryProvider` 挂在 `app/[locale]/layout.tsx` 的客户端 boundary                                   | dev server 无报错；bundle 增量 < 30kb gzip                                               |
| 实现 `JwtAuthGuard` 的 cookie 抽取分支（保留 header 抽取兼容旧客户端）                                                                                | guard 单测覆盖 cookie 与 header 双路径                                                                                                   | `apps/api/src/auth/jwt-auth.guard.ts`                                                    |
| 在写入端点 controller 上发出 SSE 事件，**先选 listings / ads/suggestions / shops 三条线**                                                             | `@Sse('/inbox')` 路由 + `RealtimeBus` service（Redis pub/sub）；事件 payload `{ entity, action, brandId, ids[] }` 经 Casbin 过滤 brandId | curl + cookie 订阅 `/sse/inbox` 看到 ≥1 个事件，与其他 brand 订阅互不可见                |
| Web 侧 `useEntityRevalidation(entity, { mode })` hook：`mode='auto'` 直接 `invalidateQueries` + `router.refresh()`；`mode='toast'` 显示提示由用户决定 | hook 单测：mock SSE 触发后两种 mode 行为正确；feature flag off 时短路                                                                    | `apps/web/lib/realtime/use-entity-revalidation.ts`（新建）                               |

### P0-B：Listing 编辑器实时刷新（W46，1 人日）

| 任务                                                                                           | 完成标准                                                                                 | 文件                                                   |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `listing-editor-shell.tsx` 接 `useEntityRevalidation('listing', { mode: 'toast', listingId })` | agent `generateListingDraft` 触发后，编辑器顶部出现 toast；用户点击 → `router.refresh()` | `apps/web/components/listing/listing-editor-shell.tsx` |
| 把 `activateVersion` 接到 UI（v1 仅在 `listing-client.ts` 暴露但无组件调用）                   | 编辑器版本列表新增"激活"按钮 + Radix `AlertDialog` 确认                                  | 同上 + 复用 `change-history-client.tsx` 模式           |
| `AiHintBubble` (`content-editor.tsx:74-79`) 接上真实生成回调或移除                             | 不再有 `onAction={() => {}}` 死链                                                        | `apps/web/components/listing/content-editor.tsx`       |

### P0-C：广告建议 + 看板实时刷新（W46，1 人日）

| 任务                                                                                       | 完成标准                                                                 | 文件                                                                       |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `suggestion-list-client.tsx` 接 `useEntityRevalidation('ad-suggestion', { mode: 'auto' })` | agent execute/reject 触发后列表自动刷新（这些不是用户编辑场景，可 auto） | `apps/web/app/[locale]/(admin)/ads/suggestions/suggestion-list-client.tsx` |
| `change-history-client.tsx` 接 `useEntityRevalidation('ad-change', { mode: 'auto' })`      | rollback 后历史自动刷新                                                  | 同目录                                                                     |
| `ad-dashboard-client.tsx` 接 `useEntityRevalidation('ad-daily-stat', { mode: 'auto' })`    | `triggerAdSync` 触发后看板自动刷新                                       | `apps/web/app/[locale]/(admin)/ads/dashboard/ad-dashboard-client.tsx`      |

> **§9 协调**：P0-C 同窗口与 dayparting（W46）改 `ad-dashboard-client.tsx` —— 提前与 owner 对齐，串行 PR 顺序：先 dayparting 后 P0-C。

### P0-D：Shop / Settings / Migration 跟进（W47，1.5 人日）

| 任务                                                                            | 完成标准                                       | 文件                                                                           |
| ------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `ShopBindingList` 接 `useEntityRevalidation('shop-binding', { mode: 'toast' })` | agent bind/unbind 触发 toast；用户编辑期不打断 | `apps/web/components/shop/shop-binding-list.tsx`                               |
| Settings 三个面板接 `useEntityRevalidation('system-config', { mode: 'toast' })` | toast `"Agent 修改了 X 配置，刷新"`            | `apps/web/components/settings/{feature-flags,ai-config,brand-theme}-panel.tsx` |
| `import-job-progress.tsx` 现有 `setInterval(3s)` 替换为 SSE（保留 fallback）    | agent `triggerPathAImport` 即时可见            | `apps/web/components/migration/import-job-progress.tsx`                        |
| 迁移页"最近任务"表抽到客户端组件 + 接 SSE                                       | agent 触发新任务后表格自动出现新行             | `apps/web/app/[locale]/(admin)/migration/page.tsx`                             |

### P0-E：联调验收（W47，0.5 人日）

| 校验项                                                                                                      | 期望结果 |
| ----------------------------------------------------------------------------------------------------------- | -------- |
| Playwright E2E：浏览器开 listing 编辑器 → curl 调 `generateListingDraft` → 5s 内 toast 出现且点击后版本更新 | ✅       |
| Playwright E2E：浏览器开广告建议页 → curl 调 `executeAdSuggestion` → 列表自动刷新                           | ✅       |
| Playwright E2E：浏览器开店铺管理 → curl 调 `updateShopBinding(unbind=true)` → toast 出现                    | ✅       |
| 跨 brand 隔离：A brand 的 token 订阅 B brand 的 brandId → 无事件                                            | ✅       |
| SSE 连接稳定 30 分钟无断开                                                                                  | ✅       |
| Feature flag off → SSE hook 完全不连接                                                                      | ✅       |

> **E2E 路径**：现有 e2e 在仓库根 `tests/e2e/`，**非** `apps/api/tests/e2e/`（修正 v1 错误）。SSE Playwright helper 是隐性成本：写一次 `subscribeSse(brandId)` 工具函数，约 0.25 人日已计入 P0-E。

**P0 完成标志**：UI Integration 评分 1/29 → 18/29 (62%)；feature flag 默认 off，灰度按 ADR 计划。

---

## 4. P0 旁支：修复假"帮助文档"链接（W46，0.5 人日）

| 任务                                                                                                                                                 | 完成标准                            | 文件                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------- |
| `apps/web/components/admin/admin-sidebar.tsx:152-158` 的"帮助文档"当前指向 `/settings`。在 `/help` 页（P2-B-1）上线前先把 label 改为"系统设置"或隐藏 | 视觉验证：不再有"帮助文档→设置"误导 | `apps/web/components/admin/admin-sidebar.tsx` |

---

## 5. P1：Context Injection + Action Parity 补齐

### P1-B-mod：MCP 工具自述模块（W48，2 人日）

> **修改**：v1 把工具清单注入到 `customer-portal/chat`（C 端客服）—— feasibility 标记为**注入域错**。改为：建公共 `agent-capabilities` 模块，先供 listing copilot 使用，S5 chat agent 上线时复用。

| 任务                                                                                                | 完成标准                                                             | 文件                                                          |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| 在 `YaemartOsToolDescriptor` 类型中加可选元数据 `requiredPolicy?: string`                           | 类型扩展不破坏现有 88 个描述符                                       | `apps/api/src/ai/tools/yaemartos-tools.ts`                    |
| 新增 ADR `docs/adr/ADR-012-mcp-tool-iam-metadata.md`：定义工具如何携带 IAM 要求；与 Casbin 维度对齐 | leadership 签字                                                      | 新建                                                          |
| 实现 `getMcpToolsForBrand(brandId, userId)`：基于 Casbin policy 过滤工具列表                        | 单测：不同 IAM 角色返回不同子集                                      | `apps/api/src/ai/tools/agent-capabilities.service.ts`（新建） |
| 新增 `GET /ai/capabilities` 端点：返回当前 IAM scope 内的工具摘要                                   | + `JwtAuthGuard` + `AiRateLimitGuard`（防 recon）；缓存键含 `userId` | `apps/api/src/ai/ai.controller.ts`                            |
| 新增 `getAgentCapabilities` agent 工具描述符（agent 自述用）                                        | 工具列表里出现                                                       | `apps/api/src/ai/tools/yaemartos-tools.ts`                    |
| `apps/web/components/listing/ai-copilot-panel.tsx` 在「AI 能做什么」区块拉 `/ai/capabilities` 渲染  | UI 验证：不同角色看到不同清单                                        | 同文件                                                        |

> **不做**：注入 `customer-portal/chat` 系统 prompt（注入域错；S5 客户中心 v2 同期处理）。

### P1-C：审计覆盖补齐（W48，1 人日）

| 任务                                                                                                                                | 完成标准             | 文件                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------- |
| `AdSuggestionService.generate()` `createMany` 后调一次 `audit.logWrite('ad_suggestion.batch_generate', { batchId, count, shopId })` | 单测验证审计写入     | `apps/api/src/ad-suggestion/ad-suggestion.service.ts` |
| `TerminologyService` 注入 `AuditService`，对 create/update/delete/import 写审计                                                     | 单测覆盖             | `apps/api/src/terminology/terminology.service.ts`     |
| `SettingsService` 对 feature flag / AI routing / brand theme 写入都写审计                                                           | 单测覆盖             | `apps/api/src/settings/settings.service.ts`           |
| `MetricController.record` 写 `metric.record` 审计 + **同时确保该路由有 `JwtAuthGuard`**（security F8：审计前必须先有 auth）         | 单测覆盖；Guard 检查 | `apps/api/src/metric/metric.controller.ts`            |

> **不做**：path-A 单行 `listingVersion.create` 审计（迁移大批量场景，单行写 audit 会爆表）。

### P1-D：搜索 / web client 补齐（W49，0.75 人日）

> **缩水**：v1 1.5 人日含 `uploadAsset`（推 S5）。现在仅剩搜索类工具 + web client 修齐。

| 缺口                                           | 工具名                                                               | 完成标准                                                                 | 文件                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `POST /search/bootstrap` 无工具                | `bootstrapSearchIndex`                                               | 描述符 + 注入到 `yaemartos-tools.ts`；DTO 校验；admin-only Casbin policy | `apps/api/src/ai/tools/yaemartos-tools.ts` + `apps/api/src/search/search.controller.ts` |
| `POST /search/keywords/import` 无工具          | `importSearchKeywords`                                               | 同上；keyword 输入做 XSS sanitize                                        | 同上                                                                                    |
| `triggerAdSync` 无 web 封装                    | 在 `ad-dashboard-client.ts` 暴露 `triggerSync()`                     | UI 调用 与 agent 工具同源                                                | `apps/web/lib/api/ad-dashboard-client.ts`                                               |
| `ai-mcp-client.ts` 与 controller body 形态分叉 | 修齐 `keywordSuggestions` / `inventoryQuery` 的 TS 类型与运行时 body | 类型一致                                                                 | `apps/web/lib/api/ai-mcp-client.ts`                                                     |

**P1 完成标志**：Action Parity 24/26 → 25/26；Context Injection 8/10 → 9/10；Shared Workspace 20/22 → 22/22。

---

## 6. P2：CRUD 收尾 + 能力发现最小验证

### P2-A：核心实体 CRUD 缺口（W50，1 人日，缩水版）

> **不补**："by design" 的（User Create/Delete、Article、Platform、Invitation）+ **YAGNI 砍掉的**（getBrand / getMetric / getProductContent，无 agent 用例佐证）。

| 实体           | 缺口      | 工具名              | agent 用例                                   | 文件                                                                            |
| -------------- | --------- | ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| Shop           | Update    | `updateShop`        | agent 纠错店铺 marketId / 切换 isActive      | `apps/api/src/shop/shop.controller.ts` + `yaemartos-tools.ts`                   |
| ListingVersion | Read 单条 | `getListingVersion` | agent 在生成新版本前检查上一个 active 的内容 | `apps/api/src/listing/listing.controller.ts` + `yaemartos-tools.ts`             |
| AdChange       | Read 单条 | `getAdChange`       | agent rollback 前确认 change 详情            | `apps/api/src/ad-suggestion/ad-suggestion.controller.ts` + `yaemartos-tools.ts` |
| Locale         | Read 单条 | `getLocale`         | agent 多语言生成时获取 locale 配置           | `apps/api/src/locale/locale.controller.ts` + `yaemartos-tools.ts`               |

**完成标准**：CRUD Completeness 7/21 → 11/21 (52%)。

### P2-B-1：`/help` 页面（W50，1 人日）

| 任务                                                                                                          | 完成标准                                      | 文件                                          |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------- |
| 新建 `apps/web/app/[locale]/(admin)/help/page.tsx`，按模块（Listing / Ads / Migration / Shop / Settings）组织 | 路由可达；i18n 框架接入（zh-CN / en-US 两版） | 新文件                                        |
| 内容来源：调用 P1-B 的 `/ai/capabilities`，按当前 IAM 渲染                                                    | 不同角色看到不同清单；不暴露未授权工具        | 同上                                          |
| 修复 `admin-sidebar.tsx` 链接 → `/help`（替换 §4 的临时止血）                                                 | 链接正确                                      | `apps/web/components/admin/admin-sidebar.tsx` |

### P2-C：模块空状态 AI 入口话术 + 采用率埋点（W51，1 人日）

> **新增 PostHog 埋点**：为后续判定是否做 onboarding tour / slash command 提供数据信号（product F2/F8 + scope F5 共识）。

| 文件                                                                                  | 改造                                                     | 埋点事件                   |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------- |
| `apps/web/components/product/product-list.tsx:8-14` 空状态                            | 加"或在 Listing 编辑器使用 AI 生成草稿"+ CTA 按钮        | `empty_state_cta_click`    |
| `apps/web/components/category/category-list.tsx:13-15` 空状态                         | 同上                                                     | 同上                       |
| `apps/web/app/[locale]/(admin)/migration/page.tsx` 最近任务空状态                     | 加"Agent 也可触发 `triggerPathAImport`"                  | 同上                       |
| `apps/web/app/[locale]/(admin)/ads/suggestions/suggestion-list-client.tsx:152` 空状态 | 改写为"暂无建议；运行 `generateAdSuggestions` 工具或..." | 同上                       |
| `apps/web/components/listing/ai-copilot-panel.tsx` 各 ActionButton                    | 加 `agent_capability_invoked` 埋点                       | `agent_capability_invoked` |

**条件项触发规则**：W51 末 + 4 周采集后，若任意指标达标则启动 P3 onboarding tour 工程：

- `empty_state_cta_click` 4 周累计 ≥ 30 次（38 人 × 0.8 人/周）
- `agent_capability_invoked` 周活跃运营占比 ≥ 30%

否则把 onboarding tour / slash command 的 P3 队列**也**推到 S5 chat agent 同期。

**P2 完成标志**：CRUD 11/21 (52%)；Discovery 4/7 (57%)；信号采集就绪。

---

## 7. 已推迟到 S5 的清单（与 v1 P3 + 本次 cut 合并）

| 项目                                      | 原属            | 推后原因                                                                       |
| ----------------------------------------- | --------------- | ------------------------------------------------------------------------------ |
| 广告建议 Prompt-Native 化                 | v1 P1-A         | product P0 风险（损钱）；与 prompt 模板 DB 化合并                              |
| Prompt 模板 DB 化（chat / faq / listing） | v0 P2-A → v2 P3 | S5 统筹                                                                        |
| Brand Voice DB 化                         | v1 P2-C         | S3 注释已标明 S3+ 迁移；S5 统筹                                                |
| Customer Chat 工具调用                    | v1 P2-B         | S5 客户中心 v2 同期                                                            |
| `uploadAsset` agent 工具                  | v1 P1-D         | multipart 范式与 LLM 工具不兼容；S5 与 IAM 收尾合并设计 base64 / presigned URL |
| Onboarding tour                           | v1 P2-B-2       | 等 P2-C 埋点信号；预计 S5 W53–W54                                              |
| Slash command                             | v1 P2-B-3       | S5 chat agent 同期                                                             |
| 工单实时推送                              | v1 P3-B         | P0 SSE 已铺好，S5 直接对接                                                     |
| 整体 onboarding 文案 / i18n / a11y 全检   | design lens     | S5 多品牌扩张同期统一治理                                                      |

---

## 8. 风险与缓解（修正版）

| 风险                                                    | 维度                     | 等级   | 缓解                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SSE 在 K8s ingress 下断流                               | feasibility              | 中     | ADR 中 evaluate keep-alive；fallback 5s 短轮询；预 spike 1 天                                                                                          |
| **SSE 鉴权与 EventSource 不兼容**                       | **security/feasibility** | **高** | **P0-pre 强制：cookie-based JWT 抽取**；P0-A 单测覆盖                                                                                                  |
| **跨 pod 多副本丢消息**                                 | **feasibility**          | **高** | **Redis pub/sub 必须**，不接受进程内 Subject                                                                                                           |
| TanStack Query bundle 增量                              | feasibility              | 低     | tree-shake；非实时页不挂 provider；DoD 卡 30kb                                                                                                         |
| `setAdPolicy` DoS（已推 S5，但 P1-D 工具仍需 DTO 守护） | security                 | 中     | `bootstrapSearchIndex` / `importSearchKeywords` 加 DTO + admin-only Casbin                                                                             |
| 审计补齐导致写入路径变慢                                | feasibility              | 低     | `AuditService.logWrite` 已是异步队列；spike test P95                                                                                                   |
| **整计划无 feature flag 治理**                          | **治理**                 | **高** | **P0-pre 强制 `feature_flag.AGENT_NATIVE_REALTIME_UI`**；按品牌灰度（dev W46 / staging W48 / prod W52）                                                |
| **§9 与本计划工程注意力争夺**                           | **容量**                 | **高** | **§9 容量算账**（见下表）；W46 P0-C 与 dayparting 串行 PR；P0-D Settings 与 §9 预算监控不冲突（实体不重叠 + owner 对齐）                               |
| ~~审计 v2 dump 缺失~~（已关闭）                         | 治理                     | —      | [`docs/audits/2026-05-W45-agent-native-audit-v2.md`](../audits/2026-05-W45-agent-native-audit-v2.md) 已写完，含 8 原则评分 / 分母方法论 / v1→v2 差异表 |
| GLM 输出方向反向 sanity（P1-A 已推 S5，本计划不涉及）   | product                  | —      | S5 prompt-DB 计划必须包含方向性 sanity guard + shadow run 量化阈值（≥80% 方向一致率）                                                                  |
| Onboarding 是否真有需求（P2-B-2 已降级）                | product                  | —      | P2-C 埋点 4 周采集后再决定是否启动；不做"赌需求"的 4 人日投资                                                                                          |

---

## 9. 与 §9 S4 业务节奏的容量算账

> **scope-guardian + adversarial 共识**：v1 "实体不重叠" 不等于 "时间不重叠"；必须做容量数学。

### 容量数学

| 维度           | 数值                                                                |
| -------------- | ------------------------------------------------------------------- |
| 团队           | 1 名前端 + 1 名后端                                                 |
| 周期           | W46–W52 = 7 周                                                      |
| 周有效产能     | 5 工作日 × 50%（会议 / review / 上下文切换 / 故障）= 2.5 人日/周/人 |
| 7 周总有效产能 | 7 × 2 × 2.5 = **35 人日**                                           |

### 占用分配

| 计划                                                                 | 分配           | 备注                        |
| -------------------------------------------------------------------- | -------------- | --------------------------- |
| §9 S4 业务带（dayparting + 多仓 + NetSuite + FBA + 采购 + 上线演示） | ~22 人日       | 主计划估算                  |
| 本计划 (scope-cut)                                                   | **14.25 人日** | 见 §2                       |
| **小计**                                                             | **36.25 人日** | 略超 35                     |
| Buffer / 故障 / 临时插入                                             | 0              | **无 buffer**——这是真实风险 |

### 缓解

1. **W46 P0-pre ADR 是 gate**：若 ADR 通不过或卡 1–2 天 → P0-A 顺延 → 本计划自动让出至少 2 人日给 §9
2. **P2-C 埋点条件项**：若 4 周后信号不足 → onboarding/slash 推 S5，不挤占 W51
3. **owner 对账**：W45 末与 §9 owner 当面 sync 一次，确认双方都接受 36 人日略超 35 的硬约束；如不接受 → 本计划再砍 1.25 人日（候选：P2-A 仅保留 `updateShop` + `getListingVersion` 2 项）

### 周次协调表

| 周次 | §9 业务（plan §9）                | 本计划（scope-cut）              | 冲突点                                                      |
| ---- | --------------------------------- | -------------------------------- | ----------------------------------------------------------- |
| W46  | Dayparting + 预算监控（前端为主） | P0-pre ADR + P0-A + sidebar 修复 | P0-C 与 dayparting 同改 `ad-dashboard-client.tsx` → 串行 PR |
| W47  | Dayparting 收尾                   | P0-D + P0-E                      | 无                                                          |
| W48  | 供应链多仓视图（后端为主）        | P1-B-mod + P1-C                  | 无                                                          |
| W49  | NetSuite 字段对齐（后端为主）     | P1-D                             | 无                                                          |
| W50  | 多仓 + 补货预警                   | P2-A + P2-B-1                    | 无                                                          |
| W51  | FBA 入仓计划 + 采购单             | P2-C + 埋点                      | 无                                                          |
| W52  | S4 上线（全链路演示）             | 验收 + 重审计 + ADR 归档         | 仅 review 评分占用工程师半天                                |

---

## 10. 完成标准（DoD，行为型 + 评分双轨）

P0–P2 全部完成时：

### 评分指标（架构债健康度）

- [ ] UI Integration 1/29 → 18/29 (62%)
- [ ] Action Parity 24/26 → 25/26 (96%)
- [ ] Context Injection 8/10 → 9/10 (90%)
- [ ] Shared Workspace 20/22 → 22/22 (100%)
- [ ] CRUD Completeness 7/21 → 11/21 (52%)
- [ ] Capability Discovery 3/7 → 4/7 (57%)
- [ ] **Overall ~70%**（不再追 78%；S5 末再上）
- [ ] **W52 末重新跑 `/ce-agent-native-audit` 并产出 v3 audit dump 验证以上分数**（不重审计 → DoD 不通过）

### 行为型指标（用户感知）

- [ ] P0 SSE 上线 4 周内：5 个高频写入页（listing 编辑、广告建议、店铺、settings、migration）实测**录屏证据**，agent 写入后 5s 内 toast 出现或自动刷新
- [ ] P2-C 埋点 4 周采集后产出报告：`empty_state_cta_click` / `agent_capability_invoked` 数值能驱动 P3 onboarding 决策
- [ ] 38 名运营在 W52 反馈表中"未知改动→手动 refresh"事件下降 ≥ 50%（与 W45 基线对比）

### 治理 / 文档

- [ ] ADR [`ADR-011-realtime-sync-strategy.md`](../adr/ADR-011-realtime-sync-strategy.md)（含 4 项架构决策签字）
- [ ] ADR `ADR-012-customer-chat-tool-calling.md`（W48 P1-B-mod-v2 同期产出 — scope 已 W46 末单项审计调整，原 IAM-metadata 决策已含在 GET /ai/mcp/tools 落地中）
- [ ] 审计 dump `docs/audits/2026-05-W45-agent-native-audit-v2.md`（W46 前置）+ `2026-05-W52-agent-native-audit-v3.md`（W52 验收）
- [ ] `feature_flag.AGENT_NATIVE_REALTIME_UI` 灰度时间线在 SystemConfig 中可查
- [ ] 全量 API + Web 测试 / typecheck / lint 通过；`docs/W46-W52-checklist.md` 勾选完成
- [ ] `docs/solutions/` 新增 ≥ 1 条记录（如 SSE keepalive 调优、cookie-based JWT 抽取 等）

---

## 11. Owner 矩阵

| 工作项                           | Backend Owner | Frontend Owner | Reviewer                                   |
| -------------------------------- | ------------- | -------------- | ------------------------------------------ |
| P0-pre ADR                       | 待指派        | —              | leadership + security                      |
| P0-A SSE 框架                    | 待指派        | 待指派         | feasibility reviewer                       |
| P0-B/C/D UI 接入                 | —             | 待指派         | design reviewer                            |
| P0-E E2E                         | —             | 待指派         | QA                                         |
| §4 sidebar 修复                  | —             | 待指派         | design                                     |
| P1-B-mod-v2（chat tool calling） | 待指派        | 待指派         | security（tool execute IAM） + AI Engineer |
| P1-C 审计                        | 待指派        | —              | —                                          |
| P1-D 搜索/客户端                 | 待指派        | 待指派         | security（DTO + Casbin）                   |
| P2-A CRUD                        | 待指派        | —              | —                                          |
| P2-B-1 /help                     | —             | 待指派         | design（i18n）                             |
| P2-C 埋点                        | —             | 待指派         | analytics                                  |

---

## 12. 接下来执行

```
# Step 1：审计 dump + ADR 前置（W45 末或 W46 day 1）
/ce-work P0-pre  # 写完 audit dump + ADR 4 项决策

# Step 2：通过后启动 SSE 框架
/ce-work P0-A    # 待 P0-pre 完成才能开

# Or 一次性吃掉 W46
/ce-work W46     # 含 P0-pre + P0-A + P0-B + P0-C + sidebar 修复
```

> **若 P0-pre 未通过**（leadership 卡 ADR、容量对账失败、审计 dump 缺评估），整个计划自动 hold；不接受"先做后补"。

---

## 13. 落地后回头审计（W46 末）

- [`docs/audits/2026-05-W46-action-parity-single-audit.md`](../audits/2026-05-W46-action-parity-single-audit.md) — P0-A/B/C 完成后单项 Action Parity 审计，静态分 88.2%；揭示**隐藏债务**：87 条 tool descriptors 已就绪但 `streamText({ tools })` 实际挂载 = **0**。
  - 直接影响：W48 `P1-B-mod` 调整为 `P1-B-mod-v2`（chat 接 Vercel AI tool calling 子集），同等 2 人日预算。
  - 已在 [`W46-W52-checklist.md`](../W46-W52-checklist.md) §1 W48 + §3 风险跟踪 同步落地。
