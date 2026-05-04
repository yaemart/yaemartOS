# Action Parity 单项审计 — W46 末（P0-A/B/C 完成后）

> **类型**：单项专项审计（`/ce-agent-native-audit 1`）
> **生成日期**：2026-05-04（W46 中段，Day 5 完成 P0-B + P0-C 当日）
> **触发**：v2 plan W46 三阶段（P0-pre / P0-A / P0-B+C）落地完成后的回头检视
> **关联文档**：
>
> - 上次全量审计：[`2026-05-W45-agent-native-audit-v2.md`](./2026-05-W45-agent-native-audit-v2.md)（包含 Action Parity 18/24=75%）
> - 落地计划：[`2026-05-04-004-agent-native-improvements-v2-plan.md`](../plans/2026-05-04-004-agent-native-improvements-v2-plan.md)
> - 周拆解 + 容量对账：[`W46-W52-checklist.md`](../W46-W52-checklist.md)

---

## TL;DR

|                              | 值                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| Action Parity 静态评分       | **90 / 102 = 88.2%** ✅                                                                     |
| 与 W45 v2 对比               | 75% → 88.2%（+13pp，但口径细化）                                                            |
| **隐藏债务（runtime 评分）** | **0 / 87 conversational tools 实际接入 LLM = 0%** ❌                                        |
| 主要缺口                     | customer-self mirror（6）/ search（4）/ uploadImage（1）/ getMyCapabilities（1）            |
| 第一杠杆建议                 | **W48 把 P1-B-mod 替换为 chat tool calling 子集**（同等 1 人日预算，runtime 评分 0 → 非 0） |

---

## 1. 审计口径

- **分母**：以 `apps/web/lib/api/*-client.ts` + UI 内联 fetch 暴露的"业务 user action（动词+实体）"为单位计数；auth / OAuth / health / realtime infra **不计入** parity（agent 不应替用户登录或拉取健康检查）。
- **分子**：`apps/api/src/ai/tools/yaemartos-tools.ts:YAEMARTOS_TOOL_DESCRIPTORS`（87 条）+ `lingxing-tools.ts:LINGXING_TOOL_DESCRIPTORS`（3 条）+ Vercel AI `tool({...})` 实例（3 条 Lingxing，与 descriptor 重叠）。
- **状态**：
  - ✅ tool 已就绪 + UI 已接线
  - ⚠️ tool 已就绪但 UI 缺接线（违反"用户能做的，agent 也能做"双向对偶）
  - ❌ tool 完全缺失

---

## 2. 按业务领域明细

### A. Listing & Listing-Version（10 项 → 10 ✅）

| Action                      | UI 触发                                                | Agent Tool               | Status                 |
| --------------------------- | ------------------------------------------------------ | ------------------------ | ---------------------- |
| List listings               | `listing-list-client.tsx`                              | `listListings`           | ✅                     |
| Get listing detail          | `app/[locale]/(admin)/listings/[id]/page.tsx`          | `getListing`             | ✅                     |
| Update listing meta         | `lib/api/listing-client.ts:updateListing`              | `updateListing`          | ⚠️ tool ✓ / UI 缺 form |
| Delete listing              | （UI 未实现）                                          | `deleteListing`          | ⚠️ tool ✓ / UI 缺      |
| Create listing              | （UI 未实现）                                          | `createListing`          | ⚠️ tool ✓ / UI 缺      |
| List versions               | `version-timeline.tsx`                                 | `listListingVersions`    | ✅                     |
| Activate version            | `version-timeline.tsx`（**P0-B 新增**）                | `activateListingVersion` | ✅                     |
| Generate AI draft           | `listing-editor-shell.tsx:startGeneration`             | `generateListingDraft`   | ✅                     |
| Batch multilingual generate | `listing-editor-shell.tsx:startMultilingualGeneration` | `batchGenerateListings`  | ✅                     |
| View matrix                 | `app/[locale]/(admin)/listings/matrix/...`             | `getListingMatrix`       | ✅                     |

**子分**：10/10（含 ⚠️ 因 tool 已就绪故 parity 计 ✅；UI 缺口归 P2-A 处理）

### B. Ad-Suggestion / Ad-Change / Ad-Dashboard / Ad-Sync（9 项 → 9 ✅）

