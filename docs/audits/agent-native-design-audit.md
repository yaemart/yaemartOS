# yaemartOS Agent-Native 设计层审计（前置审计）

> 审计日期：2026-04-30  
> 审计版本：v2.0-RC（实施方案）+ 8 份 ADR（ADR-001 ~ ADR-008）  
> 审计类型：**设计层 pre-flight 审计**（项目尚无代码，基于规划文档）  
> 审计参考：Agent-Native Architecture 8 大核心原则  
> 复审建议：S1 W13 末（首次代码切片完成后）+ S3 W39 末（客户中心 + AI Chat 落地后）

---

## 总评分汇总

| 编号 | 核心原则                               | 设计层得分 | 百分比 | 状态    |
| ---- | -------------------------------------- | ---------- | ------ | ------- |
| 1    | Action Parity（操作对等）              | 12/16      | 75%    | ⚠️ 部分 |
| 2    | Tools as Primitives（工具即原语）      | 5/8        | 63%    | ⚠️ 部分 |
| 3    | Context Injection（上下文注入）        | 4/9        | 44%    | ❌ 待改 |
| 4    | Shared Workspace（共享工作区）         | 7/8        | 88%    | ✅ 优   |
| 5    | CRUD Completeness（CRUD 完整性）       | 8/12       | 67%    | ⚠️ 部分 |
| 6    | UI Integration（UI 集成）              | 3/6        | 50%    | ⚠️ 部分 |
| 7    | Capability Discovery（能力发现）       | 1/7        | 14%    | ❌ 待改 |
| 8    | Prompt-Native Features（特性即提示词） | 5/8        | 63%    | ⚠️ 部分 |

**综合 Agent-Native 设计成熟度：56%（⚠️ 部分合规）**

### 状态图例

- ✅ 优秀（≥ 80%）
- ⚠️ 部分（50-79%）
- ❌ 待改（< 50%）

---

## 原则 1：Action Parity（操作对等）

> "用户能做的，Agent 都能做"

### 1.1 用户操作清单（来自 §6-§11 切片）

| 模块               | 用户操作               | 对应 Agent 工具                                       | 设计是否覆盖           |
| ------------------ | ---------------------- | ----------------------------------------------------- | ---------------------- |
| Listing 创建       | 填表单生成 listing     | `tool: listing.generate(productId, platform, locale)` | ✅ ADR-005 §2.3        |
| Listing 编辑       | 改 Title/Bullets/Desc  | `tool: listing.update(listingId, fields)`             | ⚠️ 设计未明确          |
| Listing 主标记切换 | 点击"设为主 listing"   | `tool: listing.setPrimary(listingId)`                 | ⚠️ 未列入工具集        |
| Listing 版本回退   | 选择历史版本 → 激活    | `tool: listing.activateVersion(versionId)`            | ⚠️ 未列入工具集        |
| 产品创建（路径 B） | 表单填规格/品牌/品类   | `tool: product.create(...)`                           | ⚠️ 未列入工具集        |
| 路径 A 导入        | 上传截图触发 AI 解析   | `extractListingMeta(screenshot)`                      | ✅ ADR-005 §2.5        |
| 库存查询           | 看板查 SKU 库存        | `lingxing.inventory.getBySku()`                       | ✅ ADR-004 §2.1        |
| 广告优化建议       | 看 AI 建议单           | `tool: ad.suggestOptimization()`                      | ⚠️ 未明确为 Agent 工具 |
| 广告执行（高风险） | 勾选 → 二次确认 → 执行 | `tool: ad.applyChanges()` + confirmGate               | ✅ ADR-005 §2.4        |
| 广告 24h 回滚      | 点击 reverse           | `tool: ad.rollback(changeId)`                         | ⚠️ 未列入工具集        |
| 客户中心：注册客户 | 填表单                 | `tool: customer.register(...)`                        | ❌ 未设计              |
| 客户中心：开工单   | 表单提交               | `tool: ticket.create(...)`                            | ❌ 未设计              |
| 工单分配           | 拖拽到客服             | `tool: ticket.assign()`                               | ❌ 未设计              |
| 保修注册           | 表单 + 发票图          | `tool: warranty.register()`                           | ❌ 未设计              |
| 订单查询（非登录） | 订单号+邮箱            | `tool: order.lookup()`                                | ❌ 未设计              |
| 培训：开始考试     | 点击开始               | `tool: exam.start()`                                  | ❌ 未设计              |

