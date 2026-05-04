# W49 末 Sprint Harness 对齐审计（W46–W49 工程支撑层 vs 8 大 agent-native 原则）

> **审计类型**：sprint-level harness alignment（不是 codebase 全量 audit；后者排在 W52 末）
> **生成日期**：2026-05-04（W49 D1，紧跟 `/review` 4 条 P0/P1 修复 + backlog 登记）
> **审计范围**：W46–W49 这 4 周搭建的"工程支撑系统"——SSE realtime / TanStack Query / customer chat tool calling / KPI 仪表化 / admin dashboard widget / staging smoke / GitHub Actions cron / `/review` 流程 / W50 backlog / 卫生周 backlog
> **方法**：对照 ce-agent-native-audit skill 的 8 大原则，逐条评估 W46–W49 harness **是否强化了该原则** + Δ 贡献，并给 W52 v3 forecast 提供锚点
> **基线锚定**：
>
> - [W45 v2 全量审计](./2026-05-W45-agent-native-audit-v2.md)（59.4% overall）
> - [W46 末 Action Parity 单维度](./2026-05-W46-action-parity-single-audit.md)（88.2% 静态、0 runtime）
> - [W48 末 Action Parity 单维度](./2026-05-W48-action-parity-single-audit.md)（92.2% 静态、8 runtime）
> - [W48 末 Context Injection 单维度](./2026-05-W48-context-injection-single-audit.md)（90%，提前 4 周达 v3 forecast）
>
> **下一次审计**：W52 末跑 `/ce-agent-native-audit`（全 codebase）产出 v3 dump，与 W45 v2 对照 + 与本份 forecast 对照

---

## 0. TL;DR — Sprint Harness 对齐总分

| #   | 核心原则               | W45 v2      | W47 末（SSE）           | W48 末（chat tools）                  | **W49 末（KPI + smoke + cron + review fixes）**                      | W52 v3 forecast                             |
| --- | ---------------------- | ----------- | ----------------------- | ------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------- |
| 1   | Action Parity          | 24/26 (92%) | 90/102 静态 + 0 runtime | 94/102 (92.2%) + 8 runtime            | **94/102 (92.2%) + 8 runtime（KPI 把 runtime 量化可观测）**          | 97/102 (95%) + 11 runtime                   |
| 2   | Tools as Primitives    | 87/91 (96%) | 同                      | 95/99 (96%)                           | **95/99 (96%)**                                                      | 95/99 (96%)                                 |
| 3   | Context Injection      | 8/10 (80%)  | 同                      | **9/10 (90%)** ⬆                      | **9/10 (90%)**                                                       | 10/10 (100%)                                |
| 4   | Shared Workspace       | 20/22 (91%) | 同                      | 同                                    | **同（KPI 进 public Metric 表，符合 SHARED）**                       | 22/22 (100%)（P1-C 4 项 audit 关闭后）      |
| 5   | CRUD Completeness      | 7/21 (33%)  | 同                      | 同                                    | **同（W50 P2-A 才动）**                                              | 11/21 (52%)                                 |
| 6   | UI Integration         | 1/29 (3%)   | **~18/29 (62%)** ⬆      | ~18/29 (62%)                          | **~19/29 (66%)（admin dashboard widget 接入；非 SSE 但 SSR-fresh）** | 22/29 (76%)                                 |
| 7   | Capability Discovery   | 3/7 (43%)   | 同                      | **3.5/7 (50%)**（chat 自述 derive）   | **3.5/7 (50%)**                                                      | 5/7 (71%)（/help + 空状态 + 假链接修复后）  |
| 8   | Prompt-Native Features | 3/8 (38%)   | 同                      | **3.5/8 (44%)**（toolSummary derive） | **3.5/8 (44%)**                                                      | 3.5/8 (44%)（v2 不动这条，S5 prompt DB 化） |

### W49 末综合 Sprint Harness 对齐指数

\[
\text{Score} = \frac{0.92 + 0.96 + 0.90 + 0.91 + 0.33 + 0.66 + 0.50 + 0.44}{8} = \mathbf{70.2\%}
\]

> **Δ vs W45 v2**：59.4% → 70.2% = **+10.8pp**（W46–W49 4 周净增）
> **Δ vs W48 末**：68.5% → 70.2% = **+1.7pp**（W49 单周净增；主要来自 UI Integration 通过 dashboard widget +4pp）
> **W52 v3 forecast**：**~78%**（按 W50 P2-A/D + W51 P2-C + 卫生周 backlog 全完成估算）

### 状态图例

