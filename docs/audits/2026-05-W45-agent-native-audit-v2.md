# yaemartOS Agent-Native 架构审计 v2（实施层）

> **审计日期**：2026-05-04（标记为 W45 末，作为 W46 前置依据）
> **审计版本**：S4 W43–W45（广告闸门 + 建议执行 V1 完成后；88 个 MCP 工具、19 个 controller、24 个 Prisma model）
> **审计类型**：**实施层全量审计**（与 2026-04-30 设计层审计 `agent-native-design-audit.md` 形成 before/after 对照）
> **方法**：并行派发 8 个 explore subagent，每个聚焦一条原则，逐文件枚举 + 评分
> **复审节奏**：W52 末再跑一次（与 v2 plan §10 DoD 对齐）+ S5 W65 末（4 品牌全量上线后）
> **接下来动作**：触发 [`docs/plans/2026-05-04-004-agent-native-improvements-v2-plan.md`](../plans/2026-05-04-004-agent-native-improvements-v2-plan.md)（scope-cut 版），W46–W52 内修复 P0/P1/P2

---

## 0. 总评分汇总（实施层 vs 设计层 v1）

| 编号 | 核心原则               | v1 设计层 (2026-04-30) | v2 实施层 (本次) | Δ         | 状态    |
| ---- | ---------------------- | ---------------------- | ---------------- | --------- | ------- |
| 1    | Action Parity          | 12/16 (75%)            | **24/26 (92%)**  | **+17pp** | ✅ 优   |
| 2    | Tools as Primitives    | 5/8 (63%)              | **87/91 (96%)**  | **+33pp** | ✅ 优   |
| 3    | Context Injection      | 4/9 (44%)              | **8/10 (80%)**   | **+36pp** | ✅ 优   |
| 4    | Shared Workspace       | 7/8 (88%)              | **20/22 (91%)**  | +3pp      | ✅ 优   |
| 5    | CRUD Completeness      | 8/12 (67%)             | **7/21 (33%)**   | **−34pp** | ❌ 待改 |
| 6    | UI Integration         | 3/6 (50%)              | **1/29 (3%)**    | **−47pp** | ❌ 待改 |
| 7    | Capability Discovery   | 1/7 (14%)              | **3/7 (43%)**    | +29pp     | ❌ 待改 |
| 8    | Prompt-Native Features | 5/8 (63%)              | **3/8 (38%)**    | **−25pp** | ❌ 待改 |

**综合 Agent-Native 实施成熟度：59.4%（⚠️ 部分合规，**核心架构已立但协作面短板严重**）**

### 状态图例

- ✅ 优秀（≥ 80%）
- ⚠️ 部分（50–79%）
- ❌ 待改（< 50%）

---

## 1. 分母方法论说明（关键）

> v1 与 v2 的评分分母不同，**不是退化，是评分粒度细化**。下表说明每条原则分母从设计层（小数）到实施层（大数）的扩展路径。

| 原则                   | v1 分母 | v2 分母 | 分母含义解释                                                                                                                                                               |
| ---------------------- | ------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action Parity          | 16      | **26**  | v1：16 个**计划性**用户操作（设计文档枚举）。v2：9 个 `apps/web/lib/api/*-client.ts` 中**实际可触发的状态变更**导出函数总数（剔除纯只读拉数）。粒度细化但代码 ground truth |
| Tools as Primitives    | 8       | **91**  | v1：8 个**示例**工具（ADR-005 §2.4 列举）。v2：实际登记的 88 个 `YAEMARTOS_TOOL_DESCRIPTORS` + 3 个 `LINGXING_TOOL_DESCRIPTORS`                                            |
| Context Injection      | 9       | **10**  | v1：9 类计划注入（设计文档清单）。v2：10 类规范注入维度（identity / capabilities / user / workspace / recent / resources / preferences / session / domain / task）         |
| Shared Workspace       | 8       | **22**  | v1：8 个核心计划实体。v2：24 个实际 Prisma model 中的 22 个有写路径的（剔除 `AuditLog` / `AiCallLog` 两个纯审计 sink）                                                     |
| CRUD Completeness      | 12      | **21**  | v1：12 个核心计划实体。v2：实际 24 个 Prisma model 中除 `AuditLog` / `AiCallLog` / `RefreshToken` 之外的 21 个面向业务实体                                                 |
| UI Integration         | 6       | **29**  | v1：6 个**示例**用户路径（设计层猜测）。v2：47 个登记的 mutation tool 减去 18 个无前台/N/A 的纯后端工具 = 29 个**实际**应有 UI 反馈的 mutation 路径                        |
| Capability Discovery   | 7       | **7**   | 7 个标准 discovery 机制（onboarding / docs / 提示 / 自述 / 建议 prompt / 空状态 / slash），分母不变；分子从 1 → 3                                                          |
| Prompt-Native Features | 8       | **8**   | 8 个实际 AI 链路（listing / batch listing / FAQ / ad suggestion / chat / embeddings / similarity / path-A migration），分母不变；分子从 5 → 3                              |