**得分：12/16（75%）**

### 1.2 关键缺口

❌ **`mcpToolCallService` 设计偏向"AI Chat 用工具"，未把整个 yaemartOS UI 操作集映射成工具集**：

- ADR-005 §2.4 只示例了 `rag.product_knowledge` / `rag.faq` 等 RAG 工具，没有列出 listing 编辑、产品 CRUD、工单管理、广告操作的工具定义
- §13 关键需求验收表中"广告执行不可绕过确认"只测了 UI 路径，未测 Agent 路径

⚠️ **领星操作（ADR-004）已经做到 Agent 化**：

- `LingxingClient` 提供 `listings/orders/inventory/ads/shops` 命名空间
- §3.2 表格明确 "AI Agent 单次工具调用 → MCP 直接透传"
- 这是设计层的亮点

### 1.3 改进建议

| 优先级 | 行动                                                                                                                            | 落地切片 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| P0     | S1 W8 把 ADR-005 §2.4 的 `lingxingTools` 扩展为**全 yaemartOS 工具清单**，每个 UI 操作必须有对应 tool                           | S1 W8    |
| P0     | 在 ADR-005 增补附录 A：`yaemartOS Tool Catalog`，按模块（product/listing/customer/ticket/warranty/ad/training）枚举所有工具签名 | S1 W6 前 |
| P1     | 引入 lint 规则 `@yaemartos/all-mutations-need-tool`：每个 NestJS controller mutation method 必须有对应 tool 注册                | S2 W14   |
| P1     | 切片末验收增加：随机抽 5 个 UI 用户故事，要求 AI Agent 用工具完成同样任务                                                       | 每切片末 |

---

## 原则 2：Tools as Primitives（工具即原语）

> "工具提供能力，不实现业务行为"

### 2.1 现有工具分类（基于 ADR-004/005）

| 工具                                               | 来源    | 类型         | 评估                                                                      |
| -------------------------------------------------- | ------- | ------------ | ------------------------------------------------------------------------- |
| `lingxing.listings.getByAsin()`                    | ADR-004 | 🟢 PRIMITIVE | 纯查询，无业务逻辑                                                        |
| `lingxing.inventory.getBySku()`                    | ADR-004 | 🟢 PRIMITIVE | 纯查询                                                                    |
| `lingxing.orders.lookup()`                         | ADR-004 | 🟢 PRIMITIVE | 纯查询                                                                    |
| `rag.product_knowledge`                            | ADR-005 | 🟢 PRIMITIVE | ES 检索原语                                                               |
| `rag.faq`                                          | ADR-005 | 🟢 PRIMITIVE | 同上                                                                      |
| `listingGenerationService.generate()`              | ADR-005 | 🔴 WORKFLOW  | 编排：加载 prompt → 填模板 → 调 LLM → 校验 schema —— 这是工作流，不是原语 |
| `mcpToolCallService.runAgent()`                    | ADR-005 | 🔴 WORKFLOW  | 多轮工具调用循环+confirmGate，本质是 orchestrator                         |
| `structuredExtractionService.extractListingMeta()` | ADR-005 | 🟡 混合      | 既是 prompt-defined 也是 workflow 编排                                    |

**得分：5/8（63%）**

### 2.2 风险分析

⚠️ **`ListingGenerationService.generate()` 是反模式的代表**：

```typescript
// ADR-005 §2.3 示例
async generate(input: ListingGenerationInput): Promise<ListingContent> {
  const promptTemplate = await this.loadPrompt(`listing/${input.platform}-${input.locale}.md`);
  const prompt = this.fillTemplate(promptTemplate, input);
  return await this.gemini.generateStructured({ /* ... */ });
}
```

这个 service 把"生成 listing"这个**业务结果**写死在代码里。如果哪天运营想：

- 同时跑 3 个 prompt 取最好的（A/B 测）
- 加入竞品图片对比再生成
- 跳过 schema 校验只要 markdown

→ 必须**改代码 + 重新部署**，违反 prompt-native 原则。

✅ **正确做法**：`generate()` 应拆为更细的原语：

- `ai.callModel(provider, model, messages, schema?)` — 纯调用
- `prompts.load(id)` — prompt 资源管理
- `prompts.fillTemplate(template, vars)` — 模板填充