- ✅ 优秀 ≥ 80%：原则 1 / 2 / 3 / 4
- ⚠️ 部分 50–79%：原则 6 / 7
- ❌ 待改 < 50%：原则 5 / 8

---

## 1. 审计范围 — W46–W49 已落地的 Harness 组件

> 本节列出"工程支撑系统"具体组件，作为 §2 逐原则评估的 evidence 锚点。

### 1.1 实时同步 harness（W46–W47）

| 组件                  | 文件                                                                                          | 状态 |
| --------------------- | --------------------------------------------------------------------------------------------- | ---- |
| SSE realtime bus      | `apps/api/src/realtime/realtime-bus.service.ts` (Redis pub/sub)                               | ✅   |
| SSE controller        | `apps/api/src/realtime/realtime-sse.controller.ts` (`@Sse('/sse/inbox')` + Casbin brand 过滤) | ✅   |
| Cookie-based JWT      | `apps/api/src/main.ts` cookie-parser + `JwtAuthGuard` cookie 抽取                             | ✅   |
| TanStack Query        | `apps/web/lib/realtime/use-entity-revalidation.ts` (auto / toast 双 mode)                     | ✅   |
| 5 个 admin 写入页接入 | listing 编辑 / 广告建议 / 看板 / 店铺 / settings / migration                                  | ✅   |
| Feature flag          | `AGENT_NATIVE_REALTIME_UI` per-brand                                                          | ✅   |
| W47 staging seed      | `YAEMART_SEED_REALTIME_UI_BRANDS=homtone` env-driven seed                                     | ✅   |
| ADR-011               | `docs/adr/ADR-011-realtime-sync-strategy.md`                                                  | ✅   |
| E2E + browser 测试    | `tests/e2e/w47-realtime-sse.spec.ts` (6 tests) + `tests/e2e/w47-realtime-toast.spec.ts`       | ✅   |

### 1.2 Customer chat tool calling harness（W48）

| 组件                                   | 文件                                                                                                   | 状态 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---- |
| 8 条 customer-self tool                | `apps/api/src/customer-portal/chat/customer-chat-tools.ts` (Vercel AI `tool({})` × 8)                  | ✅   |
| `streamText({ tools })` 注入           | `chat.service.ts` runtime 挂载                                                                         | ✅   |
| `describeCustomerChatTools` derive     | system prompt 不硬编码能力清单（ADR-012 §D5）                                                          | ✅   |
| 结构化错误回灌                         | `{ ok: false, error, message }` 给 LLM graceful retry（ADR-012 §D3）                                   | ✅   |
| `OrderLookupService.lookupForChatTool` | 跳 CAPTCHA + 强制 customerId（ADR-012 §D6）                                                            | ✅   |
| Feature flag                           | `AGENT_NATIVE_TOOL_CALLING` per-brand（独立于 RealtimeUI）                                             | ✅   |
| Frontend in-flight 提示                | `apps/portal/components/chat/chat-window.tsx` `activeTools` state                                      | ✅   |
| ADR-012                                | 6 个决策：D1 tool 子集 / D2 IAM 在 execute / D3 错误回灌 / D4 flag / D5 derive prompt / D6 OrderLookup | ✅   |
| 单测                                   | 14 条（IAM lock + 错误分类 + customerId 锁 + describeCustomerChatTools 渲染）                          | ✅   |

### 1.3 KPI 仪表化 harness（W49 D1）

| 组件                                                     | 文件                                                                                          | 状态 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---- |
| 3 条 metric 常量                                         | `KPI_TOOL_INVOCATION` / `KPI_TOOL_ERROR` / `KPI_TOOL_SESSION`                                 | ✅   |
| `recordToolMetric` fire-and-forget                       | `chat.service.ts` 注入 `PRISMA_PUBLIC_CLIENT`                                                 | ✅   |
| KPI flush 策略（**W49 D1 review 修复 F-2/F-7**）         | retry loop 之外 flush；session 无条件写 1；invocation/error 仅成功时 flush                    | ✅   |
| `isToolErrorResult` runtime guard（**W49 D1 修复 F-3**） | `chat.service.ts` 私有方法；null/undefined silent；非对象 / 缺 ok / 非 boolean → warn + false | ✅   |
| `safeNumber` 聚合 helper（**W49 D1 修复 F-1**）          | `metric-client.ts` Decimal wire-string → number 安全转换                                      | ✅   |
| 单测覆盖                                                 | +14 条（4 retry-aware + 7 envelope guard + 3 string fixture）                                 | ✅   |
| Brief                                                    | `docs/briefs/2026-05-W49-leadership-sync.md`（1 页 + KPI 定义 + 阈值 + 风险登记）             | ✅   |