| Action                  | UI 触发                                     | Agent Tool              | Status |
| ----------------------- | ------------------------------------------- | ----------------------- | ------ |
| View ad dashboard       | `ad-dashboard-client.tsx`                   | `getAdDashboard`        | ✅     |
| Trigger ad sync         | `ad-dashboard-client.tsx:handleSync`        | `triggerAdSync`         | ✅     |
| Generate ad suggestions | `suggestion-list-client.tsx:handleGenerate` | `generateAdSuggestions` | ✅     |
| List ad suggestions     | `suggestions/page.tsx`                      | `listAdSuggestions`     | ✅     |
| Get ad suggestion       | （详情侧由 list 提供）                      | `getAdSuggestion`       | ✅     |
| Execute suggestion      | `suggestion-list-client.tsx`                | `executeAdSuggestion`   | ✅     |
| Reject suggestion       | `suggestion-list-client.tsx`                | `rejectAdSuggestion`    | ✅     |
| List ad changes         | `change-history-client.tsx`                 | `listAdChanges`         | ✅     |
| Rollback change         | `change-history-client.tsx`                 | `rollbackAdChange`      | ✅     |

### C. Shop / Shop-Binding（7 项 → 7 ✅，含 2 ⚠️）

| Action              | UI 触发                 | Agent Tool                   | Status            |
| ------------------- | ----------------------- | ---------------------------- | ----------------- |
| List shops          | `shop-list-client.tsx`  | `listShops`                  | ✅                |
| Get shop            | `shop-detail-page`      | `getShop`                    | ✅                |
| List Lingxing shops | binding modal           | `listAvailableLingxingShops` | ✅                |
| Create shop         | （UI 未实现）           | `createShop`                 | ⚠️ tool ✓ / UI 缺 |
| Bind to Lingxing    | `shop-binding-list.tsx` | `bindShopToLingxing`         | ✅                |
| Toggle / Unbind     | `shop-binding-list.tsx` | `updateShopBinding`          | ✅                |
| Delete shop         | （UI 未实现）           | `deleteShop`                 | ⚠️ tool ✓ / UI 缺 |

### D-K. Settings / Terminology / Migration / Locale / Market / Platform / Product / Category（51 项 → 全 ✅）

| 领域        | 项目数 | 全覆盖                                                                    |
| ----------- | ------ | ------------------------------------------------------------------------- |
| Settings    | 9      | ✅（含 connections / feature-flags / AI routing / AI cost / brand theme） |
| Terminology | 6      | ✅                                                                        |
| Migration   | 4      | ✅                                                                        |
| Locale      | 5      | ✅                                                                        |
| Market      | 5      | ✅                                                                        |
| Platform    | 2      | ✅（read only）                                                           |
| Product     | 7      | ✅（含 generateProductFaq）                                               |
| Category    | 7      | ✅（含 template upsert）                                                  |

### L. Customer-Portal — Admin/Operator side（17 项 → 全 ✅）

manuals × 2 / warranties × 3 / tickets × 6 / customers × 2 / order-lookup × 2 / agent-message × 1 / warranty-status × 1。

### L'. Customer-Portal — Customer-self side（6 项 → **0 ❌**）

| Action               | C 端 endpoint                         | Agent Tool | Status                                            |
| -------------------- | ------------------------------------- | ---------- | ------------------------------------------------- |
| 创建工单             | `POST /customer/tickets`              | —          | ❌                                                |
| 追加工单消息         | `POST /customer/tickets/:id/messages` | —          | ❌                                                |
| 关闭工单             | `PATCH /customer/tickets/:id/close`   | —          | ❌                                                |
| 注册延保             | `POST /customer/warranties`           | —          | ❌                                                |
| 订单查询（C 端身份） | `POST /customer/order-lookup`         | —          | ❌（admin 侧 `lookupOrderStatus` 不能代客户身份） |
| Chat session/message | `POST /customer/chat/sessions/...`    | —          | ❌（chat 由 LLM 主导，但运营 agent 无代发能力）   |

> 在 yaemartOS 双端架构（admin 后台 + 4 品牌前台）下，运营 agent 应能"代客户做几乎一切事情"。这 6 条缺失意味着客服流的"代办"路径只能由真人客户操作。

### M. Search（4 项 → **0 ❌**）

