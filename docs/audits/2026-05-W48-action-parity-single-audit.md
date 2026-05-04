# Action Parity 单项审计 — W48 末（P1-B-mod-v2 上线后）

> **类型**：单项专项审计（`/ce-agent-native-audit 1`）
> **生成日期**：2026-05-04（W48 sprint 末，customer chat tool calling 落地当日）
> **触发**：W47 SSE 实时同步 + W48 customer chat runtime tool calling 上线后的回头量化
> **关联文档**：
>
> - 上次单项审计：[`2026-05-W46-action-parity-single-audit.md`](./2026-05-W46-action-parity-single-audit.md)
> - 关键决策：[`ADR-012-customer-chat-tool-calling.md`](../adr/ADR-012-customer-chat-tool-calling.md)
> - 落地计划：[`2026-05-04-004-agent-native-improvements-v2-plan.md`](../plans/2026-05-04-004-agent-native-improvements-v2-plan.md)
> - 周拆解 + 容量对账：[`W46-W52-checklist.md`](../W46-W52-checklist.md)

---

## TL;DR

|                                             | W46 末                                      | W48 末                                                                        | Δ                  |
| ------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- | ------------------ |
| Action Parity 静态评分                      | 90 / 102 = **88.2%** ✅                     | 94 / 102 = **92.2%** ✅                                                       | +4pp               |
| **Runtime tool calling**（streamText 挂载） | **0** ❌                                    | **8** ✅                                                                      | **+8（首次破零）** |
| Runtime / 静态 比                           | 0%                                          | 8/88 = 9.1%（admin+customer 全集）<br>8/8 = 100%（customer-portal mirror）    | —                  |
| Vercel AI `tool({})` 实例（含未挂载）       | 3                                           | **11**                                                                        | +8                 |
| Customer-self mirror                        | 0/6                                         | **4/6** ✅                                                                    | +4                 |
| Search agent tool                           | 0/4 ❌                                      | 0/4 ❌                                                                        | 持平               |
| `getMyCapabilities`                         | ❌                                          | ❌（部分被 ADR-012 §D5 prompt-derive 替代）                                   | 部分修复           |
| 第一杠杆建议                                | "把 P1-B-mod 替换为 chat tool calling 子集" | **"W50 把 search × 2 + getMyCapabilities × 1 接 admin 入口或扩展 chat 子集"** | —                  |

---

## 1. 审计口径

- **分母**：以 `apps/web/lib/api/*-client.ts` + `apps/portal/lib/api/customer-api-client.ts` 暴露的"业务 user action（动词+实体）"为单位计数。auth / OAuth / health / realtime infra 不计入 parity。
- **分子（双轨）**：
  - **静态**：`yaemartos-tools.ts:YAEMARTOS_TOOL_DESCRIPTORS`（88 条）+ `lingxing-tools.ts:LINGXING_TOOL_DESCRIPTORS`（3 条）+ `customer-chat-tools.ts:buildCustomerChatTools`（8 条）。
  - **Runtime**：实际被 `streamText({ tools })` 挂载、能在 LLM 推理过程中由模型调用的 tool 实例数。这是**真实可达性**，与静态 descriptor 区分。
- **状态**：
  - ✅ tool 已就绪 + UI 已接线 + （若客服场景）runtime 可调用
  - ⚠️ tool 已就绪但 UI 缺接线 / 或仅静态 descriptor 未挂载到 streamText
  - ❌ tool 完全缺失

> **本次新增独立维度**：`runtime mounted` 列表，用于追踪"LLM 实际能调用的工具"——这是 W46 末报告 §4 提出的"隐藏债务"指标。

---

## 2. 静态 parity 明细（变化点高亮）

W46 → W48 仅 L' 桶（customer-portal self）发生变动，其他桶一致。

### A–K. Admin 主面板（不变，全 ✅）

| 桶                                                 | 项目数 | Agent 已覆盖 | 状态变化 |
| -------------------------------------------------- | ------ | ------------ | -------- |
| A. Listing & Version                               | 10     | 10           | 无       |
| B. Ad（含 suggestion / change / dashboard / sync） | 9      | 9            | 无       |
| C. Shop                                            | 7      | 7            | 无       |
| D. Settings                                        | 9      | 9            | 无       |
| E. Terminology                                     | 6      | 6            | 无       |
| F. Migration                                       | 4      | 4            | 无       |
| G. Locale                                          | 5      | 5            | 无       |
| H. Market                                          | 5      | 5            | 无       |
| I. Platform                                        | 2      | 2            | 无       |
| J. Product                                         | 7      | 7            | 无       |
| K. Category                                        | 7      | 7            | 无       |
| L. Customer-portal admin                           | 17     | 17           | 无       |
| P. Metrics                                         | 2      | 2            | 无       |
| **小计 A–K + L + P**                               | **90** | **90**       | —        |