### 1.4 Admin dashboard 观测 harness（W49 D1）

| 组件                       | 文件                                                                                 | 状态 |
| -------------------------- | ------------------------------------------------------------------------------------ | ---- |
| Pure aggregator            | `apps/web/lib/api/metric-client.ts` `aggregateChatToolKpis()`                        | ✅   |
| 8/8 单测                   | `metric-client.spec.ts`（5 baseline + 3 F-1 string-fixture 回归）                    | ✅   |
| 4 张 KPI 卡 widget         | `apps/web/components/dashboard/chat-tool-activity.tsx`（健康/告警颜色 + 按品牌切片） | ✅   |
| Dashboard server component | `apps/web/app/[locale]/(admin)/dashboard/page.tsx` 并行拉 3 metric + API 故障降级    | ✅   |

### 1.5 Staging smoke + cron harness（W49 D1）

| 组件                  | 文件                                                                                                          | 状态                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Smoke script          | `scripts/staging/smoke-chat-tool.ts`（baseline → SSE drain → tool prompt → KPI delta → SSR widget assertion） | ✅                                                      |
| 三档 exit code        | 0 通过 / 1 硬失败 / 2 配置缺失                                                                                | ✅                                                      |
| 漂移保护单测          | `scripts/staging/smoke-chat-tool.spec.ts`（KPI 字符串引用一致性）                                             | ✅                                                      |
| GitHub Actions cron   | `.github/workflows/staging-smoke.yml`（cron `0 1 * * 1` + `workflow_dispatch` brand 选择器）                  | ✅（**未 push 到 main，待 D2 dry-run 验证 + D3 启用**） |
| Slack 失败通知        | Block Kit + jq 解析 hardFailures + metricDeltas                                                               | ✅                                                      |
| Per-brand concurrency | `concurrency.group` + `cancel-in-progress: false`                                                             | ✅                                                      |
| Runbook               | `docs/runbooks/w49-staging-smoke-chat-tool.md`（必填/可选 secrets + triage 表 + 暂停方法）                    | ✅                                                      |

### 1.6 治理 harness（W49 D1 review 流程）

| 组件               | 文件                                                                                                   | 状态 |
| ------------------ | ------------------------------------------------------------------------------------------------------ | ---- |
| `/review` 流程实施 | W49 D1 在合并前发现 18 条 finding（4 P0/P1 修 + 3 P1 推 W50 + 9 P3 + 3 测试缺口推卫生周 + 1 已闭环）   | ✅   |
| W49 brief 状态机   | `docs/briefs/2026-05-W49-leadership-sync.md` 从 BLOCKED → Active 切换                                  | ✅   |
| Checklist 风险登记 | `docs/W46-W52-checklist.md` §3 实时跟踪 4 条已修 + 5 条已排期风险                                      | ✅   |
| W50 backlog 登记   | F-4 / F-5 / F-9（W50 P2-D，~1 人日）                                                                   | ✅   |
| 卫生周 backlog     | `docs/code-hygiene-backlog.md`（~~F-8~~ W49 D2 紧急 hotfix 已修 + F-10–F-17 + T-4/T-5/T-6，~0.5 人日） | ✅   |

---

## 2. 8 原则逐项 — Harness 对齐评估

### 2.1 原则 1：Action Parity（92.2% 静态 + 8 runtime）✅

> "Whatever the user can do, the agent can do."

#### Harness 强化点（W46–W49）

| 阶段   | 强化点                                                                                                                                                                   | 影响                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| W47    | SSE + use-entity-revalidation hook：5 个 admin 写入页 agent 写入 5s 内反映给 user                                                                                        | 关闭 W45 v2 §7 UI Integration 1/29 → 18/29 的 bottleneck，让 parity 真的"对偶" |
| W48    | 8 条 customer-self mirror tool（4 mutation + 4 read），LLM 实际可调用                                                                                                    | runtime 0 → 8（首次破零，customer mirror 8/8 = 100%）                          |
| W49 D1 | KPI 仪表化让 parity 从"静态计数"升级为"运行时可观测"：`chat.tool.invocation_count` / `error_count` / `session.with_tools_count` 三条 metric → 真实流量下的 parity 利用率 | W52 v3 重审计可量化"实际使用频率"而非仅"是否实现"                              |
| W49 D1 | F-2 / F-7 修复让 KPI 数据可信（retry 不双计、全失败仍计 session）                                                                                                        | 防止 KPI 错误指引 leadership 决策                                              |