### 分子退化的两个原则解释

- **CRUD 5/12 → 7/21**：分母从 12 → 21 暴露了 9 个 v1 设计未审视的实体（Invitation / Article / Platform / AuthAccount 等）；分子虽然 +2，但比例下降。**这不是回退，是发现新缺口**。
- **UI 3/6 → 1/29**：分母从 6 → 29 暴露了 23 个 v1 设计未审视的写路径。仅 `import-job-progress.tsx` 的 3s 轮询保留下来。**这是设计层乐观估计 vs 实施层实际的差距**。
- **Prompt-Native 5/8 → 3/8**：分母不变；评判更严：v1 把"使用 LLM 即算 prompt-native"，v2 改用"业务决策是否在 prompt 而非 TS 代码里"——只有 listing/path-A/FAQ 算混合（HYBRID, 0.5×3=1.5），ad suggestion 因 `ACOS_BREACH_THRESHOLD` 等阈值在 TS 算 HYBRID, embeddings/similarity 算 CODE-DEFINED。

---

## 2. 原则 1：Action Parity（24/26 = 92%）

### 评分依据

逐文件审视 9 个 web client (`apps/web/lib/api/*-client.ts`)，统计每个**可触发状态变更**的导出函数（剔除纯只读 fetch）。结果：

| Web Client                | 状态变更导出 | 有 agent 工具   | 缺口                                             |
| ------------------------- | ------------ | --------------- | ------------------------------------------------ |
| `auth-client.ts`          | 2            | 0               | `login` / `refreshTokens`                        |
| `settings-client.ts`      | 4            | 4               | —                                                |
| `shop-client.ts`          | 3            | 3               | —                                                |
| `ad-suggestion-client.ts` | 4            | 4               | —                                                |
| `migration-client.ts`     | 1            | 1               | —                                                |
| `ai-mcp-client.ts`        | 3            | 1 + 2 ⚠️partial | TS 类型与 controller body 分叉                   |
| `listing-client.ts`       | 4            | 4               | —                                                |
| `catalog-client.ts`       | 5            | 2 + 3 ⚠️partial | DTO 字段与工具描述符分叉                         |
| `ad-dashboard-client.ts`  | 0            | —               | （`triggerAdSync` 工具有，但 web client 未封装） |

**分子 24** = 完全 ✅ + 部分 ⚠️ 计入；**分母 26**（剔除 login / refreshTokens 这种 agent 不该接管的认证流）。

### 缺口（可在 v2 plan P1-D 关闭）

- `POST /upload`（multipart）→ 无工具 → **推 S5**
- `POST /search/bootstrap` → 无工具 → P1-D 补
- `POST /search/keywords/import` → 无工具 → P1-D 补
- `triggerAdSync` 无 web 封装 → P1-D 补
- `ai-mcp-client` 类型与 controller body 分叉 → P1-D 修齐

---

## 3. 原则 2：Tools as Primitives（87/91 = 96%）

### 评分依据

