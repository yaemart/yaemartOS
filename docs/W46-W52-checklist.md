# W46–W52 Agent-Native v2 落地清单 + §9 容量对账

> **目的**：把 [v2 scope-cut plan](./plans/2026-05-04-004-agent-native-improvements-v2-plan.md) 拆到周/任务粒度，与 [implementation plan §9 S4](./yaemartOS-implementation-plan.md) 业务带做容量对账与协调
> **生成日期**：2026-05-04（W45 末）
> **维护方式**：逐周勾选；W52 末归档为 `docs/W46-W52-retrospective.md`

---

## 0. 容量对账（核心硬约束）

### 数学

| 维度                   | 数值                                                                     |
| ---------------------- | ------------------------------------------------------------------------ |
| 团队                   | 1 名前端 + 1 名后端（核心）                                              |
| 周期                   | W46–W52 = 7 周 = 35 工作日/人                                            |
| 周有效产能             | 5 工作日 × 50% 折扣（会议 / review / 上下文切换 / 故障）= 2.5 人日/人/周 |
| **7 周双人总有效产能** | **35 人日**                                                              |

### 占用分配

| 计划                                                                 | 估算工时          | 来源                           |
| -------------------------------------------------------------------- | ----------------- | ------------------------------ |
| §9 S4 业务带（dayparting + 多仓 + NetSuite + FBA + 采购 + 上线演示） | ~22 人日          | implementation-plan §9 W46–W52 |
| 本计划 v2 scope-cut                                                  | **14.25 人日**    | v2 plan §2                     |
| **小计**                                                             | **36.25 人日**    |
| 与产能差额                                                           | **+1.25 人日 超** | 红线，无 buffer                |

### 缓解（任一触发即可让出本计划工时）

- [ ] **W46 day 1 P0-pre ADR 评审通过** → 不通过则本计划自动顺延 ≥ 2 人日给 §9
- [ ] **W51 末 P2-C 埋点 4 周报告** → 信号不足则砍 P3 onboarding（额外 2 人日，但 P3 本就在 S5）
- [ ] **任意周 §9 owner 上报阻塞** → 优先暂停本计划该周项

### 与 §9 owner 对账（W45 末完成）

- [ ] 本清单已发给 §9 业务带 owner（dayparting 负责人 / 供应链负责人 / NetSuite 对接人）
- [ ] §9 owner 已接受 36.25 人日略超 35 的硬约束
  - [ ] 接受方案：A. owner 以 §9 实际剩余产能反馈→双方调整；B. 同意，按计划走，遇阻断时 v2 计划让位
  - [ ] 选择：**\_\_\_\_**
- [ ] 本清单已 sync 到团队 channel（avoiding silent slip）

---

## 1. 周次交付清单

### W46（5/9–5/13）

#### Day 1 — P0-pre 前置（gate）

- [ ] **审计 v2 dump 完成**：`docs/audits/2026-05-W45-agent-native-audit-v2.md` ✅（已完成 2026-05-04）
- [ ] **ADR 通过**：`docs/adr/ADR-011-realtime-sync-strategy.md`（4 项决策签字）
- [ ] **容量对账完成**：本清单 §0 「与 §9 owner 对账」全部勾选
- [ ] **如以上任一未通过 → P0-A 顺延，整周计划重排**

#### P0-A：SSE + TanStack Query 框架（W46 day 2–4，3 人日）

- [ ] `cookie-parser` 中间件加到 `apps/api/src/main.ts`
- [ ] `JwtAuthGuard` 加 cookie 抽取分支 + 单测
- [ ] `auth.controller.ts` 登录响应 setCookie（`ya_sid`，HttpOnly）
- [ ] 新建 `apps/api/src/realtime/realtime-bus.service.ts`（Redis pub/sub）+ 单测
- [ ] 新建 `apps/api/src/realtime/realtime-sse.controller.ts`（`@Sse('/sse/inbox')` + Casbin brandId 过滤）+ E2E
- [ ] `RealtimeModule` 注册到 `AppModule`
- [ ] `feature_flag.AGENT_NATIVE_REALTIME_UI` 默认值写入 `apps/api/prisma/seed.ts`
- [ ] `apps/web` `pnpm install @tanstack/react-query` + `QueryProvider` 挂载
- [ ] 实现 `apps/web/lib/realtime/use-entity-revalidation.ts` hook + 双 mode（auto / toast）+ 单测
- [ ] **K8s ingress spike**：验证 `Content-Type: text/event-stream` 与 `X-Accel-Buffering: no` 工作；如失败启动 fallback 5s 短轮询设计

#### P0-B：Listing 编辑器实时刷新（W46 day 5，1 人日）

- [ ] `listing-editor-shell.tsx` 接 `useEntityRevalidation('listing', { mode: 'toast' })`
- [ ] Listing 编辑器版本列表加"激活"按钮 + Radix `AlertDialog`，调用 `activateVersion`
- [ ] `content-editor.tsx` 的 `AiHintBubble` 死链 `onAction={() => {}}` 移除或接生成回调

#### P0-C：广告建议 + 看板实时刷新（W46 day 5，1 人日）