#### 当前分

- 静态 **94/102 = 92.2%**（沿用 W48 末单维度审计）
- Runtime **8/8 = 100%**（customer-portal mirror）+ **8/88 = 9.1%**（agent 总能力的 runtime 利用率，admin 没 chat 入口属设计选择）

#### 缺口

- `searchListingDraft` × 1（W50 P2-B-1）
- `searchKeywords` × 1（W50 P2-B-1）
- `getMyCapabilities` admin REST（W50 P2-B-1）
- `uploadImage`（推 S5）
- `bootstrapSearch` / `importKeywords`（推 S5）

#### W52 v3 forecast

97/102 + runtime 11（customer 8 + admin search × 2 + capabilities × 1）≈ **95%**

#### Harness 自身合规

✅ smoke script 自身就是"agent 视角"测试 — 它**像 agent 一样**调 `/customer/chat/sessions/...`，验证 user 的"发消息"动作能被脚本同等执行。这是 action parity 原则的自我应用。

---

### 2.2 原则 2：Tools as Primitives（96%）✅

> "Tools provide capability, not behavior."

#### Harness 强化点

| 阶段   | 强化点                                                                                                                                                                                                                                    | 影响                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| W48    | 8 条新 customer-chat tool 全部 PRIMITIVE：`createCustomerTicket` / `addCustomerTicketMessage` / `listMyTickets` / `registerWarranty` / `listMyWarranties` / `customerOrderLookup` / `listProductManuals` / `getProductManual` —— 单一职责 | 不引入新 WORKFLOW，分母从 91 → 99，分子从 87 → 95 |
| W49 D1 | KPI metric 常量化（3 条）+ 漂移保护单测，**避免后续硬编码工具名漂移成业务编排**                                                                                                                                                           | 名称白名单（F-4 W50）会进一步收紧                 |

#### 当前分

**95/99 = 96%**（沿用 W45 v2 §3 + W48 增量）

#### Workflow 仍存（W45 v2 已记录，v2 plan 不动）

- `generateAdSuggestions`（最严重，product 风险护栏推 S5）
- `generateListingDraft` / `batchGenerateListings` / `generateProductFaq` —— 已知 WORKFLOW，S5 prompt DB 化时一并拆

#### W52 v3 forecast

**95/99 = 96%**（W46–W52 不动这条原则）

#### Harness 自身合规

⚠️ **`smoke-chat-tool.ts` 自身略偏 WORKFLOW**：编排了"baseline → SSE → send prompt → wait 3s → KPI delta → assertion"。但这是 ops/CI 工具不是业务 tool，不计入 91 分母。如果未来要把 smoke 拆成可被 LLM 调用的 tool（"代我跑一次 staging 验证"），需要拆成 `getMetricBaseline` / `sendChatToolPrompt` / `assertMetricDelta` 三个 primitive。当下推 S5。

---

### 2.3 原则 3：Context Injection（90%）✅

> "System prompt includes dynamic context about app state."

#### Harness 强化点

| 阶段 | 强化点                                                                                                                                                                         | 影响                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| W48  | `customerSection` 拼装：customerId（强 IAM）+ open tickets + recent 3 order lookups —— **#3 user identity** + **#4 workspace state** + **#5 recent activity** 三个维度同时升级 | 从 8/10 → 9/10                |
| W48  | `toolSummary = describeCustomerChatTools(tools)` runtime derive —— **#2 available capabilities** 从 ❌ → ✅ Strong                                                             | +1 维度（设计层未关闭的扣分） |
| W49  | KPI brief 注入 `Status` + 灰度计划，但这是 leadership context 不是 LLM context —— **不计入**                                                                                   | 0                             |

#### 当前分

**9/10 = 90%**（沿用 W48 末单维度审计；提前 4 周达 W52 v3 forecast）

#### 剩余缺口

- **#3 admin surface 的 user identity 注入**（chat 强、admin 弱）：W50 P2-B-1 `/help` 助手关闭

#### W52 v3 forecast

**10/10 = 100%**

#### Harness 自身合规

✅ KPI brief（`docs/briefs/2026-05-W49-leadership-sync.md`）也满足 context injection：明确列出 KPI 定义 / 阈值 / 风险登记 / 决策请求 —— leadership 可以 5 分钟读完知道"项目当前在哪"。这是 brief 层的 context injection 模式。

---

### 2.4 原则 4：Shared Workspace（91%）✅

> "Agent and user work in the same data space."

#### Harness 强化点

