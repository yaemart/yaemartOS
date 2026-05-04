# W48 末单维度审计：Context Injection（上下文注入）

> **Skill**: `/ce-agent-native-audit context` （single-principle mode）
> **Auditor**: Agent-native team（自审）
> **审计时间**: 2026-05-04（W48 末，紧跟 [W48 Action Parity audit](./2026-05-W48-action-parity-single-audit.md)）
> **基线**: [W45 v2 audit §4](./2026-05-W45-agent-native-audit-v2.md#4-原则-3context-injection810--80) 的 8/10 (80%)
> **W52 v3 目标**: 9/10 (90%)
> **关注点**: ADR-012 在 W48 末上线的 `toolSummary` 派生 + chat 系统提示词的 workspace 注入扩容是否关闭了 W45 v2 标定的两条扣分项

---

## TL;DR

**Context Injection 由 8/10 (80%) → 9/10 (90%)**，提前 4 周达成 W52 v3 forecast 目标。

| 维度                          | W45 v2         | W48 末                     | Δ      | 备注                                                |
| ----------------------------- | -------------- | -------------------------- | ------ | --------------------------------------------------- |
| #1 Identity                   | ✅ Strong      | ✅ Strong                  | —      | 6 surface 全部命中                                  |
| **#2 Available capabilities** | ❌ **Missing** | **✅ Strong (chat)**       | **+1** | ADR-012 `describeCustomerChatTools` 派生            |
| #3 User identity / IAM        | ⚠️ Weak        | ⚠️ Weak                    | —      | chat 强（customerId 显式），admin surface 仍弱      |
| #4 Workspace state            | ✅ Strong–Weak | ✅ Strong（chat 大幅强化） | —      | chat 新增 open tickets + recent orders              |
| #5 Recent activity            | ⚠️ Weak        | ✅ Strong (chat)           | —      | chat 新增 last 3 order lookups                      |
| #6 Available resources        | ✅ Strong      | ✅ Strong                  | —      | FAQ knowledge / brand voice / lexicon               |
| #7 User preferences           | ⚠️ Weak        | ⚠️ Weak                    | —      | locale 之外仍未注入                                 |
| #8 Session history            | ✅（仅 Chat）  | ✅（仅 Chat）              | —      | contextMessages                                     |
| #9 Domain terminology         | ✅ Strong      | ✅ Strong                  | —      | brand voice + escalation policy + locale guidelines |
| #10 Current task              | ✅ Strong      | ✅ Strong                  | —      | 6 surface 全部命中                                  |

**计分规则**（沿用 W45 v2 §4）：每维度只要有任一 surface 注入到至少 Weak 强度即记 1 分。

---

## 1. 审计范围（6 个 system prompt surface）

| #   | Surface                | 文件                                                                                                        | LLM 调用方式             | 是否使用 tools    |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------ | ----------------- |
| S1  | Customer chat (portal) | `apps/api/src/customer-portal/chat/chat.service.ts:338`                                                     | `streamText({ tools? })` | ✅ W48 起 8 条    |
| S2  | Listing generation     | `apps/api/src/listing/prompts/assemble-listing-prompt.ts:63-65` + `gemini-listing-generation.service.ts:92` | `generateObject`         | ❌（single-shot） |
| S2b | Walmart listing        | `apps/api/src/listing/prompts/assemble-walmart-en-prompt.ts`                                                | `generateObject`         | ❌                |
| S3  | Ad suggestions         | `apps/api/src/ad-suggestion/ad-suggestion.service.ts:633` (`SYSTEM_PROMPT`)                                 | GLM `generateJson`       | ❌                |
| S4  | FAQ generation         | `apps/api/src/ai/providers/faq-generation.service.ts:23`                                                    | `generateObject`         | ❌                |
| S5  | Path-A extract         | `apps/api/src/migration/path-a/prompt.ts`                                                                   | `generateText`           | ❌（ETL 管道）    |

> 前端 `apps/web` 没有自己的 system prompt 拼装位置 —— 全部经由 API 走以上 6 个 surface。已 grep 验证（`apps/web/lib/mock-data.ts` 仅是测试用占位）。

---

## 2. W48 末关键变更（驱动这次的 +1 分）

### 2.1 chat.service `systemPrompt` 升级（W48 ADR-012 §D5）

`apps/api/src/customer-portal/chat/chat.service.ts:338-354`：

```ts
const systemPrompt = [
  `You are a helpful customer support assistant for ${brandDisplayName}, a cross-border e-commerce brand.`,
  `Always respond in the language matching locale: ${locale}.`,
  customerSection, // ① W48 NEW: customerId / open tickets / recent orders
  `Your support scope: ...`,
  `Out of scope: ...`,
  `Escalation policy: ${hasOpenTickets ? 'has open tickets' : 'create ticket'}.`,
  toolSummary // ② W48 NEW: derived from registry, ADR-012 §D5
    ? `You have access to the following tools and SHOULD call them ...\n${toolSummary}`
    : 'You can answer questions but cannot take actions ...',
  faqContext ? `Relevant knowledge base entries:\n${faqContext}` : '...',
  'If you genuinely cannot answer ...',
].join('\n\n');
```

**两处改动直接拆掉 W45 v2 的扣分项**：

- ① `customerSection`（chat.service.ts:294-315）现在显式拼装：
  - **Logged-in customer ID**（强 IAM 注入）
  - **Open/active support tickets** 列表（每条带 ticketNo + subject + status）
  - **Recent order lookups (last 3)** 列表
  - 匿名分支退化为 `'Customer is browsing anonymously (not logged in).'`
- ② `toolSummary` 由 `describeCustomerChatTools(tools)` 从 8-tool 注册表反查派生（ADR-012 §D5），新增/移除 tool **无需** 改 prompt —— 满足 prompt-native 原则同时也补齐了 capabilities 注入。

### 2.2 W48 之前 vs W48 之后的 chat systemPrompt 对照（节选）

| 段落                    | W47 末（W46 audit 时态）                            | W48 末                                                                          |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| Identity                | ✅ "helpful customer support assistant for {brand}" | ✅ 同上                                                                         |
| **Capabilities**        | ❌ 完全不提工具                                     | ✅ "You have access to the following tools and SHOULD call them ..." + 8 项目录 |
| **Workspace - tickets** | ❌ 不在 prompt 中                                   | ✅ "Open/active support tickets:\n - [TKT-123] Refund request (open)"           |
| **Workspace - orders**  | ❌ 不在 prompt 中                                   | ✅ "Recent order lookups (last 3):\n - Order #ABC-001: shipped"                 |
| **User identity**       | ⚠️ 仅当用户登录时由 LLM 推断                        | ✅ "Logged-in customer ID: {customerId}" 或 "browsing anonymously" 二分         |
| FAQ resources           | ✅ 已有                                             | ✅ 同上                                                                         |

---

## 3. 维度细评（10 个标准维度 × 6 surface）

**图例**: ✅ Strong（结构化 + 动态 + 完整）/ ⚠️ Weak（提及但单一/静态）/ ❌ Missing / ─ N/A（surface 模型不需要该维度）

| #   | 维度                               | S1 Chat     | S2 Listing                        | S3 Ads | S4 FAQ | S5 Path-A | 系统级        |
| --- | ---------------------------------- | ----------- | --------------------------------- | ------ | ------ | --------- | ------------- |
| 1   | Identity（人设/角色）              | ✅          | ✅                                | ✅     | ✅     | ✅        | ✅            |
| 2   | Available capabilities（工具清单） | ✅ **W48**  | ─                                 | ─      | ─      | ─         | **✅**        |
| 3   | User identity / IAM                | ✅ **W48**  | ❌                                | ❌     | ❌     | ─         | ⚠️            |
| 4   | Workspace state                    | ✅ **W48**  | ✅                                | ✅     | ✅     | ❌        | ✅            |
| 5   | Recent activity                    | ✅ **W48**  | ⚠️                                | ✅     | ❌     | ─         | ✅            |
| 6   | Available resources                | ✅ FAQ      | ✅ brand voice/lexicon/competitor | ⚠️     | ❌     | ❌        | ✅            |
| 7   | User preferences/settings          | ⚠️ locale   | ⚠️ locale/platform                | ❌     | ❌     | ─         | ⚠️            |
| 8   | Session history                    | ✅ messages | ─                                 | ─      | ─      | ─         | ✅（仅 Chat） |
| 9   | Domain terminology                 | ✅          | ✅                                | ⚠️     | ⚠️     | ✅        | ✅            |
| 10  | Current task                       | ✅          | ✅                                | ✅     | ✅     | ✅        | ✅            |

**系统级得分**：每维度只要有任一 surface 命中至少 Weak 即记 1 分。

得分清单：1✅ 2✅ 3⚠️ 4✅ 5✅ 6✅ 7⚠️ 8✅ 9✅ 10✅ → **9/10 (90%)**

---

## 4. W45 v2 扣分项关闭情况

W45 v2 §4 标定的 2 条扣分原因：

| 原扣分                                               | W45 v2 状态 | W48 末状态                                                                                               | 关闭?         |
| ---------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- | ------------- |
| **#2 工具清单缺失（Listing copilot / Chat 都没有）** | ❌ Missing  | ✅ Chat strong（toolSummary 派生）；Listing copilot 因 single-shot 不需要 tools，故 **N/A** 而非 Missing | ✅ **关闭**   |
| **#3 用户/IAM 多租户上下文不一致**                   | ⚠️ Weak     | ⚠️ Weak（chat 强；admin surfaces 仍未注入 operator userId/role）                                         | ❌ **未关闭** |

#2 关闭后系统级得分 +1 → 9/10。

#3 在 chat surface **已升级到 Strong**，但 4 个 admin surface（Listing / Ads / FAQ / Path-A）依然不会把运营者 userId/role 注入提示词。这在 4 个 surface 都是 single-shot 数据生成的语境下并非硬伤（IAM 校验在 controller 层、AiCallLog 已写）；但若 W50/W51 引入 admin chat 助手（`/help` 助手计划），#3 必须升级到 Strong 才能闭合最后 1 分到 10/10。

---

## 5. 与其他维度的相互验证

跨维度核对，确认本次评分内部一致：

- 与 [W48 Action Parity audit](./2026-05-W48-action-parity-single-audit.md) 一致：8 条 customer chat tool 都被 `streamText` 真实挂载 → toolSummary 不是空 stub；
- 与 [`docs/briefs/2026-05-W49-leadership-sync.md`](../briefs/2026-05-W49-leadership-sync.md) 一致：3 条 KPI metric 已落地 → 工具调用真实可观测，意味着 prompt 里"SHOULD call them when intent matches"是有反馈闭环的指令；
- 与 [W45 v2 forecast §12](./2026-05-W45-agent-native-audit-v2.md#12-w52-v3-验收预期) 一致：原预测 W52 末达到 9/10 (90%)，**实际 W48 末已达成**，提前 4 周。

---

## 6. 剩余 1/10 缺口（路线）

要把 9/10 推到 10/10，唯一硬路径是关闭 **#3 admin surface User identity / IAM 注入**。

最小成本方案（已写入 W50 plan）：

| 触发场景                                    | 注入字段                                                                                       | 工作量                                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| W50 P2-B-1 `/help` 页面引入 admin chat 助手 | `Operator: ${user.email} (role=${user.role}, brand=${user.brandId})` 拼入 system prompt        | 0.25 人日（与 admin chat 助手开发合并）                                                                   |
| Listing generation 注入 operator            | `Operator (audit): ${user.id} role=${user.role}` —— 数据生成阶段不影响输出，只是审计可读性提升 | 0.1 人日                                                                                                  |
| Ad suggestion 注入 operator + budget        | `Operator: ...                                                                                 | Today's spend: $X / budget $Y / ACOS target ${pref.acosTarget}` —— 同时升级 #7 user preferences 到 Strong | 0.5 人日（依赖 settings 层暴露 ACOS/budget 偏好） |

> **建议**：仅做前两条（0.35 人日），第三条等 settings 层暴露后再做。前两条单独做不足以把 #7 升级，但能把 #3 升级到 Strong → **W50 末若实施则 Context Injection 可推到 10/10**。

---

## 7. 风险登记（Context Injection 视角）

| 风险                                                                 | 监控点                                                                 | 兜底      |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------- |
| `customerSection` 拼装失败导致 prompt 变成 anonymous 兜底            | chat.service.ts:286 `.catch(() => [])` 已兜底 → 数据缺失时退化为空列表 | 已有      |
| `toolSummary` 派生时漏 tool（例如新增 tool 但忘记导出）              | `describeCustomerChatTools` 直接遍历 registry → 不会漏                 | 设计已防  |
| Prompt 长度超 model context window（chat 现在 systemPrompt ~ 1.5KB） | Gemini 2.5 Flash 1M context → 远未触顶                                 | N/A       |
| 新增 admin chat 助手时复制 chat.service 模板但忘了 #3                | 加 lint rule / template ADR                                            | 待 W50 落 |

---

## 8. 决策与下一步

1. ✅ **Context Injection 维度提前达成 W52 v3 forecast** —— 不需要 W52 重审计前再投入。
2. 🤔 **W50 落 admin chat 助手时**，把 operator identity 注入作为模板默认行为（而不是 W50 后才补救）。
3. 🤔 **W52 v3 重审计**直接复用本份 §3 矩阵，预期可推到 10/10（如果 W50 admin 助手按本审计 §6 落地）。

---

## 9. 与上一版 audit 的差异对照

| 文件                                                        | 时间      | Context Injection score | 关键变更                         |
| ----------------------------------------------------------- | --------- | ----------------------- | -------------------------------- |
| `agent-native-design-audit.md`                              | S1 设计层 | 4/9 (44%)               | 仅设计文档枚举，无代码           |
| `2026-05-W45-agent-native-audit-v2.md`                      | W45 末    | 8/10 (80%)              | 实施层量化，缺 #2 #3             |
| `2026-05-W46-action-parity-single-audit.md`                 | W46 末    | —                       | 单维 Action Parity，未触 Context |
| `2026-05-W48-action-parity-single-audit.md`                 | W48 末    | —                       | 单维 Action Parity，未触 Context |
| **`2026-05-W48-context-injection-single-audit.md`**（本份） | W48 末    | **9/10 (90%)**          | **#2 关闭、#4/#5 强化**          |

---

_审计版本：1.0 | 与 W48 Action Parity audit 共同构成 W49 灰度首日发布的"上下文 + 行为"双维度准入。_