### L'. Customer-portal — Customer-self side（**0 / 6 → 4 / 6** ⬆️）

| Action               | C 端 endpoint                         | W46 末 | W48 末                         | 落地路径                                                                     |
| -------------------- | ------------------------------------- | ------ | ------------------------------ | ---------------------------------------------------------------------------- |
| 创建工单             | `POST /customer/tickets`              | ❌     | ✅                             | `customer-chat-tools.createCustomerTicket`                                   |
| 追加工单消息         | `POST /customer/tickets/:id/messages` | ❌     | ✅                             | `customer-chat-tools.addCustomerTicketMessage`                               |
| 关闭工单             | `PATCH /customer/tickets/:id/close`   | ❌     | ❌（**ADR-012 §D1 显式排除**） | 安全决策：避免 LLM 误关流程；客户仍可在 UI 关闭                              |
| 注册延保             | `POST /customer/warranties`           | ❌     | ✅                             | `customer-chat-tools.registerWarranty`（不接 invoice，提示 30 天内 UI 补传） |
| 订单查询（C 端身份） | `POST /customer/order-lookup`         | ❌     | ✅                             | `customer-chat-tools.customerOrderLookup`（绕 CAPTCHA，强制 customerId）     |
| Chat session/message | `POST /customer/chat/sessions/...`    | ❌     | ❌（**口径修正**）             | chat 本身就是 agent 入口；不应作为 agent 代调动作                            |

**子分**：4/6（决策排除 1 + 口径剔除 1，仍按原分母计）

### M. Search（持平 0 / 4 ❌）

| Action                    | 后端 endpoint                  | W46 末 | W48 末 | 备注               |
| ------------------------- | ------------------------------ | ------ | ------ | ------------------ |
| Search listing-draft (ES) | `GET /search/listing-draft`    | ❌     | ❌     | W50 候选           |
| Search keywords corpus    | `GET /search/keywords`         | ❌     | ❌     | W50 候选           |
| Import keywords corpus    | `POST /search/keywords/import` | ❌     | ❌     | 运维场景，优先级低 |
| Search bootstrap          | `POST /search/bootstrap`       | ❌     | ❌     | 运维场景，优先级低 |

### N. IAM Capabilities（持平 0 / 1 ❌，部分缓解）

| Action                    | 后端 endpoint           | W46 末 | W48 末 | 备注                                                                                                                            |
| ------------------------- | ----------------------- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Discover own capabilities | `GET /iam/capabilities` | ❌     | ❌     | **但** customer-portal chat 已通过 ADR-012 §D5 实现「system prompt 运行时 derive 自 tool registry」，部分等价于"agent 自检能力" |

> **缓解度评估**：自检能力的 50% 已用 prompt-derive 实现（chat 助手会在系统提示中看到所有可用 tool 名+描述）。但 admin 侧 `/help` 页面仍需要 `getMyCapabilities` REST tool 才能向运营人员展示能力列表。这一点 W50 P2-B-1 必须落地。

### O. Cloudinary Upload（持平 0 / 1 ❌）

| Action       | 后端 endpoint               | W46 末 | W48 末 | 备注                                       |
| ------------ | --------------------------- | ------ | ------ | ------------------------------------------ |
| Upload image | `POST /upload`（multipart） | ❌     | ❌     | A+ 内容、产品图自动化仍需 W50 之后单独排期 |

---

## 3. 静态 Score 汇总

| 桶                                                   | 总数    | W46 末 | W48 末   |
| ---------------------------------------------------- | ------- | ------ | -------- |
| A–L + P（admin 主面板 + 现有 customer-portal admin） | 90      | 90     | 90       |
| L'. Customer-portal self                             | 6       | 0      | **4** ⬆️ |
| M. Search                                            | 4       | 0      | 0        |
| N. IAM capabilities                                  | 1       | 0      | 0        |
| O. Cloudinary upload                                 | 1       | 0      | 0        |
| **合计**                                             | **102** | **90** | **94**   |

### 静态评分：**94 / 102 = 92.2%** ✅（vs W46 末 88.2%，+4pp）

---

## 4. Runtime parity（本次新增维度，W46 末为 0）