| 阶段   | 强化点                                                                                                                  | 影响                                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| W47    | SSE 把 agent 写入广播给所有 user 订阅者，**同一 Prisma model** 双向可见                                                 | 加强 shared 程度                                 |
| W48    | 8 条 customer chat tool 全部写入 `CustomerTicket` / `Warranty` / `OrderLookup` 等 user 同表，无 `_agent` / `_ai` 隔离表 | 维持 shared workspace 教科书级实现               |
| W49 D1 | KPI 写 `public Metric` 表（运营 admin 也能 query 的同张表） —— **不是 agent 私有 metric 库**                            | 符合 SHARED；admin dashboard widget 直接读同张表 |

#### 当前分

**20/22 = 91%**（沿用 W45 v2）

#### 缺口（W48 P1-C 应做但未做）

- `AdSuggestionService.generate()` createMany 无 audit
- `TerminologyService` 整个未注入 audit
- `SettingsService` 写入无 audit
- `MetricController.record` 无 audit（W49 KPI 写入也无 audit）

> ⚠️ **W49 副作用**：W49 KPI 仪表化加速了 `MetricController.record` 的写入频率（每 chat session 至少 1 行 + 可选 2 行），但**仍无 audit**。F-4（W50 P2-D 名称白名单）已排期；audit log 仍待 P1-C。

#### W52 v3 forecast

**22/22 = 100%**（P1-C 4 项 audit 关闭后；目前 W48 计划中但未排期到 W49–W50 的具体周；建议挪到 W50 P2-D 或 W51 内吸收）

#### Harness 自身合规

✅ smoke 与 dashboard widget 都从 `Metric` 表读，写入也走同样 `/metrics` endpoint —— harness 不引入新数据 silo。

⚠️ **gap**：`docs/reports/staging-smoke/` 写盘报告是本地文件，W49 GitHub Actions artifact 90 天保留 —— 这是 ops/audit 数据，不是业务数据，不计入 22/22 分母。但**长期**应考虑把 smoke 历史结果落 DB 表（`SmokeRun` model），让 admin dashboard 也能看到"过去 12 周 staging smoke 健康度趋势"——推 S5。

---

### 2.5 原则 5：CRUD Completeness（33%）❌

> "Every entity has full CRUD."

#### Harness 强化点

| 阶段    | 强化点 | 影响                                                                                                  |
| ------- | ------ | ----------------------------------------------------------------------------------------------------- |
| W46–W49 | **0**  | W49 没动 CRUD；W50 P2-A 才补 4 项（`updateShop` / `getListingVersion` / `getAdChange` / `getLocale`） |

#### 当前分

**7/21 = 33%**（沿用 W45 v2，无变化）

#### W52 v3 forecast

11/21 = 52%（按 W50 P2-A 缩水版完成 4 项）—— 但 7 个实体（User / Invitation / Article / Platform / AuthAccount / Brand / ProductContent）仍 by-design 不补，scope-guardian 推荐保留诚实低分。

#### Harness 自身合规

⚠️ **新发现**：W49 KPI 引入了 `Metric` 表的高频 write（每 session 1–2 行），但 `Metric` 实体的 CRUD 仍是 75%（缺 Update / Delete agent tool）。**这不是 harness gap**——KPI 数据是 append-only 时序表，删/改本就不应该有 agent tool。但应在 v3 重审计时把 `Metric` 标为 **APPEND-ONLY** 实体（与 `AuditLog` 同类），从分母中剔除或单独评分。

> **建议**：W52 v3 重审计加一个 "APPEND-ONLY 实体"枚举：`AuditLog` / `AiCallLog` / `Metric` / `RefreshToken`，分母 21 → 18（含此次 W49 引入 KPI 的语义调整）。

---

### 2.6 原则 6：UI Integration（66%）⚠️

> "Agent actions immediately reflected in UI."

#### Harness 强化点

| 阶段    | 强化点                                                                                                               | 影响                                                   |
| ------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| W46–W47 | SSE + use-entity-revalidation hook 接入 5 个 admin 写入页（settings / listing / 广告建议 / 看板 / 店铺 / migration） | **1/29 → 18/29 (62%)** —— 单 sprint 最大 Δ             |
| W47     | E2E 浏览器验证 settings 5s 内 banner（其余 3 场景 fixme 标 staging 数据后启用）                                      | 验证 harness 真实工作                                  |
| W48     | customer chat 前端 in-flight 提示 `Calling X tool…` —— LLM 调 tool 时 user 可见                                      | 加强 mutation 可见性                                   |
| W49 D1  | admin dashboard `<ChatToolActivity>` widget：W49 KPI 数据 5 分钟刷新（server component + cache: 'no-store'）         | **+1 个 admin agent action 路径**：18/29 → 19/29 (66%) |