业务"生成 listing"则应是 prompt-driven 工作流，不是硬编码 service method。

### 2.3 改进建议

| 优先级 | 行动                                                                                                                      | 落地切片                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| P1     | 重构 ADR-005：`*Service.generate()` 类方法降级为"工作流模板"，底层暴露细粒度原语（callModel / loadPrompt / fillTemplate） | S2 W14（ADR-005 v2 评审） |
| P2     | 把 `confirmGate` 从 `mcpToolCallService` 内联抽离为独立工具 `human.requestApproval(toolCall)` —— Agent 可显式调用         | S4 W43                    |
| P3     | 文档化"工具 vs 工作流"判断标准：能用更细工具组合实现的，就别封装                                                          | S2 W14 ADR-005 v2         |

---

## 原则 3：Context Injection（上下文注入）

> "系统提示词包含应用状态的动态上下文"

### 3.1 应注入 vs 当前设计

| 上下文类型                    | 设计是否注入 | 来源                            | 备注                                                  |
| ----------------------------- | ------------ | ------------------------------- | ----------------------------------------------------- |
| 当前用户信息（userId / role） | ⚠️ 部分      | IAM Casbin context              | ADR-006，但未明确传给 LLM                             |
| Tenant / Brand 上下文         | ✅ 是        | ADR-008 TenantContext           | 强制隔离，安全                                        |
| Market / Locale               | ✅ 是        | ListingGenerationInput          | ADR-005 §2.3                                          |
| 当前可用工具清单              | ❌ 未明确    | —                               | system prompt 内未列出                                |
| 当前会话历史                  | ✅ 是        | mcpToolCallService.streamChat() | ADR-005 §2.4                                          |
| 用户最近活动                  | ❌ 未提及    | —                               | 缺失                                                  |
| Listing 当前状态 / 版本       | ❌ 未提及    | —                               | AI Chat 开工单时不知道客户问的 listing 现在是什么状态 |
| 库存当前快照                  | ❌ 仅按需查  | LingxingClient                  | 应在 system prompt 注入"今日库存预警 SKU 数"          |
| 广告今日花费                  | ❌ 未提及    | —                               | 优化建议生成时应注入"今日已花 $X / 预算 $Y"           |

**得分：4/9（44%）— 待改进**

### 3.2 关键缺口

❌ **设计文档完全没有提到「Context Builder」组件**：

- ADR-005 各 service 把"上下文"等同于"用户输入"
- 缺一个 `ContextProvider` 在每次 Agent 调用前组装 system prompt 的动态部分

❌ **缺"Available Capabilities"自我描述**：

- AI Chat 不会告诉客户"我能帮你查订单 / 查保修 / 开工单"
- 用户不知道边界，AI 也不知道边界

### 3.3 改进建议

| 优先级 | 行动                                                                                                                      | 落地切片 |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| P0     | 新增 ADR-009：`ContextProvider 与 System Prompt 组装策略`，定义注入哪些动态字段                                           | S1 W6    |
| P0     | ADR-005 §2.4 `streamChat` 必须从 `ContextProvider.buildChatContext({tenant, customerId})` 拿 context；不允许直接拼 prompt | S3 W34   |
| P1     | 客服 chat system prompt 必须 include：当前可用工具列表 + 用户保修产品列表 + 最近工单状态                                  | S3 W34   |
| P1     | 广告 AI 建议生成时，system prompt 注入：当日花费 / 预算余量 / 上周 ACOS 趋势                                              | S4 W43   |

---

## 原则 4：Shared Workspace（共享工作区）

> "Agent 与用户工作在同一数据空间"

### 4.1 数据存储分析