> **§9 协调**：W46 dayparting 也改 `ad-dashboard-client.tsx` → 串行 PR：先 dayparting 后 P0-C

- [ ] `suggestion-list-client.tsx` 接 `useEntityRevalidation('ad-suggestion', { mode: 'auto' })`
- [ ] `change-history-client.tsx` 接 `useEntityRevalidation('ad-change', { mode: 'auto' })`
- [ ] `ad-dashboard-client.tsx` 接 `useEntityRevalidation('ad-daily-stat', { mode: 'auto' })`

#### W46 旁支（任意 0.5 人日窗口）

- [ ] `admin-sidebar.tsx:152-158` 假"帮助文档"链接 → label 改"系统设置"或先隐藏

**W46 总计**：3 + 1 + 1 + 0.5 = **5.5 人日** ✅（双人 5 人日产能内）

---

### W47（5/16–5/20）

#### P0-D：Shop / Settings / Migration 跟进（1.5 人日）

- [x] `ShopBindingList` 接 `useEntityRevalidation('shop-binding', { mode: 'toast' })`（实际接入点：`shops-page-client.tsx`，因 list 数据由父组件拉取；banner + 「刷新」按钮调用 `load()`）
- [x] Settings 三面板接 `useEntityRevalidation('system-config', { mode: 'toast' })`：在父级 `settings-tabs.tsx` 顶层 mount，`acceptPending()` 触发 `router.refresh()` + `panelEpoch++` 作为 panel `key` 强制重读 server props
- [x] `import-job-progress.tsx` 现有 3s `setInterval` 替换为 SSE（保留 8s 轮询 fallback）
- [x] 迁移页"最近任务"表抽到客户端组件 `recent-jobs-table.tsx` + 接 SSE（`mode: 'auto'`，5s 自动消失 ribbon）

#### P0-E：联调验收（0.5 人日）

- [x] Playwright SSE helper：`tests/e2e/helpers/sse.ts`，含 `loginAsHomtoneAdmin` / `subscribeSse(url, { cookie, brand? })` / `enableRealtimeFlag` / `disableRealtimeFlag`，自带 `waitFor(predicate, timeoutMs)` + `collect(timeoutMs)` API（cookie 自动从 `/auth/login` 的 `set-cookie` 解析为 `Cookie:` 头）
- [x] **API-only E2E 套件落地** `tests/e2e/w47-realtime-sse.spec.ts`（6 tests，所有 helper 集成验证均在内）：
  - [x] 未登录 GET `/realtime/inbox` → 401
  - [x] 跨 brand 隔离断言（A brand token + `?brand=B` → 403；同 token 收 B brand 事件 = 0 条）
  - [x] feature flag off → 403 Forbidden（FeatureFlagGuard）
  - [x] 登录订阅 + 触发 `settings.upsert(brand-scoped)` → 5s 内收到 `system-config` 事件，`brandId / ids / entity` 全部对齐
  - [x] heartbeat keep-alive 通过（25s 间隔，30s 窗口断言；P0 只需证明 keep-alive 工作，30 分钟版本由 staging 长跑监控承担）
- [x] **浏览器 toast 联调**（W47 day 2 已收尾）：
  - [x] `tests/e2e/helpers/sse.ts:applySessionToContext()`：同时灌入 BFF `ym_*` cookie（`127.0.0.1:3000`）+ NestJS `ya_sid` cookie（`127.0.0.1:4000`），让 admin 页面 SSR 通过 + 浏览器侧 SSE handshake 通过
  - [x] **代表性浏览器 E2E** `tests/e2e/w47-realtime-toast.spec.ts:settings page surfaces banner within 5s of upsert and clears on apply`：登录 → applySessionToContext → goto `/en/settings` → waitForRequest `/realtime/inbox` → `settings.upsert(probeKey)` → 断言「已修改系统配置」5s 内可见 → 点击「应用」→ banner 2s 内消失
  - [x] listing 编辑器 / 广告建议 / 店铺绑定 3 个浏览器场景仍以 `test.fixme()` 形式保留（acceptance + staging 数据前置条件已写入 docstring，转 W48 staging 真实数据落地后启用）。理由：相同 `useEntityRevalidation` hook 已被 unit test (`use-entity-revalidation.spec.tsx`) + settings 浏览器 E2E 完整覆盖；listing/ad/shop 仅 entity 名 + 文案不同，浏览器集成本质问题已被新测试证明

#### W47 灰度

- [x] **staging 单 brand（homtone）开启 flag**：`apps/api/prisma/seed.ts` 重构为 env-var 驱动 — `YAEMART_SEED_REALTIME_UI_BRANDS=homtone pnpm seed` 在 staging 部署时把 `feature_flag.AGENT_NATIVE_REALTIME_UI.homtone = true` 种好，其他 brand 保持 false；dev / prod seed 无 env 时全 brand 默认 false（保持 SSE E2E 的 403 baseline 不破）

**W47 总计**：1.5 + 0.5 = **2 人日** ✅（仍有 §9 dayparting 收尾产能）

---

### W48（5/23–5/27）

#### P1-B-mod-v2：customer chat 接入 Vercel AI tool calling 子集（2 人日）