逐工具读 88 个 `YAEMARTOS_TOOL_DESCRIPTORS` + 3 个 `LINGXING_TOOL_DESCRIPTORS`，每个分类为：

- **PRIMITIVE**（82 个）：单一职责，`listX` / `getX` / `createX` / `updateX` / `deleteX` / `recordMetric` 等
- **BORDERLINE**（5 个）：`activateListingVersion`、`triggerPathAImport`、`executeAdSuggestion`、`rollbackAdChange`、`getProductManual`——有意为之的原子事务或安全门控
- **WORKFLOW**（4 个）：`generateListingDraft`（多步编排：拉 listing + flag + 术语 + 历史 → AI → 写草稿）、`batchGenerateListings`（笛卡尔积 + 并行）、`generateAdSuggestions`（breach 过滤 + 排序 + GLM + 校验持久化）、`generateProductFaq`（生成 + ensureIndex + 写 ES）

**分子 87** = PRIMITIVE 82 + BORDERLINE 5（视为可接受）；**分母 91**。

### 主要可改进 WORKFLOW

`generateAdSuggestions` 是最严重的 WORKFLOW，但**已知道**——v2 plan 原 P1-A 拟拆为：`getCampaignMetrics` + `filterCampaignsByPolicy` + `generateAdSuggestionPayload` + `persistAdSuggestions`。但因 product 风险（损钱），整体推 S5 prompt 模板 DB 化合并。

---

## 4. 原则 3：Context Injection（8/10 = 80%）

### 评分依据

10 个标准 context 注入维度逐一在所有 system prompt 站点（chat.service / glm-generation / faq-generation / ad-suggestion / listing prompts / path-a prompt）核对：

| #   | 维度                                 | 注入?                             | 强度        |
| --- | ------------------------------------ | --------------------------------- | ----------- |
| 1   | Identity（人设/角色）                | ✅                                | Strong      |
| 2   | Available capabilities（工具清单）   | ❌                                | Missing     |
| 3   | User identity（运营者 ID/IAM）       | ⚠️                                | Weak        |
| 4   | Workspace state（当前 listing/草稿） | ✅（Listing 强、Chat 中、广告弱） | Strong–Weak |
| 5   | Recent activity                      | ⚠️                                | Weak        |
| 6   | Available resources                  | ✅                                | Strong      |
| 7   | User preferences/settings            | ⚠️                                | Weak        |
| 8   | Session history                      | ✅（仅 Chat）                     | Weak        |
| 9   | Domain terminology                   | ✅（Listing 强、Chat 中）         | Strong      |
| 10  | Current task                         | ✅                                | Strong      |

**分子 8**（至少 Weak 算 1 分），扣分项：**#2 工具清单缺失**（Listing copilot / Chat 都没有）+ **#3 用户/IAM 多租户上下文不一致**。

### 关闭路径

v2 plan **P1-B-mod** 关闭 #2 + 修齐 #3 部分。

---

## 5. 原则 4：Shared Workspace（20/22 = 91%）

### 评分依据

24 个 Prisma model 中除 `AuditLog`、`AiCallLog` 两个纯审计 sink 外的 22 个：

- **SHARED（同行共享）**：20 个，包括 Listing/ListingVersion/Product/Category/Shop/AdSuggestion/AdChange/AdDailyStat/Brand/Market/Locale/TerminologyEntry/SystemConfig/Metric/Article/Platform/User/Invitation/AuthAccount/RefreshToken
- **N/A 或暂无写**：2 个（Article、Platform 应用层无运行时写）

**关键证据**：

- 全仓库 `_agent` / `_ai` / `_draft_only` 表名搜索 0 命中
- 全仓库 `where: { authorType: 'AGENT' }` 搜索 0 命中
- Listing AI 草稿写 `createDraftVersion()` 强制 `ListingVersionStatus.draft`，激活只能走 `activateVersion()`——agent 与人共享同一 `ListingVersion` 行，状态机门控（教科书级实现）
- AdSuggestion / AdChange：web client 与 agent 工具都打到同一 `/ads/suggestions/...` 控制器