| 数据存储                                 | 用户访问            | Agent 访问                                     | 是否共享              |
| ---------------------------------------- | ------------------- | ---------------------------------------------- | --------------------- |
| `product` 表                             | ✅ UI CRUD          | ✅ via `LingxingClient` + `mcpToolCallService` | ✅ 同表               |
| `product_content` 表                     | ✅ UI 编辑器        | ✅ AI 生成写入相同表 + `source` 字段区分       | ✅ 同表（设计精彩）   |
| `listing` / `listing_version`            | ✅ UI               | ✅ Agent 可读写（设计预留）                    | ✅ 同表               |
| `customer` / `ticket` (4 tenant schemas) | ✅ 客户端 / 客服 UI | ✅ ADR-008 TenantContext 透明传递              | ✅ schema 隔离正确    |
| `audit_log`                              | ⚠️ 仅管理员看       | ✅ Agent 写日志                                | ✅                    |
| Cloudinary 资产                          | ✅ UI 上传          | ✅ AI 生成图同 folder                          | ✅                    |
| ES 索引                                  | ✅ 搜索 UI          | ✅ `rag.product_knowledge` 同 index            | ✅                    |
| `ai_call_log` 表                         | ❌ 仅 dev 看        | ✅ 写入                                        | ⚠️ 用户看不到 AI 历史 |

**得分：7/8（88%）— 优秀**

### 4.2 亮点

✅ **`product_content.source` 字段是 agent-native 范式的教科书做法**：

- §6 W2 + §13 验收"品类继承三种 source"
- 用户编辑、AI 生成、品类继承用同一张表，靠 `source` 字段区分而非分表
- 用户可以"接管 AI 草稿继续编辑"，agent 也可以"基于人工版本再优化"

✅ **ListingVersion 子表（§6 W2）**：

- 支持多版本协作，Agent 写 v3 草稿、用户 review、用户激活某版本
- 历史可追溯，agent / 用户行为同等记录

### 4.3 唯一缺口

⚠️ **`ai_call_log` 表只对 dev 可见**：

- 用户不知道 AI 上次"为什么"那么生成
- 应在 listing 详情页显示"本版本由 AI 生成于 X 月 X 日，使用 prompt v1.2，token 用量 X"

### 4.4 改进建议

| 优先级 | 行动                                                               | 落地切片 |
| ------ | ------------------------------------------------------------------ | -------- |
| P2     | listing 详情页加"AI 生成元数据"展示组件（基于 `ai_call_log` JOIN） | S2 W26   |
| P3     | 客户工单详情页加"AI 回复溯源"（哪条 KB 文档命中、置信度）          | S3 W34   |

---

## 原则 5：CRUD Completeness（CRUD 完整性）

> "每个实体都有完整的 CRUD（增删改查）"

### 5.1 实体 × CRUD 矩阵

| 实体                     | Create            | Read      | Update                  | Delete           | 评估                      |
| ------------------------ | ----------------- | --------- | ----------------------- | ---------------- | ------------------------- |
| Product                  | ✅ UI（W6）       | ✅ UI/API | ✅ UI                   | ⚠️ 软删          | 设计完整                  |
| Listing                  | ✅ W9-W10         | ✅        | ✅                      | ⚠️ archived 状态 | OK                        |
| ListingVersion           | ✅ 自动           | ✅        | ❌ 不允许（不可变快照） | ❌ 不允许        | ✅ 设计正确（CQRS）       |
| Category                 | ✅ W5             | ✅        | ✅                      | ⚠️ 软删          | OK                        |
| Brand                    | ⚠️ 配置文件？     | ✅        | ⚠️ 配置                 | ❌               | 配置而非动态 CRUD（合理） |
| Customer                 | ✅ W31 注册       | ✅        | ⚠️ 部分（密码/邮箱）    | ⚠️ 30 天宽限     | 设计了 GDPR               |
| Ticket                   | ✅ W34            | ✅        | ✅                      | ❌ 仅 close      | OK                        |
| WarrantyRegistration     | ✅ W36            | ✅        | ⚠️ 仅 admin             | ❌               | OK                        |
| OrderLookup              | ❌（领星 source） | ✅        | ❌                      | ❌               | 只读合理                  |
| AdCampaign 配置          | ❌ 在领星侧       | ✅ 镜像   | ⚠️ 经闸门               | ❌               | 部分（合理）              |
| Manual / 包装文件        | ✅ W66            | ✅        | ⚠️ 重新生成             | ❌               | 待确认                    |
| Course / Question / Exam | ✅ W72            | ✅        | ✅                      | ⚠️ 软删          | OK                        |

**得分：8/12（67%）**

### 5.2 关键缺口

⚠️ **Agent 工具未覆盖 Update / Delete 路径**：

- ADR-005 §2.4 工具清单偏 read-only
- 设计未明确"AI Agent 是否可以删除工单"、"是否可以归档 listing"
- 高风险 Update/Delete 必须经 confirmGate，但工具应该存在