> **scope 调整 by W46 末单项审计**：原 `P1-B-mod`「MCP 工具自述模块」60% 已由 `GET /ai/mcp/tools` 落地，剩余「前端展示能力」并入 W50 `P2-B-1` `/help` 页面。腾出的 2 人日改投到[**runtime tool calling = 0**] 这条更高 ROI 的债。详见 [`docs/audits/2026-05-W46-action-parity-single-audit.md`](./audits/2026-05-W46-action-parity-single-audit.md) §4 / §5。
>
> **目标**：让 customer-portal chat 真的能"代客户做事"，而不是只能聊天。

- [x] 选定 8 条核心客服 tool（admin → customer-self mirror）：
  - [x] `createCustomerTicket` / `addCustomerTicketMessage` / `listMyTickets`
  - [x] `registerWarranty` / `listMyWarranties`
  - [x] `customerOrderLookup`（新增 `OrderLookupService.lookupForChatTool(customerId, orderNumber)` 跳过 CAPTCHA，强制 customerId）
  - [x] `listProductManuals` / `getProductManual`
- [x] 新增 `apps/api/src/customer-portal/chat/customer-chat-tools.ts`：8 条 Vercel AI `tool({ description, parameters: zod, execute })` 实例 + 14 个单测（IAM lock、错误分类、ctx.customerId 锁定、describeCustomerChatTools 渲染）
- [x] `customer-portal/chat/chat.service.ts:streamText({ ... })` 注入 `tools` + `maxSteps: 3` + `onStepFinish` 把 tool 调用 lifecycle 推到 SSE channel
- [x] system prompt 注入精简能力 summary（**runtime derive** 自 `describeCustomerChatTools(tools)`，不硬编码——加 / 删 tool 不需要改 prompt，避免漂移；ADR-012 §D5）
- [x] 新增 feature flag `AGENT_NATIVE_TOOL_CALLING`（独立于 `AGENT_NATIVE_REALTIME_UI`：`chat.service` 内 `featureFlag.isEnabled(TOOL_CALLING_FLAG, { brand: brandId })`，flag off 时 `streamText` 不传 `tools` 字段，行为完全等价于 W47 末状态——单独灰度回滚 OK）
- [x] ADR [`docs/adr/ADR-012-customer-chat-tool-calling.md`](./adr/ADR-012-customer-chat-tool-calling.md)（6 个决策：D1 tool 子集、D2 IAM 在 execute 内、D3 错误回灌结构化、D4 flag 独立、D5 prompt summary derive、D6 OrderLookup 绕 CAPTCHA）
- [x] `apps/portal/components/chat/chat-window.tsx`（前端）：SSE message 多解 `toolCall: { name, status }`，`activeTools` state 跟踪 in-flight tools，渲染「正在调用 listMyTickets…」气泡（`aria-live="polite"`）；done / escalated 时清空

> 原 P1-B-mod 已落地部分（`GET /ai/mcp/tools`、`AiRateLimitGuard`、IAM 过滤）保留，不重做。
> 原"前端展示能力"卡片由 W50 `P2-B-1` `/help` 页面承接（本就在计划中，零增量工时）。

#### P1-C：审计覆盖补齐（1 人日）

- [ ] `AdSuggestionService.generate()` `createMany` 后 `audit.logWrite('ad_suggestion.batch_generate', {...})` + 单测
- [ ] `TerminologyService` 注入 `AuditService` 对 4 个写路径（create/update/delete/import）写 audit + 单测
- [ ] `SettingsService` feature flag / AI routing / brand theme 写入加 audit + 单测
- [ ] `MetricController.record` 加 `JwtAuthGuard` + audit + 单测

**W48 总计**：2 + 1 = **3 人日** ✅

---

### W49（5/30–6/3）

#### P1-D：搜索 / web client 补齐（0.75 人日）

- [ ] `bootstrapSearchIndex` 工具描述符 + `SearchController` admin-only Casbin policy + 单测
- [ ] `importSearchKeywords` 工具描述符 + 输入 XSS sanitize + 单测
- [ ] `ad-dashboard-client.ts` 暴露 `triggerSync()`
- [ ] `ai-mcp-client.ts` 修齐 `keywordSuggestions` / `inventoryQuery` 类型与 controller body 一致

#### P1-B-mod-v2.kpi：W49 leadership KPI（0.5 人日）

- [x] `chat.service.ts` 注入 `PRISMA_PUBLIC_CLIENT` + `recordToolMetric` fire-and-forget helper
- [x] `onStepFinish` 打 `chat.tool.invocation_count`（每次 tool call）+ `chat.tool.error_count`（`ok: false` envelope）
- [x] streamText 收尾打 `chat.session.with_tools_count`（call rate 分母）
- [x] `chat.service.spec.ts` 加 2 条断言：metric 写入 shape + fire-and-forget 不抛
- [x] [`docs/briefs/2026-05-W49-leadership-sync.md`](./briefs/2026-05-W49-leadership-sync.md) 一页式 brief（含 KPI 定义 + go/no-go 验收 + 风险登记）

#### P1-B-mod-v2.dashboard：admin 默认看板 chat tool widget（0.5 人日）

