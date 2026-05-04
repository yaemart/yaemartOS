# W49 Leadership Sync — Customer Chat Tool Calling KPIs

> **One page brief** for the W49 周会 (May 11, 2026)
> Based on [`docs/audits/2026-05-W48-action-parity-single-audit.md`](../audits/2026-05-W48-action-parity-single-audit.md)
> Author: Agent-native team · Status: ✅ **Active — `/review` fixes landed W49 D1**
> Audience: CTO + Product + Operations leads

> **W49 D1 review wrap-up (May 4, 2026)** — `/review` 在合并前发现 3 条 P0/P1 bug：
> **F-1**（Prisma Decimal wire-string 致 dashboard/smoke 数字膨胀）✅ 修
> **F-2**（重试路径 invocation 双计数）+ **F-7**（全失败 session 漏计）✅ 修
> **F-3**（`tr.result` cast 静默失败致 error_count 永久归零）✅ 修
> 三处共增 14 条单测（3 F-1 + 4 F-2/F-7 + 7 F-3 + 1 已存在的 F-1 漂移保护），跨 web + api 56/56 测试通过 + tsc clean。staging-smoke.yml 未 push 期间，cron 未误触发；准备 D2 push + 手动 workflow_dispatch 跑通后正式启用周一 cron。

---

## TL;DR

W48 末上线 8 条客户自助 chat tool（ADR-012），把 LLM **runtime tool calling 从 0 → 8**，
static parity 从 88.2% → 92.2%。下一步重点不再是"加更多 tool"，而是**用真实流量检验它能不能用**。
为此本周（W49）落地 3 条 metric，作为 staging 灰度首周的 go/no-go 依据。

---

## 1. 已交付（W47 末 → W48 末）

| Item                                                                  | Status | Reference                                                  |
| --------------------------------------------------------------------- | ------ | ---------------------------------------------------------- |
| Single-brand staging seed (`YAEMART_SEED_REALTIME_UI_BRANDS=homtone`) | ✅     | `apps/api/prisma/seed.ts`                                  |
| 8 customer-self mirror tools (`buildCustomerChatTools`)               | ✅     | `apps/api/src/customer-portal/chat/customer-chat-tools.ts` |
| Tool calling feature flag (`AGENT_NATIVE_TOOL_CALLING`)               | ✅     | ADR-012 §D4                                                |
| Frontend "Calling X tool…" indicator                                  | ✅     | `apps/portal/components/chat/chat-window.tsx`              |
| Order-lookup CAPTCHA bypass for chat-authenticated customers          | ✅     | `OrderLookupService.lookupForChatTool`                     |
| **W49 KPI instrumentation** (this brief)                              | ✅     | `chat.service.ts` `recordToolMetric()`                     |

---

## 2. 三条 KPI 与验收标准

写入 public `Metric` 表（`unit: 'count'`，按 brand 切片），fire-and-forget，
失败不阻塞 chat 流程。所有点位都有 unit test 兜底（`chat.service.spec.ts`）。

| Metric Name                     | 触发时机                                               | 用途                        | W49 末验收       |
| ------------------------------- | ------------------------------------------------------ | --------------------------- | ---------------- |
| `chat.tool.invocation_count`    | LLM 每发起一次 tool 调用（`onStepFinish.toolCalls[]`） | call rate 分子              | ≥ 1 真实记录     |
| `chat.tool.error_count`         | tool 返回 `{ ok: false }`（ADR-012 §D3）               | error rate 分子             | error_rate ≤ 30% |
| `chat.session.with_tools_count` | 每完成一次 tools-enabled streamText                    | call rate / error rate 分母 | ≥ 5 真实 session |

### 派生指标（dashboard 计算，无需新表）

- **Call rate** = `invocation_count / session_count` —— 每次 chat 平均触发多少次 tool
  - 健康区间：0.3 – 2.5（< 0.3 表示 LLM 不会用 tool；> 2.5 表示循环或滥用）
- **Error rate** = `error_count / invocation_count`
  - 健康上限：30%（超过则需查看 tool 实现 / IAM 规则）
- **Graceful response rate** _(W50 引入，需评估集人工评分)_ —— tool 失败后 LLM 是否仍给出可读回答

---

## 3. W49 灰度计划（已就位）

> ✅ **D1 review fixes done (May 4)**：F-1 / F-2 / F-7 / F-3 已修，56/56 测试通过 + tsc clean。
> D2 push `staging-smoke.yml` 到 main + 手动 workflow_dispatch 跑一次 dev smoke 验证整链路；
> D3（周三）开始周一晨间 cron 正式生效。

1. **周一（May 11）上午**：staging seed 重新跑一次 → `feature_flag.AGENT_NATIVE_REALTIME_UI.homtone = true`
2. **同时**手动开 `feature_flag.AGENT_NATIVE_TOOL_CALLING.homtone = true`（一行 SQL）
3. **周一（May 11）开服后**：smoke 自动跑（GitHub Actions cron `0 1 * * 1`，09:00 PRC）
   —— baseline → 真实 chat session → KPI delta → 仪表盘 SSR；
   硬要求 `chat.session.with_tools_count` Δ ≥ 1，软要求 `chat.tool.invocation_count` Δ ≥ 1。
   失败时 Slack `#yaemartos-incident` 自动 ping（含 hardFailures + metricDeltas 解析）。
   人工兜底：`pnpm smoke:chat-tool` 本地任意时刻可跑。完整流程见 [W49 staging smoke runbook](../runbooks/w49-staging-smoke-chat-tool.md)。