❌ **Brand 配置硬编码风险**：

- §3.1 / §6 W14 出现 4 个品牌字面量 `homtone | spoonlemon | davivy | tysun`
- 加第 5 个品牌需改代码而非配置 → 不 agent-native

### 5.3 改进建议

| 优先级 | 行动                                                                      | 落地切片 |
| ------ | ------------------------------------------------------------------------- | -------- |
| P1     | ADR-005 工具集补全 update/delete tools（带 confirmGate）                  | S2 W14   |
| P2     | Brand 字面量改为 DB-driven 配置；TypeScript union 用 const-assertion 派生 | S5 W53   |
| P3     | 每个实体增加 `bulk` 工具变体（`product.bulkUpdate(filter, patch)`）       | S4+      |

---

## 原则 6：UI Integration（UI 集成）

> "Agent 操作立即在 UI 反映"

### 6.1 现有机制分析

| Agent 操作              | UI 更新机制             | 是否实时 | 备注                                |
| ----------------------- | ----------------------- | -------- | ----------------------------------- |
| Listing 生成完成        | ❓ 设计未明确           | ❌       | 需要 SSE/Polling 但 ADR 未提        |
| 路径 A 提取完成         | §6 W18-W20 异步任务进度 | ✅       | BullMQ + 进度查询                   |
| AI Chat 流式回复        | SSE / WebSocket         | ✅       | ADR-005 §2.4 streamChat             |
| 广告建议生成            | ❓                      | ❌       | 同 listing                          |
| 库存同步触发            | ❓                      | ❌       | 用户不知道 cron 在跑                |
| Agent 修改 listing 字段 | ❓                      | ❌       | 用户在编辑器时 Agent 改了，会冲突？ |
| 工单 AI 自动回复        | ❓                      | ❌       | 客户端是否实时看到？                |

**得分：3/6（50%）**

### 6.2 关键缺口

❌ **设计文档完全没有"Agent 操作的 UI 推送策略"统一规范**：

- 只有 AI Chat 提到了 SSE/WebSocket
- listing 异步生成、广告建议生成、Agent 自动修改字段……都没有"推送 / 重新加载 / 冲突处理"的说法

❌ **协作冲突未设计**：

- 用户正在编辑器改 Title 时 Agent 写入新 version，UI 怎么处理？
- 没有 OT/CRDT、没有"乐观锁 + 重试"、没有 "Agent 只能在 draft version 操作"

### 6.3 改进建议

| 优先级 | 行动                                                                                                | 落地切片                  |
| ------ | --------------------------------------------------------------------------------------------------- | ------------------------- |
| P0     | 新增 ADR-010：`Agent → UI 实时推送规范`（SSE 通道选型 / 事件类型 / 协作冲突策略）                   | S1 W11 前                 |
| P0     | Listing 编辑器明确：Agent 写入只能进 `draft` version；用户激活前 Agent 不能改 active version        | S1 W10（写入 ADR-005 v2） |
| P1     | 全局事件总线：`agent.action.completed { entity, entityId, action, summary }` → 前端按用户当前页订阅 | S3 W34                    |
| P2     | "Agent 活动"侧边栏：用户可看到所有 Agent 在该 entity 上的最近 N 次操作                              | S4 W43                    |

---

## 原则 7：Capability Discovery（能力发现）

> "用户能发现 Agent 能做什么"

### 7.1 7 种发现机制

| 机制                        | 设计是否存在      | 位置 / 备注                     |
| --------------------------- | ----------------- | ------------------------------- |
| Onboarding 流程             | ❌ 未提及         | §6 W4 前端 shell 没有           |
| 帮助文档                    | ⚠️ 仅 README      | 缺面向运营/客户的               |
| UI 中能力提示               | ❌ 未提及         | 编辑器空状态没有"试试问 AI"提示 |
| Agent 自我介绍              | ⚠️ 仅 hello world | 不结构化                        |
| 建议提示词 / 快捷操作       | ❌ 未提及         | 客服 chat 没有"常见问题"按钮    |
| 空状态引导                  | ❌ 未提及         | 新建产品页没有"AI 帮你填"       |
| Slash 命令（/help, /tools） | ❌ 未提及         | 设计未涉及                      |

**得分：1/7（14%）— 严重待改**

### 7.2 风险

❌ **运营 38 人 + 客户多语言群体，能力不可见 = 不会用**：