| 维度                           | W46 末        | W48 末                                | 备注                                                                                                                               |
| ------------------------------ | ------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `streamText({ tools })` 调用点 | 0             | **1**                                 | `apps/api/src/customer-portal/chat/chat.service.ts`                                                                                |
| 该调用挂载的 tool 数           | 0             | **8**                                 | `buildCustomerChatTools()` 注册表                                                                                                  |
| Vercel AI `tool({})` 实例总数  | 3（Lingxing） | **11**（3 Lingxing + 8 CustomerChat） | Lingxing 3 条仍是 orphan factory（仅供 REST `/ai/mcp/*` 端点）                                                                     |
| 实际可被 LLM 调用              | 0             | **8**                                 | LLM runtime 可达性                                                                                                                 |
| 客服场景 mirror 覆盖率         | 0%            | **100%**（4 mutation + 4 read）       | createTicket / addMsg / register / orderLookup（4 mutation）+ listMyTickets / listMyWarranties / listManuals / getManual（4 read） |

### 4.1 8 条已挂载 tool 清单

| Tool                       | 类型     | IAM             | 错误回灌                              | 单测 |
| -------------------------- | -------- | --------------- | ------------------------------------- | ---- |
| `listMyTickets`            | read     | requireCustomer | ✅ classify()                         | ✅   |
| `createCustomerTicket`     | mutation | requireCustomer | ✅                                    | ✅   |
| `addCustomerTicketMessage` | mutation | requireCustomer | ✅                                    | ✅   |
| `listMyWarranties`         | read     | requireCustomer | ✅                                    | ✅   |
| `registerWarranty`         | mutation | requireCustomer | ✅（含 invoiceFollowUpRequired 提示） | ✅   |
| `customerOrderLookup`      | read     | requireCustomer | ✅（绕 CAPTCHA path）                 | ✅   |
| `listProductManuals`       | read     | 公开            | ✅                                    | ✅   |
| `getProductManual`         | read     | 公开            | ✅                                    | ✅   |

> **14 个单测全 PASS**：覆盖 IAM lock（拒绝匿名敏感操作 + 拒绝 LLM 注入 customerId）/ 错误分类（NotFound/Forbidden/BadRequest/Unknown）/ 8 条 tool happy path / `describeCustomerChatTools` 渲染。

### 4.2 Runtime 评分

- **客服场景能力**：8/8 = **100%** ✅（customer-portal chat 全覆盖）
- **agent 总能力 runtime 利用率**：8/88 = **9.1%**（admin 静态 descriptor 仍未通过 LLM runtime 暴露——admin 没有 chat 入口，这是设计选择，非缺口）
- **从 0 到 8**：W48 sprint 单点突破，**首次让 LLM 真正能调工具**

### 4.3 Lingxing 3 条 orphan tool factory（隐藏现象，不计为缺口）

`buildLingxingTools` 在 `apps/api/src/ai/tools/lingxing-tools.ts` 定义，但**全仓库无任何 streamText 消费它**。它的真实用途是给 `IMcpToolCallService` 提供 zod-validated execute 函数——通过 `/ai/mcp/query-inventory` 等 REST 端点服务外部 MCP client。

> **结论**：Lingxing 3 条 = REST MCP server 暴露（外部 agent 可调用），不计入"yaemartOS 内部 LLM 可调用"维度。这与 chat tool calling 是**两条独立的链路**。

---

## 5. 与 W46 末审计建议的执行对照

| W46 末建议                                                                                   | 状态                                                                                      | 备注                                                        |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **第一杠杆**：把 W48 P1-B-mod 替换为 chat tool calling 子集（同 1 人日预算）                 | ✅ 已落地为 P1-B-mod-v2，2 人日完成 8 条 tool + ADR-012 + 25 个单测 + 前端 in-flight 提示 | 见 [W46-W52-checklist.md L130-150](../W46-W52-checklist.md) |
| 在 `feature_flag.AGENT_NATIVE_REALTIME_UI` 之外另起 `feature_flag.AGENT_NATIVE_TOOL_CALLING` | ✅ ADR-012 §D4 落地，独立灰度 / 回滚                                                      | —                                                           |
| system prompt 注入 capabilities summary（避免硬编码漂移）                                    | ✅ ADR-012 §D5：`describeCustomerChatTools()` 运行时 derive                               | 加 / 删 tool 自动反映到 prompt                              |
| createCustomerTicket / addCustomerTicketMessage（P2 列表）                                   | ✅ 落地                                                                                   | —                                                           |
| registerWarranty（customer-side）                                                            | ✅ 落地                                                                                   | invoiceFollowUpRequired flag 提示客户 30 天内 UI 补传       |
| customerOrderLookup（customer-side）                                                         | ✅ 落地                                                                                   | 新增 `OrderLookupService.lookupForChatTool()` 跳 CAPTCHA    |
| `searchListingDraft` / `searchKeywords` / `getMyCapabilities`                                | ❌ 仍未落地                                                                               | 转 W50 P2 候选（见下文 §6）                                 |
| `uploadImage`                                                                                | ❌ 仍未落地                                                                               | 排期延后到 S5（multipart 复杂度，1 人日）                   |