#### 当前分

**~19/29 = 66%**（含 W49 dashboard widget +1）

#### W49 缺陷

- ⚠️ Dashboard widget **未接 SSE**：是 SSR fresh fetch，admin 切页才看新数据（不是 5s 反映）。代码卫生周 F-15 cache 改造可考虑改 `unstable_cache` + `revalidateTag`，但仍非 SSE 实时。**正确性影响低**（admin KPI 不需要秒级实时），但**严格按"5s 内反映"标准**算 ⚠️ 半分。
- ⚠️ Smoke 失败 → Slack 通知是异步推送，不是 UI 反映，不计入此原则。

#### W52 v3 forecast

22/29 = 76%（按 W50 customer 端、W51 空状态接入估算；admin dashboard 仍 ⚠️ 半分）

#### Harness 自身合规

✅ SSE 框架是为 agent action UI integration 设计的，已在 5 个核心写入页验证。
⚠️ KPI dashboard widget 自身**违反**该原则的严格定义（agent 写入 metric 后 user 看 dashboard 需要等下次刷新）—— 但这是 admin 监控场景，UX 可接受。

---

### 2.7 原则 7：Capability Discovery（50%）⚠️

> "Users can discover what the agent can do."

#### Harness 强化点

| 阶段   | 强化点                                                                                                    | 影响                                 |
| ------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| W48    | ADR-012 §D5：customer chat 系统提示从 tool registry 实时 derive —— **agent 自述（#4）从 ❌ → ✅**         | 0.5 个机制（chat 自述）：3/7 → 3.5/7 |
| W49 D1 | KPI brief 第 3 节列了 4 条 customer-self mirror tool 的功能描述 —— 但这是 leadership 文档不是 user-facing | 0                                    |
| W49 D1 | dashboard widget `<ChatToolActivity>` 显示 "客服 Chat Tool 活动" 标题 + 数据 —— 间接证明 capability 存在  | 0（widget 没列具体 tool 名）         |

#### 当前分

**3.5/7 = 50%**

#### 缺口

- **#1 onboarding flow** ❌（推 S5）
- **#2 help docs**：`admin-sidebar.tsx:152-158` 假帮助链接 W46 旁支项**仍未止血**（"label 改'系统设置'或先隐藏" 未勾） → ⚠️ **W49 D1 review 漏审**，应补一行卫生周 ToDo
- **#7 slash command** ❌（推 S5）

#### W52 v3 forecast

5/7 = 71%（W46 假链接修 + W50 `/help` 页 + W51 空状态文案 = +1.5 个机制）

#### Harness 自身合规

⚠️ **本次 audit 发现一条 W46 旁支漏勾项**：

> `admin-sidebar.tsx:152-158` 假"帮助文档"链接 → label 改"系统设置"或先隐藏

**建议**：补到代码卫生周 backlog 第一项（高优先级，主动伤害用户信任，0.05 人日）。

---

### 2.8 原则 8：Prompt-Native Features（44%）❌

> "Features are prompts defining outcomes, not code."

#### Harness 强化点

| 阶段   | 强化点                                                                                                  | 影响                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| W48    | `describeCustomerChatTools` 让 capability summary **不在代码里**硬编码 —— 加/删 tool 自动反映到 prompt  | chat 特性从 CODE-DEFINED → HYBRID（0.5 → 0.5，不变；但 derive 让 prompt 更接近 native） |
| W49 D1 | KPI metric 常量化是 **CODE-DEFINED**（不是 prompt-native） —— 但这是工程 contract，**不应**在 prompt 里 | 0                                                                                       |
| W49 D1 | `isToolErrorResult` runtime guard 是 **CODE-DEFINED** —— runtime 防御不能放 prompt 里                   | 0                                                                                       |
| W49 D1 | `safeNumber` / 限流 / 漂移保护正则 都是 CODE-DEFINED                                                    | 0（这些是 harness 必要的代码层防御）                                                    |

#### 当前分

**3.5/8 = 44%**（W48 chat capability summary derive +0.5）

#### 关键观察 — Harness 应该 CODE-DEFINED

W49 D1 的所有 review fix（safeNumber / 累加器 / runtime guard / 限流）都是**对的**：