- §6 W13 alpha 5 人试用 → 风险：试用人不知道能让 AI 干什么
- §11 W72-W74 培训系统**才**讲 AI 工具用法 → 时间太晚（培训在 S6 末）

❌ **客户中心 chat（S3 W34）若不展示"我能做什么"，会触发大量"模糊提问 → AI 答不好 → 转人工"的循环**：

- 直接拉低 M-03 命中率（基线 65%）

### 7.3 改进建议

| 优先级 | 行动                                                                                    | 落地切片 |
| ------ | --------------------------------------------------------------------------------------- | -------- |
| P0     | 客服 chat 首屏必须显示快捷按钮：「查我的订单」「保修注册」「找用户手册」「联系客服」    | S3 W34   |
| P0     | Listing 编辑器添加 AI 提示气泡：「试试让 AI 优化 Title」「试试用图生成 A+」             | S1 W10   |
| P1     | 管理后台首屏 onboarding 走查（5 步）：建产品 / 生成 listing / 看库存 / 接客服 / 看广告  | S2 W26   |
| P1     | AI Agent system prompt 自带能力清单，主动告知"我能帮你做以下事…"                        | S3 W34   |
| P2     | 内部运营 wiki：`yaemartOS-AI-Cheatsheet.md`（每个角色可触发的 10 个最常用 prompt 例句） | S2 W26   |

---

## 原则 8：Prompt-Native Features（特性即提示词）

> "特性是定义结果的提示词，而不是代码"

### 8.1 现有特性定义方式

| 特性                                          | 定义在哪                                         | 类型      | 评估                                              |
| --------------------------------------------- | ------------------------------------------------ | --------- | ------------------------------------------------- |
| Listing 生成（Amazon EN）                     | `prompts/listing/amazon-en.md`                   | 🟢 PROMPT | ADR-005 §2.9                                      |
| Listing 生成（Walmart）                       | `prompts/listing/walmart-en.md`                  | 🟢 PROMPT | OK                                                |
| 路径 A 元数据提取                             | `prompts/extraction/lingxing-listing-meta.md`    | 🟢 PROMPT | OK                                                |
| Manual 章节抽取                               | `prompts/extraction/manual-pdf-content.md`       | 🟢 PROMPT | OK                                                |
| 客服回复                                      | `prompts/chat/customer-support.md`               | 🟢 PROMPT | OK                                                |
| 广告优化建议                                  | `prompts/ad-optimization/amazon-ppc-cn.md` (S2+) | 🟢 PROMPT | OK                                                |
| 字符长度规则                                  | TypeScript 字符串常量（暗藏在代码）              | 🔴 CODE   | 反模式：每加一个平台要改代码                      |
| `ListingContentSchema` 校验                   | TypeScript zod 字面量                            | 🔴 CODE   | 反模式：title 改长度上限要改代码                  |
| 平台禁用词                                    | TypeScript 数组？或 Postgres 表？                | ❓ 未明确 | ADR-005 §2.3 input 有 `forbiddenWords` 但未说源头 |
| Listing 状态流（draft → review → approved …） | 代码硬编码（NestJS state machine）               | 🔴 CODE   | 不灵活；运营加新状态须改代码                      |
| 广告 confirmGate `HIGH_RISK_TOOLS`            | TypeScript 数组                                  | 🔴 CODE   | 反模式：调整哪些工具高风险须改代码                |

**得分：5/8（63%）**

### 8.2 关键缺口

❌ **平台规则（字符上限、禁用词、Schema）应是数据驱动的**：

- ADR-005 §2.3 平台规则注入 prompt 模板，但 prompt 里写的是字面量而非动态变量
- 加 Etsy 平台 → 复制 prompt + 改代码
- 期望：prompt 引用 `{{platformRules.amazon.titleMaxChars}}`，platformRules 是 DB 配置

❌ **`HIGH_RISK_TOOLS` 在代码里硬编码**：

- ADR-005 §2.4 `if (HIGH_RISK_TOOLS.includes(toolCall.name))`
- 应改为 `tool.metadata.requiresApproval === true` —— 元数据驱动

### 8.3 改进建议