> **执行率**：W46 末提出的 P1+P2 必做项（除 search × 2 + getMyCapabilities）100% 落地。Search / capabilities / upload 三项延到 W50+。

---

## 6. Top 缺口与 W50+ 建议

### 6.1 仍存在的缺口（按 impact 排序）

| 优先级 | 缺失 tool                            | 业务影响                                                   | 工作量                 | 推荐时间        |
| ------ | ------------------------------------ | ---------------------------------------------------------- | ---------------------- | --------------- |
| **P1** | `searchListingDraft`                 | Agent 无法做 listing 模糊检索（必须遍历列表）              | XS（0.25 人日）        | W50 P2-B 内吸收 |
| **P1** | `searchKeywords`                     | Agent 不能为 listing 优化推荐高相关 keyword                | XS（0.25 人日）        | W50 P2-B 内吸收 |
| **P1** | `getMyCapabilities`（admin REST）    | `/help` 页面、admin agent 自检需要它（chat 侧已 50% 缓解） | XS（0.25 人日）        | W50 P2-B-1 必做 |
| **P2** | `uploadImage`                        | A+ 内容、产品图自动化                                      | M（1 人日，multipart） | S5 排期         |
| **P3** | `bootstrapSearch` / `importKeywords` | 仅运维场景                                                 | S（合计 0.5 人日）     | S5 P3           |

### 6.2 第一杠杆建议（W50 内可吸收）

> **核心思路**：W48 已破零，W50 应从"runtime tool 数 = 8"扩展到 admin 侧。但 admin 没有 chat 入口，所以策略不是"加 chat"，而是"补 admin agent 检索 / 自检能力到现有 conversational entry"。

**具体方案**（0.5 人日，不超 W50 预算）：

1. 把 `searchListingDraft` + `searchKeywords` 写成 Vercel AI `tool({...})`，挂到 W50 P2-B-1 `/help` 页面新建的 admin assistant chat（`/help` 页面本身已在原 W50 计划里）。
2. `getMyCapabilities` 直接复用 `describeCustomerChatTools` 的 derive 模式 + `YAEMARTOS_TOOL_DESCRIPTORS` 的精简映射，给 `/help` 页面渲染卡片用。
3. ADR 不需要新写——沿用 ADR-012 的 IAM lock + 错误回灌 + flag 治理。

**为什么不在 customer chat 加 search**：客户问"找一个 listing"是 admin 工作流，不是 customer-self 范畴；保持 customer chat 8 条客服 mirror 不动。

### 6.3 风险跟踪（更新 W46-W52 checklist §3）

| 风险                                                             | 现状（W48 末）                      | 监测方式                                                                  |
| ---------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| ~~chat runtime tool calling = 0~~                                | ✅ **已解除**（8 条客服 tool 上线） | W52 v3 重审计量化"实际被调用次数"                                         |
| **新增**：staging 灰度后 LLM 误调 / 不调（call rate 太低或太高） | 待 W48 末 staging 数据              | 接入观测 — `recordMetric('chat.tool.call_rate', ...)`（已有 metric 框架） |
| **新增**：tool 错误回灌后 LLM 是否能 graceful 回复               | 待评估集                            | W49 W50 跑评估集，含 5 类错误码各 5 个 case                               |
| `searchListingDraft` 仍缺（P1）                                  | 持平                                | W50 P2-B-1 内吸收（0.25 人日）                                            |
| `getMyCapabilities` 仍缺（P1）                                   | 50% 缓解（chat prompt-derive）      | W50 P2-B-1 必做                                                           |

---

## 7. 与 W46 末审计的对比