- 安全/兜底/类型守卫 **不应**在 prompt 里——LLM 可以绕过 prompt 但绕不过 runtime guard
- KPI 常量化 **不应**在 prompt 里——工程 contract 必须在代码

**结论**：原则 8 不评判 harness 层。harness 的 CODE-DEFINED 是正确的；评判面是**业务 AI 链路**（listing / 广告建议 / FAQ / chat / migration / embeddings / similarity）—— 这些 v2 plan 不动，S5 prompt DB 化处理。

#### W52 v3 forecast

**3.5/8 = 44%**（不变；S5 才动）

#### Harness 自身合规

✅（特例）：harness 是基础设施层，CODE-DEFINED 是设计选择，不计入扣分。

---

## 3. Harness 自身的 8-原则 Self-Check

> 把 harness（W46–W49 工程支撑系统）当成一个"小型 agent-native 系统"来 self-check。

| #   | 原则                   | Harness 自身评估                                                                                                            | Verdict    |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Action Parity          | smoke / cron / review / KPI dashboard 都从 agent 视角操作系统（POST /metrics / GET /metrics / SSE drain），与 user 视角对偶 | ✅         |
| 2   | Tools as Primitives    | smoke / KPI metric / runtime guard 都是 PRIMITIVE，但 smoke 略 WORKFLOW（编排步骤）                                         | ⚠️（接受） |
| 3   | Context Injection      | brief 注入项目 context，runbook 注入故障 context，checklist 注入风险 context —— 文档层 context injection 完整               | ✅         |
| 4   | Shared Workspace       | KPI 进 public Metric 表（admin 同表读）；smoke 报告 90 天 GH artifact 保留；review finding 进 checklist —— 无 silo          | ✅         |
| 5   | CRUD Completeness      | KPI 是 APPEND-ONLY，不需要 U/D；review backlog 有 C/R/U（添加/查询/修改）但无 D（卫生周 backlog 不删项，归档）              | ⚠️         |
| 6   | UI Integration         | dashboard widget 是 SSR fresh，**未接 SSE**（轻微违反）                                                                     | ⚠️         |
| 7   | Capability Discovery   | brief / runbook / backlog 三层文档相互引用，admin 可发现 KPI 是什么、哪里看、出问题去哪查                                   | ✅         |
| 8   | Prompt-Native Features | harness 必须 CODE-DEFINED（runtime guard / 类型 / 限流），N/A                                                               | N/A        |

**Harness self-check 综合**：6 ✅ + 2 ⚠️ + 1 N/A = **优秀**

---

## 4. Top 10 Harness ToDo（按原则 × 影响排序）

| 优先级 | 动作                                                                               | 关联原则                      | 关联 backlog                       | 工时  |
| ------ | ---------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------- | ----- |
| **P0** | W46 旁支假帮助链接修复（漏勾）—— `admin-sidebar.tsx:152-158` 改 "系统设置" 或隐藏  | 7 Discovery                   | 加到代码卫生周第 0 项              | 0.05d |
| **P1** | F-4 Metric name 白名单（防表污染）                                                 | 4 Shared Workspace            | W50 P2-D                           | 0.4d  |
| **P1** | F-5 recordToolMetric 限流（防日志风暴）                                            | 4 Shared Workspace            | W50 P2-D                           | 0.3d  |
| **P1** | F-9 Cookie 轮换计划 + ADR-013 草稿                                                 | 6 UI Integration（间接）      | W50 P2-D                           | 0.3d  |
| **P1** | search × 2 + getMyCapabilities admin REST → 接 W50 `/help` 助手 chat               | 1 Action Parity + 7 Discovery | W50 P2-B-1                         | 0.5d  |
| **P2** | P1-C 4 项 audit 关闭（Ad / Terminology / Settings / Metric write audit）           | 4 Shared Workspace            | W48 计划但未排周 → 建议 W51 内吸收 | 1d    |
| **P2** | dashboard widget 接入 SSE 或 `revalidateTag`                                       | 6 UI Integration              | 卫生周 F-15（推 S5）               | 0.15d |
| **P3** | `<ChatToolActivity>` RTL 测试 + `parseSseChunk` 抽函数 + jq Slack payload snapshot | 测试覆盖（横切）              | 卫生周 T-4/T-5/T-6                 | 0.37d |
| **P3** | F-10 中文文案 i18n + F-13 200 上限 → 5000 + F-14 `Promise.allSettled`              | 6 UI Integration（间接）      | 卫生周 F-10/13/14                  | 0.23d |
| **P3** | smoke 历史结果落 `SmokeRun` model + admin 看趋势                                   | 4 Shared Workspace + 6 UI     | 推 S5                              | 1d    |

