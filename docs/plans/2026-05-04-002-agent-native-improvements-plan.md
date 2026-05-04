# Agent-Native Architecture Improvements — S4 Backlog

**Date**: 2026-05-04  
**Source**: `/ce-agent-native-audit` — 全量 8 原则审计（Overall Score 61%）  
**已实施（本会话 #1）**: 工具描述符修复、Migration/Customer 工具、广告同步 UI  
**已实施（本会话 #2）**: Chat 结构化上下文注入、Order Lookup History API、Metrics API、Terminology GET /:id

---

## 已完成（S4 W40–W42 会话内）

| #   | 项目                                                                                                                                                                             | 原则              | 状态 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---- |
| 1   | 修复 7 个 PARTIAL 工具描述符参数（batchGenerateListings、generateListingDraft、getListingMatrix、updateProductContent、updateCategoryTemplate、updateBrandTheme、updateListing） | Action Parity     | ✅   |
| 2   | 补充 Path-A Migration 4 个工具（listMigrationAvailableShops、triggerPathAImport、getPathAImportJob、listPathAImportJobs）                                                        | Action Parity     | ✅   |
| 3   | 补充 Customer 2 个工具（listCustomers、getCustomer） + 创建 AdminCustomerController                                                                                              | CRUD Completeness | ✅   |
| 4   | updateShopBinding 补充 unbind 参数                                                                                                                                               | Action Parity     | ✅   |
| 5   | 广告看板添加手动同步按钮 + router.refresh() 消除静默入库                                                                                                                         | UI Integration    | ✅   |

---

## P1 已完成（会话 #2）

### P1-A: Customer Chat — 注入结构化会话状态 ✅

**原则**: Context Injection (当前 50%)  
**现状**: Chat system prompt 仅注入 open ticket count，无订单/履约事实  
**方案**:

1. `chat.service.ts` 中，对已登录 customer 查询 `orderLookup`（最近 3 条）
2. 将 order 状态摘要（orderNumber, status, trackingId）注入 system prompt
3. 将 ticket 列表（id, subject, status）替换现有的 count 注入
4. **PII 注意**: 仅传 order number 末 4 位 + 状态，不传全量个人信息
   **文件**: `apps/api/src/customer-portal/chat/chat.service.ts`  
   **估时**: 1 天

### P1-B: 补充 Order / Metric Agent 工具 ✅

**原则**: CRUD Completeness (当前 24%)  
**现状**: Order 仅有 lookupOrderStatus；Metric 无任何工具  
**方案**:

1. 在 `apps/api/src/admin/order-lookup/` 检查是否有 listOrders 端点；若无则创建 `GET /admin/orders?brandId=&shopId=&status=&page=`
2. 在 `yaemartos-tools.ts` 添加 `listOrders`、`getOrder` 描述符
3. 添加 `listMetrics`（GET /metrics?name=&brandId=&limit=）和 `recordMetric`（POST /metrics）描述符
   **估时**: 2 天

---

## P2 待办（建议 W46–W48）

### P2-A: Prompt 模板 DB 化

**原则**: Prompt-Native Features (当前 71%，但无法免部署修改)  
**现状**: 所有 system prompt 硬编码在 `.ts` 文件中，改动需重新部署  
**方案**:

1. 在 `SystemConfig` 表新增 `prompt.*` 命名空间：
   - `prompt.listing.amazon.en.system`
   - `prompt.chat.{brandId}.system`
   - `prompt.faq.system`
2. 在各 AI service 启动时从 DB 读取 prompt 模板（带内存缓存 + TTL 60s）
3. 在 Settings UI 中添加「Prompt 管理」页面，供管理员按品牌/语言编辑
4. 添加 `getPromptTemplate`、`updatePromptTemplate` 工具描述符
   **文件**:

- `apps/api/src/listing/prompts/assemble-listing-prompt.ts`
- `apps/api/src/customer-portal/chat/chat.service.ts`
- `apps/api/src/ai/providers/faq-generation.service.ts`  
  **估时**: 4 天（含 UI）

### P2-B: Customer Chat 引入工具调用

**原则**: Context Injection / Action Parity  
**现状**: Chat 为纯文字对话，无法结构化查询订单或工单  
**方案**:

1. 在 `chat.service.ts` 中定义受限工具集（仅该品牌的 tenant 数据）：
   - `lookupOrder(orderNumber)` → 查询 orderLookup
   - `getTicket(ticketId)` → 查询客户自己的工单
2. 使用 Vercel AI SDK `tools` 参数注入
3. 在 system prompt 中告知模型可用工具名称
4. **安全**: 工具仅能访问该 customerId 关联的数据
   **文件**: `apps/api/src/customer-portal/chat/chat.service.ts`  
   **估时**: 3 天

### P2-C: Brand Voice DB 化

**原则**: Prompt-Native Features  
**现状**: `brand-voice.ts` 中四品牌静态映射，注释标明 S3+ 迁移 DB  
**方案**:

1. 在 `SystemConfig` 表新增 `brand.voice.{brandId}` 键值
2. `getBrandVoiceSection()` 改为从 DB 读取（带缓存）
3. 在品牌设置页添加「AI 声量设置」输入框
4. 添加 `getBrandVoice`、`updateBrandVoice` 工具描述符
   **文件**: `apps/api/src/listing/prompts/brand-voice.ts`  
   **估时**: 2 天

---

## P3 待办（建议 W49+）

### P3-A: 能力发现 — Onboarding & Help

**原则**: Capability Discovery (当前 57%)

- 修正侧栏「帮助文档」链接（当前指向 /settings）
- Listing Copilot 首次使用遮罩（使用 `localStorage` flag）
- 输入框 `/help` slash command 返回能力清单

### P3-B: 工单实时推送

**原则**: UI Integration

- 客户聊天升级工单后，管理工单列表可短轮询（5s）或接入 WebSocket（W50+ 计划）

### P3-C: Terminology UI

**原则**: Shared Workspace

- 补充「术语管理」管理页（当前工具存在但无 UI）

---

## 当前分数 vs 目标

| 原则                   | 当前    | P1 后预期 | P2 后预期 |
| ---------------------- | ------- | --------- | --------- |
| Action Parity          | 80%     | 88%       | 90%       |
| Tools as Primitives    | 90%     | 90%       | 92%       |
| Context Injection      | 50%     | 65%       | 80%       |
| Shared Workspace       | 68%     | 72%       | 78%       |
| CRUD Completeness      | 24%     | 35%       | 42%       |
| UI Integration         | 50%     | 62%       | 70%       |
| Capability Discovery   | 57%     | 60%       | 68%       |
| Prompt-Native Features | 71%     | 74%       | 85%       |
| **Overall**            | **61%** | **68%**   | **76%**   |