4. **周二–周五**：客服模拟 + 真实客户流量观测 metric
5. **周五（May 15）**：评估三条 metric → go/no-go 决定是否放给 spoonlemon（GitHub Actions 手动触发 `workflow_dispatch` brand=spoonlemon 即可冒烟）

### Go 标准（全部满足才放第二品牌）

- [ ] 至少 5 条真实 session 命中 tools-enabled 路径
- [ ] error_rate ≤ 30%
- [ ] 0 起 P0/P1 incident（tool 误删数据 / IAM 越权 / chat 中断）
- [ ] 无 prompt-injection 案例（LLM 假装传入 customerId 绕过校验）

### No-Go 兜底

任何 P0 出现 → 关闭 `AGENT_NATIVE_TOOL_CALLING.homtone`（保留 RealtimeUI 不动），
SSE 推送的 `toolCall` 事件自动消失，前端 "Calling X tool…" 也随之消失。

---

## 4. 还在路上的（W50 准备）

| W50 项                                                                      | 影响                                           | 当前差距       |
| --------------------------------------------------------------------------- | ---------------------------------------------- | -------------- |
| 吸收剩余 3 条 P1 tool（search × 2 + getMyCapabilities）                     | static parity → 95.1%                          | 92.2% → 97/102 |
| 引入 `chat.tool.graceful_response_rate`（评估集 5×5）                       | 量化"失败后是否优雅"                           | 缺评估集       |
| `/help` 页 admin 助手原型（**提示**：模板 + Context Injection #3 同步关闭） | capability discovery + Context Injection 10/10 | 0 / 9          |

> **意外收获**：W48 末 [Context Injection 单维度审计](../audits/2026-05-W48-context-injection-single-audit.md) 显示得分已由 8/10 → **9/10 (90%)**，提前 4 周达成 W52 v3 forecast。toolSummary 派生 + chat 系统提示词的 customerSection 扩容（open tickets / recent orders）共同关闭了 W45 v2 标定的 #2 工具清单缺失扣分项。剩余 1/10 缺口仅在 admin surface 的 user identity 注入，建议合并到 W50 `/help` 助手实现。

---

## 5. 风险登记

| 风险                                              | 监控指标                                     | 兜底                                                                                                                 |
| ------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| ~~F-1 Decimal 数值聚合错误~~ ✅ D1 已修           | dashboard widget 数字 / smoke metricDeltas   | `safeNumber()` helper + string-fixture 回归测试 ×3                                                                   |
| ~~F-2 retry 路径下 invocation 双计数~~ ✅ D1 已修 | 重试场景 call rate 异常虚高                  | retry-aware 累加器（每次 attempt reset，仅成功时 flush）+ 双计数防护测试                                             |
| ~~F-7 全失败 session 漏计~~ ✅ D1 已修            | 全失败时分母为 0                             | `KPI_TOOL_SESSION` 移出 retry loop，无条件写 1 + denominator 防护测试                                                |
| ~~F-3 `tr.result` 类型 cast 静默失败~~ ✅ D1 已修 | error_count 异常归零                         | `isToolErrorResult()` runtime guard + 7 条 envelope 形态测试（含 SDK drift 回归用例）                                |
| LLM 滥调 tool（call rate > 2.5）                  | `chat.tool.invocation_count / session_count` | `TOOL_MAX_STEPS = 3` 已上限                                                                                          |
| tool 失败率高（error rate > 30%）                 | `chat.tool.error_count / invocation_count`   | 关闭 `AGENT_NATIVE_TOOL_CALLING` flag                                                                                |
| Metric 表暴涨（每次 invocation 都写一行）         | DB row count 监控                            | F-2 修复后 invocation 改为聚合后单条（`value: N`）— 行数从 N → 1，单 session 上限 2 行；W50 仍引入 name 白名单 (F-4) |
| Chat 因 metric 写入卡住                           | P95 chat latency                             | `recordToolMetric` 是 fire-and-forget，spec 已断言；W50 加日志限流 (F-5)                                             |

---

## 6. 决策请求

1. ✅ **F-1 / F-2 / F-7 / F-3 已修**（W49 D1，56/56 测试通过 + tsc clean）—— 准备 D2 push staging-smoke.yml 到 main + 手动 workflow_dispatch dry-run，D3 周三启用 cron
2. 🤔 **讨论** W50 是否同步上线 spoonlemon —— 取决于 W49 末的 metric
3. ~~🤔 **讨论** 是否把 `chat.tool.invocation_count` 的 brand 维度暴露到 admin Lingxing 默认看板~~
   ✅ **W48 末已实装**：`apps/web/app/[locale]/(admin)/dashboard/page.tsx` 新增 `<ChatToolActivity>` 区块，
   server-side 拉 3 条 metric → `aggregateChatToolKpis()` → 4 张 KPI 卡 + 按品牌切片表。
   Pure aggregator 5/5 单测通过，Metric API 故障时降级为占位 "—" 不阻塞页面。

---

_本 brief 数据来源：W48 末 audit + chat.service KPI instrumentation；W49 staging 灰度后将刷新一次。_