| Action                    | 后端 endpoint                  | Agent Tool |
| ------------------------- | ------------------------------ | ---------- |
| Search listing-draft (ES) | `GET /search/listing-draft`    | ❌         |
| Search keywords corpus    | `GET /search/keywords`         | ❌         |
| Import keywords corpus    | `POST /search/keywords/import` | ❌         |
| Search bootstrap          | `POST /search/bootstrap`       | ❌         |

### N. IAM Capabilities（1 项 → **0 ❌**）

| Action                    | 后端 endpoint           | Agent Tool                |
| ------------------------- | ----------------------- | ------------------------- |
| Discover own capabilities | `GET /iam/capabilities` | ❌ 无 `getMyCapabilities` |

### O. Cloudinary Upload（1 项 → **0 ❌**）

| Action       | 后端 endpoint               | Agent Tool                          |
| ------------ | --------------------------- | ----------------------------------- |
| Upload image | `POST /upload`（multipart） | ❌（A+ 内容、产品图自动化都依赖此） |

### P. Metrics（2 项 → 2 ✅）

`listMetrics` / `recordMetric`。

---

## 3. Score 汇总

| 桶                             | 总数    | Agent 已覆盖 |
| ------------------------------ | ------- | ------------ |
| A. Listing & Version           | 10      | 10           |
| B. Ad                          | 9       | 9            |
| C. Shop                        | 7       | 7            |
| D. Settings                    | 9       | 9            |
| E. Terminology                 | 6       | 6            |
| F. Migration                   | 4       | 4            |
| G. Locale                      | 5       | 5            |
| H. Market                      | 5       | 5            |
| I. Platform                    | 2       | 2            |
| J. Product                     | 7       | 7            |
| K. Category                    | 7       | 7            |
| L. Customer-portal (admin)     | 17      | 17           |
| **L'. Customer-portal (self)** | **6**   | **0**        |
| **M. Search**                  | **4**   | **0**        |
| **N. IAM (capabilities)**      | **1**   | **0**        |
| **O. Cloudinary upload**       | **1**   | **0**        |
| P. Metrics                     | 2       | 2            |
| **合计**                       | **102** | **90**       |

### 静态评分：**90 / 102 = 88.2%** ✅

---

## 4. 隐藏债务（Hidden Gap）

> **这是本次审计最重要的发现**，属于运行时层面的真实漏洞，与静态评分独立。

| 维度                                 | 现状                                                             | 应有                |
| ------------------------------------ | ---------------------------------------------------------------- | ------------------- |
| `YAEMARTOS_TOOL_DESCRIPTORS` 数量    | 87                                                               | —                   |
| `LINGXING_TOOL_DESCRIPTORS` 数量     | 3                                                                | —                   |
| Vercel AI SDK 真正的 `tool({...})`   | 3（仅 Lingxing）                                                 | ≥ 30                |
| **`streamText({ tools })` 实际挂载** | **0**（chat.service.ts 调用 streamText 时根本没传 `tools` 参数） | ≥ 8（核心客服动作） |

**含义**：customer-portal chat 哪怕用户说"帮我开一张工单"，LLM 也只能用自然语言敷衍 —— 它**没有调用工具的能力**。87 条 descriptor 是给外部 MCP client 看的目录，**不是 LLM runtime 能用的工具**。

**归零原因（架构层）**：

- `customer-portal/chat/chat.service.ts` 的 `streamText({ system, messages, model })` 缺 `tools` 字段。
- `gemini-listing-generation.service.ts` 用 `generateObject` 做结构化输出，本就不需要 tools，是合理的。
- 但客服 chat 本质上是 task-oriented，缺 tool calling 等于自我阉割。

---

## 5. Top 缺口与建议

### 缺失 tool（按 impact 排序）

| 优先级 | 缺失 tool                                                                   | 业务影响                                             | 工作量                      |
| ------ | --------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------- |
| **P1** | `searchListingDraft`                                                        | Agent 无法做模糊检索，只能枚举 listing               | S（0.25 人日）              |
| **P1** | `searchKeywords`                                                            | Agent 不能为 listing 优化推荐高相关 keyword          | S（0.25 人日）              |
| **P1** | `getMyCapabilities`                                                         | Agent 无法自检"我能干什么"，`/help` 类问题只能硬编码 | XS（0.25 人日）             |
| **P2** | `createCustomerTicket` / `addCustomerTicketMessage` / `closeCustomerTicket` | 运营 agent 无法代客户在工单流推进                    | S（0.5 人日）               |
| **P2** | `registerWarranty`（customer-side）                                         | 同上                                                 | S（0.25 人日）              |
| **P2** | `customerOrderLookup`（customer-side）                                      | 同上                                                 | XS（0.25 人日）             |
| **P3** | `uploadImage`                                                               | Agent 不能替运营上图（A+ 内容、产品图）              | M（1 人日，multipart 复杂） |
| **P3** | `bootstrapSearch` / `importKeywords`                                        | 仅运维场景                                           | S（合计 0.5 人日）          |