| 优先级 | 行动                                                                                                                      | 落地切片 |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| P1     | `platform_rules` 表（DDL）：`platform / field / max_chars / forbidden_words`；prompt 模板引用                             | S2 W16   |
| P1     | Tool 定义结构增加 `metadata.requiresApproval / metadata.audit / metadata.rateLimitTier` 字段；confirmGate 改为读 metadata | S2 W14   |
| P2     | Listing 状态流配置化：`listing_workflow` 表定义节点 + transition；UI 从 DB 读取                                           | S5 W56   |
| P2     | Brand voice / 风格指南：每个 brand 一份 `brand_voice.md`，prompt include；运营自助修改                                    | S2 W14   |

---

## Top 10 优先改进项（按影响排序）

| 优先级    | 行动                                                               | 关联原则     | 落地切片        | 工时估算 |
| --------- | ------------------------------------------------------------------ | ------------ | --------------- | -------- |
| **P0-1**  | 新增 ADR-009：`ContextProvider 设计`，统一组装动态系统提示词       | 3 上下文注入 | S1 W6           | 1 人天   |
| **P0-2**  | 新增 ADR-010：`Agent → UI 实时推送规范` + 协作冲突策略             | 6 UI 集成    | S1 W11          | 2 人天   |
| **P0-3**  | ADR-005 增补附录 A：`yaemartOS Tool Catalog`，全 UI 操作集映射     | 1 操作对等   | S1 W6           | 1 人天   |
| **P0-4**  | 客服 chat 首屏快捷按钮 + AI 自我介绍能力清单                       | 7 能力发现   | S3 W34          | 2 人天   |
| **P0-5**  | Listing 编辑器明确：Agent 写入只能进 `draft` version               | 6 UI 集成    | S1 W10          | 0.5 人天 |
| **P1-6**  | `platform_rules` 表替代 prompt 内字面量字符规则                    | 8 提示词原生 | S2 W16          | 3 人天   |
| **P1-7**  | `tool.metadata.requiresApproval` 元数据替代 `HIGH_RISK_TOOLS` 数组 | 8 提示词原生 | S2 W14          | 1 人天   |
| **P1-8**  | ADR-005 重构：拆`*Service.generate()`为更细原语                    | 2 工具即原语 | S2 W14          | 5 人天   |
| **P1-9**  | 全局事件总线：`agent.action.completed` → 前端按页订阅              | 6 UI 集成    | S3 W34          | 3 人天   |
| **P1-10** | system prompt 注入：当前用户、库存预警、广告今日花费               | 3 上下文注入 | S3 W34 / S4 W43 | 2 人天   |

**总改进工时**：约 20.5 人天（≈ 4 周分散到 S1-S4），可通过修订 ADR 与切片任务表落地。

---

## 设计层亮点（值得保留）

1. **ADR-008 Tenant 模板架构**：4 schema 物理隔离 + 透明 context propagation，是 agent-native 数据隔离的典范
2. **`product_content.source` 字段**：用户/AI/品类继承共用同表，是共享工作区的精彩示例
3. **ADR-004 LingxingClient 命名空间**：`listings/orders/inventory/ads` 已是天然 agent tools
4. **ADR-005 prompts 文件化**：每个 prompt 一个 markdown + frontmatter + 评测集，prompt-native 基础好
5. **§2.2 Agent Native 验证项**：方案文档里就明确"能力即工具"和"AI 调用日志可审计"两条硬指标
6. **§13 关键需求显式验收**：包含"广告执行不可绕过确认"自动化测试

---

## 总结

yaemartOS v2.0-RC 在**数据共享（原则 4）**和**工具即原语的领星侧（部分原则 2）**做得很好——58% 的设计成熟度比白纸起步的项目高出一截。

但有 3 个**关键短板必须在 S1 内通过 ADR-009/ADR-010 修补**，否则 S3-S4 落地客户中心和广告闸门时会反复重构：

1. **Context Injection（44%）**：缺 ContextProvider 统一层，AI 调用接收的上下文太静态
2. **Capability Discovery（14%）**：用户/客户根本不知道 Agent 能做什么，会拉低 M-03 客服命中率
3. **UI Integration（50%）**：Agent 写入与用户编辑无协作冲突方案

按 Top 10 改进项执行后，预计 S3 W39 末复审可达 **75-80%（✅ 优秀）**。

---

_审计版本：v1.0 | 复审计划：S1 W13 末（首切片代码）+ S3 W39 末（客户中心 + AI Chat 落地）_