| 维度                                 | W46 末                  | W48 末                             | 变化                             |
| ------------------------------------ | ----------------------- | ---------------------------------- | -------------------------------- |
| Action Parity 静态分                 | 90/102 = 88.2%          | 94/102 = 92.2%                     | ↑ +4pp                           |
| 静态 tool descriptors 总数           | 87 + 3 = 90             | 88 + 3 + 8 = 99                    | +9（含 8 条 customer-chat tool） |
| Vercel AI `tool({})` 真实实例        | 3（Lingxing 仅供 REST） | 11（3 Lingxing + 8 customer-chat） | +8                               |
| **`streamText({ tools })` 实际挂载** | **0**                   | **8**                              | **+8（首次破零）**               |
| Customer-self mirror                 | 0/6                     | 4/6                                | ↑                                |
| Search agent tools                   | 0/4                     | 0/4                                | 持平                             |
| `getMyCapabilities`                  | ❌                      | ❌ + 部分 prompt-derive 缓解       | 部分                             |
| 错误回灌策略                         | 不存在（throw 中断）    | 结构化 `{ ok, error, message }`    | 新增                             |
| IAM 在 tool 内 vs LLM 参数           | N/A                     | tool execute 内强锁                | 新增（ADR-012 §D2）              |

**核心结论**：W46 末预言的"runtime tool calling = 0 是最大隐藏债务"在 W48 末已通过 P1-B-mod-v2 单 sprint 解除。Customer chat 现在是真实的 agent-native 入口（"客户能做的，AI 也能代做"），不再是只能聊天的 LLM。

剩余缺口（admin search × 2 + getMyCapabilities × 1）全部为 P1 但 XS 工作量，W50 P2-B-1 `/help` 页面 0.5 人日内可吸收。

---

## 8. v3 重审计验证项（W52）

W52 重跑 `/ce-agent-native-audit` 时，本项预期看到以下变化：

- [x] Action Parity 静态分 ≥ 92%（W48 末已达 92.2%）
- [x] **runtime 评分**：`streamText({ tools })` 挂载 tool 数 ≥ 8（W48 末 = 8）
- [x] Customer-self mirror tool ≥ 4（W48 末 = 4，剩 closeCustomerTicket 设计排除）
- [ ] `searchListingDraft` / `searchKeywords` tool 已存在（W50 子任务）
- [ ] `getMyCapabilities` tool 已存在（W50 子任务）
- [ ] **Runtime KPI**：staging 灰度数据（call rate / 错误回灌后 graceful response 率）
- [ ] admin 侧若有 conversational entry（W50 `/help`），其 streamText 也挂载 search × 2 tool

**新风险（W52 监测）**：

- LLM 调用 tool 后，"客户问 + tool 返回 → 模型 graceful 回复"链路是否稳定（错误码 5 种 × 5 case 评估集断言）
- ADR-012 §D1 排除的 closeCustomerTicket 是否会被客户大量请求（如果是，则需要重新评估安全权衡）

---

## 9. 落地动作

| 序号 | 动作                                                                               | 截止                                                   |
| ---- | ---------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1    | 本审计文档 commit 到主分支                                                         | W48 末（5/27 前）                                      |
| 2    | `W46-W52-checklist.md` §3 风险跟踪同步「chat runtime tool calling = 0 已解除」     | 已同步（见 [checklist L257](../W46-W52-checklist.md)） |
| 3    | leadership 同步：W52 v3 KPI 增加"实际 call rate" 与"错误回灌 graceful response 率" | W49 周会                                               |
| 4    | W50 P2-B-1 `/help` 页面 PR 内吸收 search × 2 + getMyCapabilities × 1（0.5 人日）   | W50 中                                                 |
| 5    | W48 末 staging 灰度数据（首次"客户真实使用 tool"）周报                             | W49 周会                                               |

---

## 10. 工艺备忘

本次审计可被复用的方法论：

1. **静态 vs runtime 双轨**：单独"descriptor 数量"指标会美化真实可用性。本次报告把 `streamText({ tools })` 挂载数列为独立维度，避免再次出现 W46 末那种"看上去 88% 实际能用 0%"的盲点。
2. **客服 mirror 桶单独评分**：customer-portal self 与 admin 主面板有完全不同的产品语义（一个是"代客户"，一个是"代运营"），合并打分会稀释真实信号。
3. **设计排除 ≠ 缺口**：ADR-012 §D1 显式排除的 `closeCustomerTicket` / `assignTicket` 等是 IAM 安全决策，应在分母中标注为"决策排除"，与"未实现"区分。
4. **Prompt-derive 部分修复 capability discovery**：chat 系统提示从 tool registry 实时 derive，等价于"agent 知道自己能干什么"——admin REST `getMyCapabilities` 仍需要，但 chat 侧不再是 0。