**唯一减分**：审计 observability gap——以下写路径未走 `AuditService.logWrite`：

- `AdSuggestionService.generate()` `createMany`（execute/reject/rollback 有审计）
- `TerminologyService` 整个未注入 `AuditService`
- `SettingsService` feature flag / AI routing / brand theme 写入无审计
- `MetricController.record` 无审计

→ v2 plan **P1-C** 关闭这 4 项。

---

## 6. 原则 5：CRUD Completeness（7/21 = 33%）

### 评分依据

21 个面向业务实体逐个审视 4 操作（Create / Read / Update / Delete）：

| 实体                     | C   | R   | U   | D   | 评分  |
| ------------------------ | --- | --- | --- | --- | ----- |
| **完整 CRUD（7 个）**    |     |     |     |     |       |
| Category                 | ✅  | ✅  | ✅  | ✅  | 100%  |
| Product                  | ✅  | ✅  | ✅  | ✅  | 100%  |
| Market                   | ✅  | ✅  | ✅  | ✅  | 100%  |
| ShopBinding              | ✅  | ✅  | ✅  | ✅  | 100%  |
| AdSuggestion             | ✅  | ✅  | ✅  | ⚪  | 100%  |
| Listing                  | ✅  | ✅  | ✅  | ✅  | 100%  |
| TerminologyEntry         | ✅  | ✅  | ✅  | ✅  | 100%  |
| **不完整（其余 14 个）** |     |     |     |     |       |
| User                     | ⚪  | ❌  | ❌  | ⚪  | 0%    |
| Brand                    | ⚪  | ⚠️  | ✅  | ⚪  | 75%   |
| Invitation               | ❌  | ❌  | ❌  | ⚪  | 0%    |
| AuthAccount              | ⚪  | ⚪  | ⚪  | ⚪  | N/A   |
| CategoryContentTemplate  | ✅  | ⚠️  | ✅  | ❌  | 62.5% |
| ProductContent           | ✅  | ❌  | ✅  | ❌  | 50%   |
| Locale                   | ✅  | ⚠️  | ✅  | ✅  | 87.5% |
| Article                  | ❌  | ❌  | ❌  | ❌  | 0%    |
| Platform                 | ⚪  | ❌  | ⚪  | ⚪  | N/A   |
| Shop                     | ✅  | ✅  | ❌  | ✅  | 75%   |
| AdDailyStat              | ⚪  | ⚠️  | ⚪  | ⚪  | 50%   |
| AdChange                 | ⚪  | ⚠️  | ✅  | ⚪  | 75%   |
| ListingVersion           | ✅  | ⚠️  | ✅  | ⚪  | 83%   |
| SystemConfig             | ⚪  | ⚠️  | ✅  | ⚪  | 75%   |
| Metric                   | ✅  | ⚠️  | ⚪  | ⚪  | 75%   |

**分子 7** = 完整 CRUD 实体数；**分母 21**。

### 关闭路径

v2 plan **P2-A 缩水版**：仅做 4 项有 agent 用例的——`updateShop`、`getListingVersion`、`getAdChange`、`getLocale`。

不做（YAGNI）：`getBrand`、`getMetric`、`getProductContent`。

不做（by design）：User / Invitation / Article / Platform / AuthAccount——分母分子均不动，scope-guardian 推荐保留这种诚实的低分。

---

## 7. 原则 6：UI Integration（1/29 = 3%）⭐ 最严重

### 评分依据

47 个登记的 mutation tool 减去 18 个 N/A（无前台/无 UI 意图）= 29 个**应有 UI 反馈**的写路径。逐个验证 agent 写入是否在 5s 内反映到 UI：

| Tool                 | UI Page                                  | 机制                                             | Verdict                    |
| -------------------- | ---------------------------------------- | ------------------------------------------------ | -------------------------- |
| `triggerPathAImport` | `/migration`                             | `setInterval(3s)` 轮询                           | ✅ Immediate               |
| 其他 28 个           | listing 编辑 / 广告 / 店铺 / settings 等 | router.refresh / 局部 setState（仅用户操作触发） | ⚠️ Manual refresh required |

