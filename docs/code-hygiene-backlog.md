# 代码卫生周 Backlog

> **目的**：收纳 W49 D1 `/review` 报告里 P2 + P3 + 测试缺口未升级到独立 sprint 的小项，集中在一次「卫生周」批量清理。
> **生成日期**：2026-05-04（W49 D1）
> **建议执行窗口**：W51 末或 W52 后（不阻塞 W46–W52 主线 v2 落地，也不阻塞 §9 业务带），目标 0.5 人日完成。
> **重要约束**：本批次**不能**触碰业务行为，只做命名/文案/类型/正则/测试覆盖类改动；任何引入新逻辑分支的项必须升级回独立 PR。
>
> **来源**：W49 D1 `/review` 报告（详见 transcript `e868b96f-aead-4abb-b21a-6cb485869aa1.jsonl` line 2243，或参见 [`W46-W52-checklist.md` §3 风险登记](./W46-W52-checklist.md#3-关键风险跟踪)）

---

## 0. P0 — W46 旁支漏勾（W49 D1 sprint harness 对齐 audit 发现）

> **来源**：[`2026-05-W49-sprint-harness-alignment.md` §2.7](./audits/2026-05-W49-sprint-harness-alignment.md)
> **优先级 P0（不是 P3）**：原 W46 day-1 旁支已计 0.5 人日窗口，但**截至 W49 D1 仍未勾**；属"主动伤害用户信任"类（假链接），应在卫生周首项处理。

**位置**：`apps/web/components/admin/admin-sidebar.tsx:152-158`

**当前形态**：sidebar "帮助文档" 链接指向 `/settings`（W45 v2 audit §8 #2 `Capability Discovery` 扣分项之一）。

**修复 ToDo**（任选其一）：

- [ ] **方案 A（最快，0.05 人日）**：label 改 "系统设置"，href 保持 `/settings`，不破任何东西
- [ ] **方案 B（更干净，0.05 人日）**：注释掉这条 sidebar 项，等 W50 P2-B-1 `/help` 页面 PR 一起恢复并指向真链接

**验收**：

- [ ] 浏览器 admin sidebar 不再有"帮助文档"指向假链接
- [ ] W50 P2-B-1 `/help` 页面落地 PR 同步恢复 sidebar 链接 + label
- [ ] 本项 prompt-native audit (`Capability Discovery #2 help docs`) 从"主动伤害"降为"未实现"，W52 v3 forecast 不再受此扣 active 分

**估时**：~0.05 人日

> ⚠️ **必须先于其他 §X 项执行**：这是已知的"用户信任伤害"，每多在 main 分支多一周都在伤害运营 38 人对 agent-native 体验的信任。

---

## Scope 界定（卫生周本体，不含上方 §0 的 P0 漏勾）

**包含**（12 项，原 13 项中 F-8 W49 D2 紧急升级 P0 已修，从 scope 移出）：

- ~~F-8（GitHub Actions footgun，P2 但单点，不属业务带）~~ → **W49 D2 紧急 hotfix，已修**（详见下方 §1）
- F-10 – F-17（8 项 P3 nit）
- T-4 / T-5 / T-6（3 项测试覆盖缺口，均为 P2/P3 优先级）
- F-18（与 F-1 同根，已通过 W49 D1 `MetricRecord.value: number | string` 类型修复隐式关闭，本表仅做归档备注）

**不包含**：

- F-4 / F-5 / F-9 → 已在 W50 P2-D 单独排期（影响安全/可观测性，需独立 PR）
- T-1（已在 W49 D1 修 F-1 时随 metric-client.spec.ts 落地）
- T-2（已在 W49 D1 修 F-2/F-7 时随 chat.service.spec.ts 落地，4 条 retry-aware 测试）
- T-3（chat.service.handleMessage → recordToolMetric 闭包参数集成测试，归到 W50 P2-D F-4 测试一起）
- T-7（已在 W49 D1 修 F-3 时随 chat.service.spec.ts 落地，7 条 envelope 形态测试）

---

## 1. F-8：GitHub Actions `set +e` 后未恢复 — W49 D2 紧急 hotfix（已修 ✅）

> **状态升级历程**：W49 D1 `/review` 标 P2 → 卫生周方案 A 排期 → **W49 D2 紧急升级 P0**（cron 第 1 次 manual trigger 暴露真实影响）→ **当日 hotfix 直接进 main**

**位置**：`.github/workflows/staging-smoke.yml` smoke step

**Pre-fix 形态**（从 W49 D1 commit 起到 W49 D2 hotfix 之前）：

```bash
set +e
pnpm --silent run smoke:chat-tool > smoke-output.json
echo "exit_code=$?" >> $GITHUB_OUTPUT
```

**真实影响**（W49 D2 manual trigger 暴露）：

step 末尾的 `echo` 是最后一条命令，echo 永远 exit 0，所以 GitHub Actions 计算 `steps.smoke.outcome` 永远等于 `success`，无论 smoke 脚本本身 exit 0 / 1（hard fail）/ 2（config 缺失）。这反过来让：

- `Notify Slack on failure` 的 `if: steps.smoke.outcome != 'success'` 永远 false → 永不通知
- `Fail job if smoke failed` 的同样条件永远 false → workflow 永远 ✅

**直接证据**：W49 D2 22:00 manual trigger 第 1 次 run 显示总时长 25s（远低于真实 smoke 应有的 1-3min）+ ✅ Success，但 secrets 当时全未配置，smoke 脚本必然 exit 2。然而 workflow 显示绿色，没有 Slack 通知，cron 解锁判定**完全失效**。

如果 W49 D2 没人手动 trigger 验证，cron 每周一会自动跑 → ✅ → 谁都不知道 smoke 实际从未真正运行。7 天观测窗口起算的是空数据。

**Hotfix（W49 D2 已上线）**：

```bash
set +e
pnpm --silent run smoke:chat-tool > smoke-output.json
ec=$?
echo "exit_code=$ec" >> "$GITHUB_OUTPUT"
exit "$ec"        # ← 关键：让 step.outcome 反映真实 smoke 退出码
```

`continue-on-error: true` 保留，让 artifact upload / Slack notify / Fail job 等后续 step 仍能跑；但 `exit "$ec"` 让 `step.outcome` 正确反映真实 smoke 结果。

**验收**（hotfix 后下次 manual trigger 验证）：

- [ ] secrets 全配齐场景：smoke exit 0，workflow ✅，Slack 不通知（success 不发，失败才发）
- [ ] secrets 缺失场景：smoke exit 2，workflow ❌，Slack 通知 hard failures = ['Missing secret: STAGING_API_BASE'] 等
- [ ] hard fail 场景（人为 mock 一个失败用例）：smoke exit 1，workflow ❌，Slack 通知含 metricDeltas

**实际耗时**：~0.05 人日（5 分钟改 + 文档同步 + manual trigger 验证）

**Sprint impact**：原方案 A 卫生周 0.55d → 0.50d（F-8 移出 0.05d 节省）

---

## 2. F-10：中文硬编码无 i18n

**位置**：`apps/web/components/dashboard/chat-tool-activity.tsx`

**当前形态**：硬编码 `"客服 Chat Tool 活动"` / `"调用次数"` / `"会话数"` / `"错误率"` / `"按品牌切片"` 等文案。

**风险**：与现有 dashboard 的其他 widget 风格不完全一致；未来运营英文化时需要批量改。

**修复 ToDo**：

- [ ] 检查 `apps/web/messages/zh-CN/` 下是否已有 `dashboard.json` 或 `chat-tool.json`，没有则新建 `dashboard-chat-tool.json`
- [ ] 把 5 条文案 key 化（`title` / `metrics.invocations` / `metrics.sessions` / `metrics.errorRate` / `breakdown.byBrand`）
- [ ] `chat-tool-activity.tsx` 用 `useTranslations('dashboard.chatTool')` 读取
- [ ] 增 `apps/web/messages/en-US/dashboard-chat-tool.json` 并提供英文翻译
- [ ] **验收**：Storybook / dev 在 `?locale=en` 下渲染正确

**估时**：~0.1 人日

---

## 3. F-11：`__dirname` CJS 写法

**位置**：`scripts/staging/smoke-chat-tool.spec.ts`

**当前形态**：用 `__dirname`（CJS 全局），vitest 内可工作。

**风险**：未来 monorepo 切到 ESM-strict（已在 W52 后某条 ADR 草稿里提过）时 `__dirname` 会 ReferenceError。

**修复 ToDo**：

- [ ] 改为 `import.meta.dirname`（Node 20.11+ / 21.2+ 内置）或 `path.dirname(fileURLToPath(import.meta.url))`
- [ ] **验收**：`pnpm -F @yaemartos/api test smoke-chat-tool.spec` 通过

**估时**：~0.02 人日

---

## 4. F-12：漂移正则只匹配单引号

**位置**：`scripts/staging/smoke-chat-tool.spec.ts` 漂移保护单测

**当前形态**：`/'chat\.[a-z._]+'/g` 只匹配单引号字符串。

**风险**：若某天 `chat.service.ts` 把 `KPI_TOOL_INVOCATION = 'chat.tool.invocation_count'` 切到 `"..."` 双引号或 \`...\` 模板字符串，spec 会**静默通过**——漂移保护失效。

**修复 ToDo**：

- [ ] 正则升级为 `/['"\`]chat\.[a-z._]+['"\`]/g`（匹配单/双/反引号）
- [ ] 或更稳：直接 import 三个常量再 `expect(content).toContain(KPI_TOOL_INVOCATION)`，绕过字符串识别
- [ ] **验收**：人为把 `chat.service.ts` 的 `KPI_TOOL_INVOCATION` 改成双引号，spec 必须仍能识别（pre-fix 会漏掉）

**估时**：~0.03 人日

---

## 5. F-13：200 条上限在生产规模会遮蔽 24h 数据

**位置**：`apps/web/app/[locale]/(admin)/dashboard/page.tsx` `CHAT_KPI_LIMIT = 200`

**风险**：MetricController `take=Math.min(limit, 200)` 也是 200 上限；1k 会话/天会被截到 ~1h 窗口，dashboard 24h 视图显示不全。

**修复 ToDo**（限本周内）：

- [ ] 提高 controller `take` 上限到 5000（`Math.min(limit, 5000)`）
- [ ] 提高 `CHAT_KPI_LIMIT` 到 2000（兼顾 admin 流量低 + 余量）
- [ ] **验收**：W49/W50 灰度数据进 prod 后用 `/metrics?name=chat.tool.invocation_count&limit=5000` curl 一次，确认 24h 数据完整

**估时**：~0.05 人日

> ⚠️ **可能升级**：若发现 metric 表有 1M+ 行（W50 cron 跑 4 周后可能），还要加索引或改 cursor pagination；那条要单独 PR。本卫生周只做参数调整。

---

## 6. F-14：`Promise.all` 一败俱败

**位置**：`apps/web/app/[locale]/(admin)/dashboard/page.tsx` 并行拉 3 条 metric

**当前形态**：`await Promise.all([fetchA, fetchB, fetchC])`，任一失败整页降级为占位 "—"。

**风险**：W49 KPI 三条 metric 中若 `chat.tool.error_count` 单独 fail（最不重要的一条），dashboard 把更重要的 `invocation_count` / `session_count` 一起隐藏。

**修复 ToDo**：

- [ ] 改为 `Promise.allSettled` + 各自 `try/catch`，每张 KPI 卡独立显示数字或 "—"
- [ ] 失败的卡加 tooltip "数据暂时不可用"（沿用现有 i18n key）
- [ ] **验收**：人为让 `error_count` fetch 抛错，invocation/session 卡仍渲染数字

**估时**：~0.08 人日

---

## 7. F-15：`cache: 'no-store'` × 3 次 RTT/页

**位置**：`apps/web/lib/api/metric-client.ts` `listMetrics` 三次调用

**当前形态**：`fetch(... { cache: 'no-store' })`，每次 SSR 都 3 次 RTT。

**风险**：admin 流量低暂可接受；W50+ 多人同时打开 dashboard 时叠加。

**修复 ToDo**（暂记，**不在本卫生周做**，待 §9 dayparting 引入 admin 缓存策略时一起）：

- [ ] 改用 `unstable_cache(60s)` 或 Next.js 16 `'use cache'` + `cacheLife('minutes')`
- [ ] 加 `cacheTag('metric-chat-tool')`，admin 写入 metric 时 `revalidateTag` 触发
- [ ] **验收**：连续刷新 dashboard 5 次，network panel 只看到 1 次 `/metrics` 调用

**估时**：~0.15 人日（涉及 cache key 设计 + 单测，超 0.5d 卫生周容量；推到 S5）

> ⏸ **延后到 S5**

---

## 8. F-16：Slack 失败通知中 `:rotating_light:` 单行兜底信息少

**位置**：`.github/workflows/staging-smoke.yml` Slack notify step

**当前形态**：`text: ":rotating_light: smoke failed"` + Block Kit `blocks: [...]`。

**风险**：Block Kit 不被某些 webhook（self-hosted Mattermost 兼容层 / 旧 Slack workspace）支持时，只显示 fallback `text`，缺核心 brand + exit code 信息。

**修复 ToDo**：

- [ ] `text` 改为模板：`":rotating_light: ${{ inputs.brand || 'all' }} smoke failed (exit ${exit_code})"`
- [ ] 保留 Block Kit 结构不变，仅加 fallback context
- [ ] **验收**：本地 jq 渲染 payload，`text` 字段含 brand + exit code

**估时**：~0.03 人日

---

## 9. F-17：`drainSse` 不处理 SSE 注释/心跳行

**位置**：`scripts/staging/smoke-chat-tool.ts` `drainSse`

**当前形态**：按 `data:` 前缀切分，遇到 `:keepalive` 等注释行（SSE spec §9.2.1）会被解析为 `data: ":keepalive"` 然后 JSON.parse 抛错。

**风险**：NestJS `@Sse()` 默认不发心跳；但 nginx / cloudflare / staging ingress 可能注入 → 解析失败被现有 try/catch 静默忽略，不致命，但 sseEvents 偏低易触发 soft warning。

**修复 ToDo**：

- [ ] `drainSse` 行解析时跳过 `line.startsWith(':')`（SSE 注释）
- [ ] 跳过空行（`line === ''`）—— 当前已经处理但确认一遍
- [ ] **验收**：human 模拟一段 `: keepalive\n\n: keepalive\n\ndata: {"foo":1}\n\n` → 解析出 1 个 event 不抛错

**估时**：~0.04 人日

---

## 10. F-18（已闭环）：`MetricRecord.value` 类型撒谎

> ✅ **已通过 W49 D1 修 F-1 时关闭**：`apps/web/lib/api/metric-client.ts` `MetricRecord.value: number | string` + `safeNumber()` helper 已落地，spec 增 3 条 string-fixture 测试。本项仅作归档备注，**卫生周无需动作**。

---

## 11. T-4：`<ChatToolActivity>` 无 RTL/snapshot 测试

**位置**：`apps/web/components/dashboard/chat-tool-activity.tsx`

**当前形态**：纯函数 `aggregateChatToolKpis` 已有 5+3 条测试，但 React 组件本身只有 SSR 间接覆盖，无显式渲染断言。

**修复 ToDo**：

- [ ] 新建 `apps/web/components/dashboard/chat-tool-activity.spec.tsx`，至少 3 条：
  - [ ] 健康数据：渲染 4 张 KPI 卡 + 数字 + 健康颜色
  - [ ] 告警数据（error rate > 30%）：错误卡变红 + tooltip
  - [ ] 空数据降级：4 张卡显示 "—"
- [ ] 用 vitest + `@testing-library/react`（已是 web 包依赖）

**估时**：~0.1 人日

---

## 12. T-5：`drainSse` SSE 解析器无单元测试

**位置**：`scripts/staging/smoke-chat-tool.ts` `drainSse`

**修复 ToDo**：

- [ ] 把 `drainSse` 内的解析逻辑抽成 pure function `parseSseChunk(buffer: string): { events: SseEvent[], remainder: string }`
- [ ] 新建 `scripts/staging/parse-sse-chunk.spec.ts`，至少 5 条：
  - [ ] 单 event
  - [ ] 多 event 跨 chunk 边界（buffer 拼接）
  - [ ] 多字节 UTF-8 跨 chunk（中文字符切半）
  - [ ] SSE 注释行（`:keepalive` 跳过，与 F-17 联动）
  - [ ] 空 chunk 不抛错
- [ ] **验收**：F-17 同步落地后跑 spec 通过

**估时**：~0.15 人日

---

## 13. T-6：GH Actions jq Slack payload 无 CI 验证

**位置**：`.github/workflows/staging-smoke.yml` Slack failure-parsing step

**当前形态**：jq 表达式构造 Block Kit payload，仅手测过一次。

**修复 ToDo**：

- [ ] 抽 jq 模板到独立文件 `scripts/ci/slack-payload.jq`
- [ ] 新建 `scripts/ci/slack-payload.spec.ts`，构造 3 个 fixture（hard fail / soft warning only / mixed），用 `child_process` 调 jq 渲染并 snapshot 比对
- [ ] workflow 用 `jq -f scripts/ci/slack-payload.jq` 加载（jq 版本兼容性确认 1.6+）
- [ ] **验收**：CI 上 spec 跑通；手测一次保证 webhook 仍正常发

**估时**：~0.12 人日

---

## 14. 容量对账

| 项                       | 工时     | 累计     | 备注                             |
| ------------------------ | -------- | -------- | -------------------------------- |
| **§0 P0 sidebar 假链接** | **0.05** | **0.05** | **必须最先做**                   |
| ~~F-8~~                  | ~~0.05~~ | ~~0.10~~ | ~~footgun~~ → W49 D2 hotfix 已修 |
| F-10                     | 0.10     | 0.15     | i18n                             |
| F-11                     | 0.02     | 0.17     | ESM ready                        |
| F-12                     | 0.03     | 0.20     | 漂移正则                         |
| F-13                     | 0.05     | 0.25     | 200 → 5000 上限                  |
| F-14                     | 0.08     | 0.33     | allSettled                       |
| F-16                     | 0.03     | 0.36     | Slack fallback                   |
| F-17                     | 0.04     | 0.40     | SSE 注释行                       |
| T-4                      | 0.10     | 0.50     | RTL widget                       |
| T-5                      | 0.15     | 0.65     | parseSseChunk 抽函数 + spec      |
| T-6                      | 0.12     | 0.77     | jq snapshot                      |

**实际预估总和**：**~0.77 人日**（W49 D2 F-8 hotfix 节省 0.05；超出 0.5 人日目标 0.27 人日）

**取舍方案**：

- **方案 A — 严格 0.5 人日** ✅ **已采纳（W49 D1 决议 2026-05-04，W49 D2 F-8 移出后修订）**：必做 §0 P0 + F-10 / F-11 / F-12 / F-13 / F-14 / F-16 / F-17（共 0.40，原含 F-8 0.45，移出后 0.40），加 T-4（0.10）→ 0.50 正好达标；T-5 / T-6 推到下一次卫生周
- ~~方案 B — 严格 1.0 人日~~：13 项全做 + §0 P0，集中清完不留尾巴 — **本次未采纳**

> **采纳理由**：§0 P0 是 active 用户信任伤害必须先做；T-5/T-6 是测试增量，错过一次卫生周不引入新债；保留 0.5 人日硬性容量约束，避免侵蚀 W52 v3 重审计或 §9 业务带产能。
>
> **执行窗口**（按 §15 触发条件，任一满足即排）：
>
> 1. W51 末若 P2-C 埋点信号收集完成且当周仍有 0.5d 余量 → **首选触发点**
> 2. W52 v3 重审计前最后一次清理 → 备选
> 3. S5 W53 启动周做"上一 sprint 残留清扫" → 兜底
>
> **特别约束**：§0 P0 sidebar 假链接**不等卫生周**——任何先发生的 admin-sidebar.tsx 维护 PR 都应顺手修掉（label → "系统设置" 或注释掉）。如 W50 末仍未被任何 PR 顺手修，单独开一个 5 分钟 PR 处理。

---

## 15. 触发条件

满足以下任一条件即排上日程：

- [ ] W51 末 P2-C 埋点信号收集完成、当周仍有 0.5d 余量
- [ ] W52 v3 重审计前最后一次清理（建议）
- [ ] S5 W53 启动周做"上一 sprint 残留清扫"

完成后归档：把本文档标 `✅ 已清理（YYYY-MM-DD）`，移动到 `docs/retro/` 下。

---

## 16. 通过标准

- [ ] §1–§13 中标记 "**修复 ToDo**" 的所有 checkbox 勾选完成（依方案 A 或 B 选）
- [ ] `pnpm -F @yaemartos/api test` + `pnpm -F @yaemartos/web test` 全绿
- [ ] `pnpm -w lint` 无新增 warning
- [ ] `pnpm -w typecheck` clean
- [ ] PR 描述里逐项链接本文档对应 §X
- [ ] 本文档底部加 "✅ 已清理（YYYY-MM-DD）" 并归档

---

_维护方式：每完成一项勾选对应 checkbox，并在 §14 表里把工时实际数填入；偏差超 30% 时升级到独立 sprint 处理。_