### 第一杠杆建议（W48 内可吸收）

> 与其再补 descriptor，不如**让 LLM 真的能调工具**。这是 ROI 最高的单点修复。

把 W46-W52 checklist 中 W48 的 **P1-B-mod**「MCP 工具自述模块」（原计划 2 人日）替换为 **P1-B-mod-v2**「chat 接 tool calling 子集」（同样 2 人日）：

- Wrap 客服 7-10 条核心 tool 为 Vercel AI `tool({...})` 实例：
  - `createCustomerTicket` / `addCustomerTicketMessage` / `listMyTickets`
  - `registerWarranty` / `listMyWarranties`
  - `customerOrderLookup`
  - `listProductManuals` / `getProductManual`
- `chat.service.ts` 的 `streamText({ ... })` 注入 `tools`
- system prompt 注入 `GET /ai/mcp/tools` 的精简 summary（同时解决 Recommendation #3）
- 单测 + 灰度（在 `feature_flag.AGENT_NATIVE_REALTIME_UI` 之外另起 `feature_flag.AGENT_NATIVE_TOOL_CALLING`）

**为什么不增加预算**：

- 原 P1-B-mod 的 60% 已经被 `GET /ai/mcp/tools` 实现，剩下的"在前端展示能力"留给 W50 的 P2-B-1 `/help` 页面承接（本就在计划中）。
- 这是**重新分配**，不是新增。

---

## 6. 与 W45 audit v2 对比

| 维度                       | W45 v2        | 本次（W46 末） | 变化                              |
| -------------------------- | ------------- | -------------- | --------------------------------- |
| Action Parity 评分         | 18/24 = 75%   | 90/102 = 88.2% | ↑ ~13pp（口径细化后真实位置更高） |
| 静态 tool descriptors 总数 | 87            | 87             | —                                 |
| 真正 `tool({})` 实例       | 3（Lingxing） | 3              | —                                 |
| **LLM 实际挂载工具**       | **0**         | **0**          | ❌ 未变                           |
| Customer-self mirror       | 缺            | 仍缺           | ❌                                |
| Search agent tools         | 缺            | 仍缺           | ❌                                |
| `getMyCapabilities`        | 缺            | 仍缺           | ❌                                |

**核心结论**：mutation 主干已健全（写得动），但 LLM 层 0 处真实工具调用。下一波最有杠杆的事不是补 descriptor，而是把 `streamText` 接上 tool calling。

---

## 7. v3 重审计验证项（W52）

W52 重跑 `/ce-agent-native-audit` 时，本项预期看到以下变化：

- [ ] Action Parity 静态分 ≥ 92%（P0-D 后 shop / settings / migration UI 接线增加，⚠️ 转 ✅）
- [ ] **runtime 评分**：`streamText({ tools })` 挂载 tool 数 ≥ 8（P1-B-mod-v2 落地）
- [ ] customer-self mirror tool ≥ 6（P1-B-mod-v2 同步覆盖）
- [ ] `getMyCapabilities` tool 已存在（W48 子任务）
- [ ] system prompt 注入 capabilities summary（W48 子任务）

如重审计仍看到 `runtime tools = 0`，应在 W52 retrospective 标红，并将 chat tool calling 提升为 S5 W53 的 P0。

---

## 8. 落地动作

| 序号 | 动作                                                                     | 截止                    |
| ---- | ------------------------------------------------------------------------ | ----------------------- |
| 1    | 本审计文档 commit 到主分支                                               | W46 末（2026-05-09 前） |
| 2    | `W46-W52-checklist.md` W48 段把 P1-B-mod 改为 P1-B-mod-v2，加风险条目    | 同上                    |
| 3    | `2026-05-04-004-agent-native-improvements-v2-plan.md` 末尾追加本审计链接 | 同上                    |
| 4    | leadership 同步：v3 KPI 加 `runtime tools mounted` 这一项                | W47 周会                |