- [x] `apps/web/lib/api/metric-client.ts` 新增 `listMetrics` + 纯函数 `aggregateChatToolKpis`
- [x] `apps/web/lib/api/metric-client.spec.ts` 5 条断言（空数据 / 24h 窗口 / per-brand 排序 / 自定义窗口 / null brandId）
- [x] `apps/web/components/dashboard/chat-tool-activity.tsx` 4 张 KPI 卡 + 按品牌切片，健康/告警颜色绑定 brief §2 阈值
- [x] `apps/web/app/[locale]/(admin)/dashboard/page.tsx` 改为 server component，并行拉 3 条 metric，API 故障降级占位
- [x] brief §6 决策点 3 标注为"已实装"

#### P1-B-mod-v2.smoke：W49 灰度首日 staging smoke（0.5 人日）

- [x] `scripts/staging/smoke-chat-tool.ts`（stand-alone TS，由 root `tsx` 跑）：
      baseline → create session → SSE drain → send tool-trigger prompt → wait 3s → diff KPI →（可选）SSR widget assertion
- [x] 硬验收：`chat.session.with_tools_count` 必须 ≥ 1（证明 tools-enabled streamText 成功结束）
- [x] 软验收：`chat.tool.invocation_count` ≥ 1（LLM 实际触发 tool）+ 仪表盘 SSR HTML 含 "客服 Chat Tool 活动"
- [x] 三档 exit code（0 通过 / 1 硬失败 / 2 配置缺失）+ 报告写盘到 `docs/reports/staging-smoke/`
- [x] `scripts/staging/smoke-chat-tool.spec.ts` 漂移保护单测：smoke 引用的 KPI 字符串必须出现在 `chat.service.ts`
- [x] 根 `package.json` `smoke:chat-tool` script + `tsx` devDep 兜底

#### P1-B-mod-v2.cron：GitHub Actions 周一晨间定时（0.5 人日）