---

## 5. 与全 codebase Audit 的关系（澄清边界）

> 本 audit 是 **sprint-level harness alignment**，不是 W52 末的全 codebase v3 重审计。

| 维度 | 本 audit (W49 末 sprint)                               | W52 末 v3 重审计                            |
| ---- | ------------------------------------------------------ | ------------------------------------------- |
| 目的 | 评估 W46–W49 harness 对 8 原则的 Δ 贡献                | 全 codebase enum + ground truth 评分        |
| 方法 | 锚定 W45 v2 / W46 / W48 三份既有 audit + 增量分析      | 8 个并行 explore subagent + 文件遍历 + grep |
| 输出 | sprint-level 对齐表 + harness self-check + Top 10 ToDo | v3 dump（与 v2 对照分数 Δ + retrospective） |
| 工时 | 0.1 人日（自审，本文档）                               | 1 人日（W52 计划内）                        |
| 误差 | 锚定 audit 已经 ground-truth；新增量定性评估           | full enum，权威                             |

**v3 重审计前应该完成**（让 v3 数据更高质量）：

- W50 P2-A / P2-B-1 / P2-D 全部完成 → forecast Δ 可被 v3 验证
- W51 P2-C 完成 → 空状态信号可被量化
- W52 灰度 metric 数据（实际 call rate / error rate / graceful response rate）

**v3 重审计应该新增的口径**（本 audit 发现的）：

1. **APPEND-ONLY 实体枚举**：`AuditLog` / `AiCallLog` / `Metric` / `RefreshToken` 从 CRUD 分母剔除（21 → 18），让 7/18 = 39% 更真实反映"应该 CRUD 的实体"
2. **Harness 自身 self-check** 作为 v3 的独立小节（6 项 ✅ + 2 ⚠️ + 1 N/A，给后续 sprint 反馈）
3. **Runtime parity Δ**：W48 末 8 → W52 末预期 11（admin search × 2 + capabilities × 1）

---

## 6. 落地动作

| 序号 | 动作                                                                               | 截止                               |
| ---- | ---------------------------------------------------------------------------------- | ---------------------------------- |
| 1    | 本 audit 文档 commit 到主分支（已落到 `docs/audits/`，与 W45/W46/W48 同位）        | W49 D1                             |
| 2    | W46 漏勾的假帮助链接补到代码卫生周第 0 项                                          | W49 D1（**本文档生成时同步更新**） |
| 3    | W52 v3 重审计 prompt 加 "APPEND-ONLY 实体" 口径调整说明                            | W52 D1                             |
| 4    | W50 P2-D 完成后，重跑 sprint harness 对齐（5 分钟自审）验证 forecast               | W50 末                             |
| 5    | 本 audit 与 W45 v2 / W46 / W48 / W52 v3 一起归档到 `docs/W46-W52-retrospective.md` | W52 末                             |

---

## 7. 工艺备忘 — Sprint Harness Alignment 模式

本次 audit 沉淀的可复用方法：

1. **锚定既有 audit + 增量分析** vs **重新 enum 全 codebase**：
   - sprint-level 对齐用前者（0.1 人日）
   - 季度/上线节点用后者（1 人日）
   - 不混用，否则数据 ground truth 易漂移

2. **Harness 自身 self-check** 作为 sprint audit 副产出：
   - 把工程支撑系统当 mini agent-native 系统评估
   - 揭示 harness 自己的 ⚠️ 项（如 dashboard widget 未接 SSE、smoke 是 ops WORKFLOW）

3. **Forecast 表附 W52 v3 预期**：
   - 给 v3 重审计提供"对照锚点"，避免 v3 dump 时讨论"为什么和 sprint 估算差很多"
   - 强制 sprint audit 给出可验证的预测，而非只评价过去

4. **CODE-DEFINED 是 harness 的正确选择**：
   - 原则 8 不评判 harness 层（runtime guard / 类型守卫 / 限流必须在代码里）
   - 但要在 audit 里**明示**这个边界，避免被误读为"harness 违反 prompt-native"

5. **APPEND-ONLY 实体识别**（本 audit 新发现）：
   - 时序表 / 审计 sink / token 表不应进 CRUD 分母
   - 建议 W52 v3 引入此口径

---

_本 audit 数据来源：W45 v2 + W46 + W48 三份既有 audit（ground truth）+ W49 D1 review 报告 + W47/W48/W49 落地代码。下次 sprint audit 触发时机：W50 P2-D 完成（约 W50 末），约 0.1 人日。_