**分子 1**；**分母 29**。

### 全仓库探索结果

- `revalidatePath` / `revalidateTag` → 0 命中
- SWR / React Query → 0 命中
- EventSource / WebSocket / subscribe → 0 命中（业务面）
- 仅 `import-job-progress.tsx:102-114` 有 3s 短轮询

### 关闭路径

v2 plan **P0** 全套（SSE + TanStack Query + cookie-based JWT + Redis pub/sub + feature flag）。

---

## 8. 原则 7：Capability Discovery（3/7 = 43%）

### 评分依据

7 个标准 discovery 机制：

| #   | 机制                       | 现状                                                      | 强度                         |
| --- | -------------------------- | --------------------------------------------------------- | ---------------------------- |
| 1   | Onboarding flow            | ❌ 无                                                     | Absent                       |
| 2   | Help / docs 页面           | ❌ 假链接（`admin-sidebar.tsx:152-158` 指向 `/settings`） | Absent（且**主动伤害信任**） |
| 3   | In-UI 能力提示             | ✅ Listing copilot 中等，门户 hero 弱                     | Weak–Moderate                |
| 4   | Agent 自述（工具清单注入） | ❌ 无                                                     | Absent                       |
| 5   | 建议 Prompt / 快捷操作     | ✅ Listing copilot ActionButton 行                        | Moderate                     |
| 6   | 空状态引导                 | ⚠️ Listing 列表有 AI 引导，其他模块（产品/品类）没有      | Weak                         |
| 7   | Slash 命令                 | ❌ 无                                                     | Absent                       |

**分子 3**（#3 + #5 + #6 至少 Weak）；**分母 7**。

### 关闭路径

v2 plan：

- **P0 §4**：先把假"帮助文档"链接止血（W46 day 1，0.5 人日）
- **P2-B-1 /help** 页：W50，1 人日
- **P2-C 空状态 + 埋点**：W51，1 人日（带 PostHog 信号收集）
- **不做** onboarding tour（推 S5，由 P2-C 埋点决定是否启动）
- **不做** slash command（推 S5 chat agent 同期）

---

## 9. 原则 8：Prompt-Native Features（3/8 = 38%）

### 评分依据

8 个实际 AI 链路逐个分类：

| #   | 特性                        | 类型            | 改行为需要改                                      |
| --- | --------------------------- | --------------- | ------------------------------------------------- |
| 1   | Listing draft generation    | HYBRID（0.5）   | `listing/prompts/*.ts` + assembler 代码           |
| 2   | Batch listing generation    | HYBRID（0.5）   | 同 #1 + 编排代码                                  |
| 3   | FAQ generation              | HYBRID（0.5）   | `faq-generation.service.ts` 内 prompt 字符串      |
| 4   | Ad suggestion generation    | HYBRID（0.5）⭐ | TS 阈值常量 + prompt 字符串（**触发条件硬编码**） |
| 5   | Customer-portal chat        | HYBRID（0.5）   | `chat.service.ts:252-263` 字符串 + 召回参数       |
| 6   | Embeddings + FAQ kNN        | CODE-DEFINED    | TS k 值与 OpenSearch DSL                          |
| 7   | Listing title similarity    | CODE-DEFINED    | TS 矩阵计算                                       |
| 8   | Path-A migration extraction | HYBRID（0.5）   | `migration/path-a/prompt.ts`                      |

**分子 3**（HYBRID 6 × 0.5 = 3）；**分母 8**。

### 关闭路径（已推 S5）

v2 plan **不动**这条原则。S5 prompt 模板 DB 化大计划统一处理：

- 抽 `apps/api/src/**/prompts/` 为统一目录
- `SystemConfig.prompt.*` 命名空间；运行时 60s TTL 缓存
- 广告建议特例：先迁阈值到 DB，但**必须**先解决 product 风险（损钱护栏）