- [x] `.github/workflows/staging-smoke.yml`：cron `0 1 * * 1`（周一 09:00 PRC / 10:00 JST）+ `workflow_dispatch` brand 选择器
- [x] Per-brand `concurrency.group` + `cancel-in-progress: false` —— 多次手动触发会排队不会互踩
- [x] `pnpm --silent run smoke:chat-tool > smoke-output.json` 捕获纯 JSON；artifact 保留 90 天
- [x] 失败时解析 hardFailures / softWarnings / metricDeltas → Slack Block Kit payload（含 run URL 按钮）
- [x] `SLACK_WEBHOOK_URL` 未设置时跳过通知不阻塞（fork 友好）；`STAGING_API_BASE` 缺失走 smoke exit 2 自然失败
- [x] [W49 staging smoke runbook](./runbooks/w49-staging-smoke-chat-tool.md)：必填/可选 secrets + `gh secret set` 命令 + 7 类常见根因 triage 表 + 暂停方法
- [x] **D2 解锁动作 — git/PR 部分**（2026-05-04 完成）：W43-W49 累积 4 PR stack 合入 main —— [#14](https://github.com/yaemart/yaemartOS/pull/14) W43-W45 ad-suggestion gate → [#15](https://github.com/yaemart/yaemartOS/pull/15) W46-W47 SSE realtime → [#16](https://github.com/yaemart/yaemartOS/pull/16) W48 chat tool calling → [#17](https://github.com/yaemart/yaemartOS/pull/17) W49 KPI/smoke/audit；CI 全绿（3m38s ~ 4m31s）；本地 main fast-forward 到 `9f35d6b`；4 个 feat/w4\* branch 全部删除；`staging-smoke.yml` 已在 main 生效；institutional learning 沉淀至 [`docs/solutions/git-workflow/2026-05-04-stack-pr-orchestration.md`](./solutions/git-workflow/2026-05-04-stack-pr-orchestration.md)
- [ ] **D2 解锁动作 — cron 真正生效**（待 GitHub Actions UI 操作）：手动 `workflow_dispatch` brand=homtone dry-run → 验证 `SLACK_WEBHOOK_URL` secret + 8 tool E2E + KPI metric 增量 → 验证通过后 D3 周三起周一 cron 自动生效

#### P1-B-mod-v2.review-fixes：W49 D1 `/review` 发现的回归修复（实际 1.0 人日）

> 本节专门回收 `/review` 在合并前发现的下游 bug，不属于新功能。

- [x] **F-1 + T-1**（实际 ≈0.4d，D1）：
  - [x] `apps/web/lib/api/metric-client.ts` `MetricRecord.value: number \| string`；`safeNumber()` helper + `sumWithin` / `bumpBrand` 强制转换；`NaN` 兜底为 0
  - [x] `scripts/staging/smoke-chat-tool.ts` `sumAllKpis` 同款 `Number()` 转换 + `Number.isFinite` 兜底
  - [x] `apps/web/lib/api/metric-client.spec.ts` 新增 3 条 F-1 回归测试（纯 string / 混合数值 / malformed 兜底），8/8 通过
  - [x] 端到端模拟 wire JSON 通过：`invocations = 3 (number)` ✅ FIXED
- [x] **F-2 / F-7 + T-2**（实际 ≈0.4d，D1）：
  - [x] `chat.service.ts` `onStepFinish` 改用本地累加器 `pendingInvocations` / `pendingErrors`，每次 attempt reset
  - [x] retry loop 之后 flush：session 无条件写 1（**F-7** denominator 修复），invocation/error 仅 `streamError === null` 时 flush（**F-2** 双计数防护）
  - [x] 4 条新单测（spec 内 `vi.mock('ai')` 模式 + `vi.useFakeTimers({ toFake: ['setTimeout'] })` 跳过 retry backoff）：单次成功 / 首失次成不双计 / 全失败仍写 session / flag off 零写入
- [x] **F-3 + T-7**（实际 ≈0.3d，D1）：
  - [x] 新增私有 `isToolErrorResult(toolName, raw)` runtime guard：null/undefined silent 通过；非对象 / 缺 `ok` / 非 boolean → 返回 false 并 `logger.warn` 报 envelope drift
  - [x] 7 条单测：documented shape ✓ / success envelope ✓ / null/undefined silent ✓ / 非对象 warn ✓ / 缺 ok warn ✓ / 非 boolean warn ✓ / SDK drift 回归 ✓

**W49 实际净增**：约 **1.0 人日**（早于估算 1.5d，因 metric flush 改造同时修了 F-2 + F-7）

**W49 总计**：0.75 + 0.5 + 0.5 + 0.5 + 0.5 + **1.0** = **3.75 人日**

> 仍超出原计划 2.75d，但比 D1 估的 4.25d 节省 0.5d。W50 spoonlemon 二品牌灰度仍按推迟 1 周到 W51 处理（不仅仅看人日，也看 W49 staging metric 数据是否充分）。

---

### W50（6/6–6/10）

#### P2-A：核心 CRUD 缺口（1 人日，缩水版）

- [ ] `updateShop` 工具 + controller PATCH /shops/:id（name / isActive / 纠错 marketId）+ 单测
- [ ] `getListingVersion` 工具 + controller GET /listings/:listingId/versions/:versionNumber + 单测
- [ ] `getAdChange` 工具 + controller GET /ads/changes/:changeId + 单测
- [ ] `getLocale` 工具 + controller GET /locales/:id + 单测

#### P2-B-1：`/help` 页面（1 人日）

- [ ] 新建 `apps/web/app/[locale]/(admin)/help/page.tsx`
- [ ] 按模块组织（Listing / Ads / Migration / Shop / Settings）
- [ ] 调用 `/ai/capabilities` 渲染 IAM-filtered 工具列表
- [ ] i18n 接入（zh-CN / en-US）
- [ ] `admin-sidebar.tsx` 链接 → `/help`（替换 W46 临时止血）

#### P2-D：W49 `/review` P1 后续跟进（1 人日）

> 来自 W49 D1 `/review` 报告 P1 区段，本周 D1 已修 F-2/F-7/F-3 三条阻塞，剩 F-4/F-5/F-9 推到 W50（不阻塞 staging 灰度）。完整 finding 原文见 transcript-archive 或 W49 brief §5；下面是 W50 执行 ToDo。

##### F-4：`MetricController.record` `name` 白名单（~0.4 人日）

- [ ] 新建 `apps/api/src/metric/metric-name-registry.ts`：导出 `KNOWN_METRIC_NAMES = Set<string>` + `KNOWN_METRIC_PREFIXES = ['chat.tool.', 'chat.session.', 'ad.', 'system.']`
- [ ] `apps/api/src/metric/dto/record-metric.dto.ts` 加 `@IsKnownMetricName()` 自定义 class-validator decorator（命中 set 或 prefix）；reject 时 400 + `{ code: 'UNKNOWN_METRIC_NAME', allowedPrefixes }`
- [ ] `chat.service.ts` 把 `KPI_TOOL_INVOCATION` / `KPI_TOOL_ERROR` / `KPI_TOOL_SESSION` 三个常量同时写入 `KNOWN_METRIC_NAMES`，避免漂移
- [ ] `apps/api/src/metric/metric.controller.spec.ts` 加 4 条新测：白名单允许 / prefix 允许 / 未知 name reject / 未知 prefix reject
- [ ] `dashboard/page.tsx` 改 read-only 不受影响；`scripts/staging/smoke-chat-tool.ts` 维持现状（只读 `/metrics`）

##### F-5：`recordToolMetric` 失败日志限流（~0.3 人日）

- [ ] `chat.service.ts` 新增私有字段 `private metricLogWindow = { count: 0, resetAt: Date.now() + 60_000 }`，每分钟一窗口
- [ ] `recordToolMetric.catch` 改为：窗内前 3 条 `logger.warn`、第 4 条起静默；窗内 ≥ 5 条连续失败时 `logger.error('metric writes failing for >60s')` 升级（每窗口最多 1 条 error）
- [ ] `chat.service.spec.ts` 加 2 条新测：模拟 publicDb 持续 reject 100 次 → 断言 `logger.warn` 调用 ≤ 3 + `logger.error` 调用 = 1
- [ ] 验收：1k session × 3 metric × 100% 失败的 worst case → 日志条数从 3000 降到 ≤ 4 条/分钟

##### F-9：`STAGING_DASHBOARD_COOKIE` 轮换计划（~0.3 人日）

- [ ] [`docs/runbooks/w49-staging-smoke-chat-tool.md`](./runbooks/w49-staging-smoke-chat-tool.md) 新增「Cookie 轮换」章节：
  - [ ] 当前 NextAuth 默认 30 天 session expiry → 每月 1 日提醒（GH issue 模板）
  - [ ] 轮换步骤：登录 staging admin → DevTools 拷贝 `next-auth.session-token` → `gh secret set STAGING_DASHBOARD_COOKIE -R yaemartos/yaemartos`
  - [ ] 失败现象：smoke step 报 401 → triage 表新增「Cookie expired」一行（指向轮换章节）
- [ ] 评估方案 B（service token）：写一段 ~150 字 ADR 草稿到 `docs/adr/draft-ADR-013-staging-smoke-auth.md`，列出 service token vs cookie 利弊（不强制 W50 选型，给 leadership 决策）
- [ ] **不**改业务代码：本节纯 doc，避免影响 staging 灰度

**W50 总计**：1 + 1 + 1 = **3 人日** ⚠️（比原计划 2 人日多 1 人日；通过 §0 缓解机制：放弃 P2-A 中 `getLocale` / `getAdChange` 两条只读工具到 S5，可省 ~0.4d）

---

### W51（6/13–6/17）

#### P2-C：空状态 + PostHog 埋点（1 人日）

- [ ] `apps/web/components/product/product-list.tsx:8-14` 空状态加 AI CTA
- [ ] `apps/web/components/category/category-list.tsx:13-15` 空状态加 AI CTA
- [ ] `apps/web/app/[locale]/(admin)/migration/page.tsx` 最近任务空状态加 agent 触发提示
- [ ] `apps/web/app/[locale]/(admin)/ads/suggestions/suggestion-list-client.tsx:152` 空状态改写
- [ ] PostHog `empty_state_cta_click` 事件接入
- [ ] PostHog `agent_capability_invoked` 事件接入到 `ai-copilot-panel.tsx` 各 ActionButton

#### W51 灰度

- [ ] **staging 全 4 brand 开启 flag**

**W51 总计**：**1 人日** ✅

---

### W52（6/20–6/24，S4 上线 + 验收）

#### 验收

- [ ] 重跑 `/ce-agent-native-audit` 并产出 `docs/audits/2026-05-W52-agent-native-audit-v3.md`
- [ ] 验证 v3 vs v2 dump：所有 6 项分数 Δ 达预期（详见 v2 plan §10 DoD 评分指标）
- [ ] 行为型 DoD 验证：5 个高频写入页录屏证据 → agent 写入后 5s 内 toast 出现或自动刷新
- [ ] 38 名运营 W52 反馈表「未知改动→手动 refresh」事件下降 ≥ 50%（vs W45 基线）

#### 灰度

- [ ] **prod homtone 单品牌开启 flag（5 名 alpha 运营）**
- [ ] homtone 1 周（W52 + 7 天）无 P0 故障 → prod 全 4 brand 开启

#### 文档

- [ ] `docs/solutions/` 至少 1 条新条目（如 SSE keep-alive 调优经验、cookie-based JWT 抽取经验）
- [ ] 本清单归档为 `docs/W46-W52-retrospective.md`，标注实际工时 vs 估算

**W52 总计**：≤ **1 人日**（仅占用 review / dashboard 录屏 / 重审计 时间）

---

## 2. 工时小结

| 周次                                  | 计划工时  | 累计  |
| ------------------------------------- | --------- | ----- |
| W46                                   | 5.5 人日  | 5.5   |
| W47                                   | 2 人日    | 7.5   |
| W48                                   | 3 人日    | 10.5  |
| W49                                   | 3.75 人日 | 14.25 |
| W50                                   | 3 人日    | 17.25 |
| W51                                   | 1 人日    | 18.25 |
| W52                                   | 1 人日    | 19.25 |
| **代码卫生周（待排，方案 A 已采纳）** | 0.5 人日  | 19.75 |

> **原标定**：14.25（v2 plan §2）+ 1（W52 验收回收）= 15.25 人日
> **W49 净增**：+1.5 人日（admin 看板 widget +0.5 + 灰度首日 staging smoke +0.5 + GitHub Actions 周一晨间 cron +0.5）→ +1.0 人日（D1 `/review` fix F-1/F-2/F-7/F-3）= **+2.5 人日**
> **W50 净增**：+1 人日（P2-D `/review` P1 后续跟进 F-4/F-5/F-9）
> **代码卫生周**（W51 尾或 W52 前后排）：+0.5 人日（F-8 footgun + F-10–F-17 P3 + 测试缺口 T-4/T-5/T-6），明细见 [`docs/code-hygiene-backlog.md`](./code-hygiene-backlog.md)
> **现合计**：**19.75 人日** + §9 业务带 22 人日 = **41.75 人日**，相对 35 人日有效产能超 6.75 人日 → §0 缓解触发面扩大：
>
> 1. 首选放弃 W51 PostHog 埋点 P2-C（-1 人日）
> 2. 砍 W50 P2-A `getLocale` / `getAdChange` 两条只读工具（-0.4 人日）
> 3. 代码卫生周延期到 S5 W53+（-0.5 人日，不阻塞当前 sprint 业务带）
> 4. 仍紧时砍 W50 P2-A `getListingVersion`（-0.2 人日）→ 总可让出 ~2.1 人日，仍剩 ~4.65 人日缺口
> 5. 决策面：W50 末与 §9 owner 重新对账，必要时 P2-B-1 `/help` 页推后到 S5（-1 人日）

---

## 3. 关键风险跟踪

| 风险                                                                                                 | 触发标志                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 立即动作                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| W46 ingress spike 失败                                                                               | P0-A 第 3 天验证 SSE 不通                                                                                                                                                                                                                                                                                                                                                                                                                                                | 启动 5s 短轮询 fallback；保持 hook 接口不变；告知 §9 owner W47 后继续 P0                                                                                                                                                                                     |
| §9 dayparting 与 P0-C 同改 `ad-dashboard-client.tsx` 冲突                                            | W46 末 PR review 卡住                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 强制串行：先 dayparting merge，P0-C rebase                                                                                                                                                                                                                   |
| W48 P1-B-mod-v2 ADR 通不过                                                                           | ADR-012 customer-chat-tool-calling 设计评审给出 changes-requested                                                                                                                                                                                                                                                                                                                                                                                                        | P1-B-mod-v2 顺延，先做 P1-C 与 P1-D（不依赖 ADR）                                                                                                                                                                                                            |
| ~~**chat runtime tool calling = 0**~~（W46 末审计发现 → W48 ✅ 落地）                                | `customer-portal/chat/chat.service.ts:streamText` 现注入 `tools = buildCustomerChatTools(ctx)` + `maxSteps: 3`，gated by `AGENT_NATIVE_TOOL_CALLING` flag。W48 末验证 25 个单测 ✅；**W49 KPI 上线**：`chat.tool.invocation_count` / `chat.tool.error_count` / `chat.session.with_tools_count` 三条 metric 落入 public `Metric` 表，详见 [W49 brief](./briefs/2026-05-W49-leadership-sync.md)；W52 v3 重审计直接读 metric 量化 runtime 调用次数 / error rate / call rate |
| ~~**Context Injection 8/10**~~（W45 v2 audit 标定 #2 工具清单缺失 → W48 ✅ 关闭）                    | toolSummary 派生 + chat customerSection 扩容（open tickets + recent orders）→ Context Injection 提前 4 周达 9/10 (90%)，详见 [W48 Context Injection 单维度审计](./audits/2026-05-W48-context-injection-single-audit.md)                                                                                                                                                                                                                                                  |
| ~~**F-1 Decimal 数值聚合错误**~~（W49 D1 `/review` 发现 → ✅ D1 修）                                 | `metric-client.ts` `aggregateChatToolKpis` + `smoke-chat-tool.ts` `sumAllKpis` 加 `safeNumber()` 强制 `Number()` 转换；3 条新 string-fixture 测试 + 1 条 NaN 兜底测试 + 端到端 wire JSON 模拟通过                                                                                                                                                                                                                                                                        |
| ~~**F-2 retry 路径下 invocation 双计数**~~（W49 D1 `/review` 发现 → ✅ D1 修）                       | `chat.service.ts` `onStepFinish` 改用本地累加器；每次 attempt 开头 reset；retry loop 之后**仅在成功时** flush invocation/error；4 条 retry-aware 单测覆盖（单次成功 / 首失次成 / 全失败 / flag off）                                                                                                                                                                                                                                                                     |
| ~~**F-7 全失败 session 漏计**~~（W49 D1 `/review` 发现 → ✅ D1 修）                                  | F-2 修复同时实现：`KPI_TOOL_SESSION` 移出 retry loop，tools 启用即无条件写 1，全失败场景下分母仍准确                                                                                                                                                                                                                                                                                                                                                                     |
| ~~**F-3 `tr.result` 类型 cast 静默失败**~~（W49 D1 `/review` 发现 → ✅ D1 修）                       | 新增私有 `isToolErrorResult(toolName, raw)` runtime guard：null/undefined silent 通过；非对象 / 缺 `ok` 字段 / 非 boolean `ok` → 返回 false 并 `logger.warn` 报告 envelope drift；7 条单测覆盖（含 SDK drift 回归用例）                                                                                                                                                                                                                                                  |
| **F-4 Metric 表名污染攻击面**（W49 D1 `/review` P1 → 📅 W50 P2-D 排期）                              | `MetricController.record` 接收任意 `name` 字段，dashboard 易受别名漂移污染；当前 Casbin 策略允许 `metrics:write:*`                                                                                                                                                                                                                                                                                                                                                       | W50 加 `KNOWN_METRIC_NAMES` Set + `KNOWN_METRIC_PREFIXES` 白名单；DTO 校验 reject 时 400 + `UNKNOWN_METRIC_NAME`                                                                                                                                             |
| **F-5 `recordToolMetric` 失败日志风暴**（W49 D1 `/review` P1 → 📅 W50 P2-D 排期）                    | `publicDb` 短暂不可用时每 session 触发 ≥ 3 条 warn × maxSteps=3 = 9 条/session；1k 会话 → 9k warn/小时                                                                                                                                                                                                                                                                                                                                                                   | W50 加 1 分钟窗口限流（≤ 3 warn/窗口 + 1 error/窗口升级），spec 模拟 100% 失败断言日志 ≤ 4 条                                                                                                                                                                |
| **F-9 `STAGING_DASHBOARD_COOKIE` 30d 过期无轮换**（W49 D1 `/review` P1 → 📅 W50 P2-D 排期）          | NextAuth 默认 session 30 天，cron 突然 401 hard fail，runbook 无 mitigation                                                                                                                                                                                                                                                                                                                                                                                              | W50 在 runbook 加「Cookie 轮换」章节 + GH issue 月提醒；同时 ADR-013 草稿评估改 service token                                                                                                                                                                |
| **F-8 GitHub Actions `set +e` 后未恢复**（W49 D1 `/review` P2 → 📅 代码卫生周方案 A 已采纳）         | `staging-smoke.yml` smoke step 用 `set +e` 但未 `set -e` 复位；将来追加命令静默失败不会 fail 工作流                                                                                                                                                                                                                                                                                                                                                                      | 卫生周改 `if ! pnpm ... > smoke-output.json; then ec=$?; ...; fi` 模式或显式 `set -e` 复位                                                                                                                                                                   |
| **F-10–F-17 + 测试缺口 T-4**（W49 D1 `/review` P3 → 📅 代码卫生周方案 A 已采纳）                     | i18n / `__dirname` / 漂移正则 / Promise.all 一败俱败 / 200 条上限 / SSE 注释行 / Slack 兜底文案 / `<ChatToolActivity>` 无 RTL 测试                                                                                                                                                                                                                                                                                                                                       | 方案 A：必做 8 项 F + 1 项 T-4（共 0.55d），详见 [`docs/code-hygiene-backlog.md`](./code-hygiene-backlog.md)                                                                                                                                                 |
| **测试缺口 T-5 / T-6**（W49 D1 `/review` P3 → 📅 推下一次卫生周/S5）                                 | `parseSseChunk` 无单测 / GH Actions jq payload 无 CI                                                                                                                                                                                                                                                                                                                                                                                                                     | 方案 A 容量受限延后；S5 启动周做"上一 sprint 残留清扫"时一并                                                                                                                                                                                                 |
| **§0 sidebar 假帮助链接 P0**（W46 day-1 旁支漏勾，W49 D1 sprint harness audit 发现 → 📌 不等卫生周） | `admin-sidebar.tsx:152-158` 假链接指向 `/settings`，主动伤害运营 38 人对 agent-native 的信任                                                                                                                                                                                                                                                                                                                                                                             | 任何先发生的 sidebar 维护 PR 顺手修；W50 末若仍未被顺手修，单独开 5 分钟 PR；详见 [`docs/code-hygiene-backlog.md` §0](./code-hygiene-backlog.md) + [`audits/2026-05-W49-sprint-harness-alignment.md` §2.7](./audits/2026-05-W49-sprint-harness-alignment.md) |
| W51 PostHog 埋点接入卡住                                                                             | infra 拒绝新事件域名                                                                                                                                                                                                                                                                                                                                                                                                                                                     | P2-C 仅做空状态文案，埋点延后到 S5（埋点信号收集顺延 4 周）                                                                                                                                                                                                  |
| W52 v3 重审计 Overall < 70%                                                                          | 验收时分数低于预期                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 不接受"凑分数"操作；记录到 retrospective；S5 W53 做差距分析                                                                                                                                                                                                  |

---

## 4. 协调日历（与 §9 owner）

- [ ] **W45 末（5/8）**：本清单 sync + §0 容量对账签字
- [ ] **W46 中（5/11）**：与 §9 dayparting owner 同步 PR 顺序
- [x] **W48 中（5/26）**：与 §9 多仓 / NetSuite owner 确认 W48 双方边界（P1-B-mod-v2 改 `customer-portal/chat/chat.service.ts` + 新建 `customer-portal/chat/customer-chat-tools.ts` + `OrderLookupService.lookupForChatTool`；ADR-012 落地，不影响 NetSuite）
- [ ] **W50 中（6/9）**：与 §9 补货预警 owner 确认 P2-A `updateShop` 不冲突
- [ ] **W52 早（6/22）**：S4 上线演示前对齐"广告闸门 → AI 建议 → 闸门 → 执行 → 回滚 + 实时 UI 更新"全链路

---

## 5. 通过标准（W52 末归档时）

本清单可归档为 retrospective，须满足：

- [ ] §1 W46–W52 所有任务 ✅ 或 ⏸（带顺延原因）
- [ ] §0 容量对账实际数字 vs 估算落入 ±20%
- [ ] §3 风险跟踪所有触发的风险都有 mitigations 记录
- [ ] §4 4 次协调日历会议有简要纪要
- [ ] v3 重审计 dump 产出 + 评分 Δ 表（v3 vs v2）
- [ ] 行为型 DoD 录屏证据保存在共享盘