---

## 10. 关键缺口热力图

> 三块同时拉低整体分数的横切短板：

| 短板                                        | 原则              | 严重度         | 修复路径                                          |
| ------------------------------------------- | ----------------- | -------------- | ------------------------------------------------- |
| **协作面**（agent 写入对 UI 不可见）        | UI Integration 3% | P0             | v2 plan P0（SSE + TanStack Query + 4 项架构 ADR） |
| **业务策略硬编码**（广告 breach 阈值在 TS） | Prompt-Native 38% | P0（产品风险） | **推 S5**，先做最小数据保护与方向性 sanity guard  |
| **能力发现**                                | Discovery 43%     | P1             | v2 plan P2-B-1 /help + P2-C 埋点                  |

---

## 11. 与 v1（设计层）审计的方法论关系

| 维度     | v1 (2026-04-30)                 | v2 (2026-05-04)                                      |
| -------- | ------------------------------- | ---------------------------------------------------- |
| 审计对象 | 实施方案 + 8 份 ADR（无代码）   | 88 个工具 + 19 个 controller + 24 个 model（有代码） |
| 评分粒度 | 按计划维度（小数：6/8/9/12/16） | 按实施实体（大数：7/8/10/22/26/29）                  |
| 数据来源 | 设计文档枚举                    | 文件遍历 + grep + 结构枚举                           |
| 评判     | 看"是否设计了"                  | 看"是否真的工作"                                     |
| 偏差风险 | 设计层乐观                      | 实施层暴露真实差距                                   |

**结论**：v1 → v2 不是评分回退，是**evaluation rigor 的提升**。综合分从 56% → 59.4% 表面上接近，但底层 dimensional shift 揭示了 3 个新问题：

1. UI Integration 大幅恶化（50% → 3%）：v1 设想的"AI 写入立即反映"在实施层完全没落地
2. CRUD 比例下降（67% → 33%）：v1 只审计 12 个核心实体，v2 实际有 24 个，9 个未审视的实体全部为空
3. Prompt-Native 比例下降（63% → 38%）：v1 把"使用 LLM"算 prompt-native，v2 严格区分"决策位置"

---

## 12. 行动事项（指向 v2 plan）

| 短板                            | 关联 v2 plan 章节      | W46–W52 工时   |
| ------------------------------- | ---------------------- | -------------- |
| UI Integration 3%               | P0 (§3) + P0 旁支 (§4) | 7.5 人日       |
| Context Injection 工具清单缺失  | P1-B-mod (§5)          | 2 人日         |
| Shared Workspace 审计 gap       | P1-C (§5)              | 1 人日         |
| Action Parity 5 个缺口          | P1-D (§5)              | 0.75 人日      |
| CRUD 4 个有用例缺口             | P2-A (§6)              | 1 人日         |
| Discovery 假链接 + /help + 埋点 | P2-B-1 + P2-C (§6)     | 2 人日         |
| **小计**                        | —                      | **14.25 人日** |

W52 末再跑 `/ce-agent-native-audit` 产出 v3 dump，与本份对照，验证：

- UI Integration 1/29 → 18/29 (62%)
- Action Parity 24/26 → 25/26 (96%)
- Context Injection 8/10 → 9/10 (90%)
- Shared Workspace 20/22 → 22/22 (100%)
- CRUD 7/21 → 11/21 (52%)
- Discovery 3/7 → 4/7 (57%)
- **Overall ~70%**

---

## 13. 参考链接

- [v2 改进计划（scope-cut）](../plans/2026-05-04-004-agent-native-improvements-v2-plan.md)
- [v1 改进计划（已部分完成）](../plans/2026-05-04-002-agent-native-improvements-plan.md)
- [v1 设计层审计（before）](./agent-native-design-audit.md)
- [yaemartOS Implementation Plan §9 S4](../yaemartOS-implementation-plan.md)
- ADR-005 AI Services / ADR-006 IAM Casbin / ADR-010 Shop Agent Parity / ADR-011 实时同步策略（W46 新增）
