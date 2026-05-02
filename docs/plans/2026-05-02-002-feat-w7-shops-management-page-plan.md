---
title: 'feat: Complete W7 ShopBinding Management Page — Human-Gate + Agent-Native'
type: feat
status: active
date: 2026-05-02
---

# feat: Complete W7 ShopBinding Management Page — Human-Gate + Agent-Native

## Overview

W7 规定的「ShopBinding 管理界面：勾选同步店铺范围」目前骨架已存在（`shops/page.tsx` + `ShopBindingList`），但有若干未完成项：前后端类型不一致、缺少解绑能力、写操作缺乏人工确认闸门、Agent 无法通过工具完成同等操作（违反 Agent-Native Parity 原则）。

本计划修复这些问题，交付一个**类型正确、功能完整、每个写操作均有人工确认闸门、且 Agent 可通过 REST 工具实现完全对等操作**的 `/shops` 管理页面。

---

## Problem Frame

### 背景

跨境电商系统连接了多个领星托管的亚马逊 / Walmart 店铺，但系统只希望选择性地同步特定店铺的数据。`ShopBinding` 表记录哪些店铺已绑定领星 ID、哪些启用了同步。

### 现有差距（W7 收尾）

1. **类型失配**：`shop-client.ts` 的 `LingxingShop` 用 `id/name/platform`，但领星客户端实际返回 `shopId/shopName/marketplaceId/isActive`；`ShopBinding.boundAt` 与 Prisma 的 `createdAt` 不一致。
2. **列表显示缺失**：`shop.service.list()` 不 include `platform` / `market` 关联，前端拿到的是 `platformId`（UUID），无法显示可读名称。
3. **缺少解绑操作**：现有接口只能绑定与切换 `syncEnabled`，无法撤销绑定（`lingxingShopId` 设为 null）。
4. **写操作无确认门**：Bind 有 BindDialog 但缺乏二次确认；`toggleSync` 是即时触发；均违反「所有写入操作必须有人工确认闸门」约定。
5. **Agent Parity 缺口**：Agent 可以 GET，但 POST/PATCH 端点对 Agent 可调用性无文档；缺少 `DELETE/PATCH unbind` 端点；Agent 无法实现 UI 可做的所有操作。

### 用户关切

> "所有写入操作都必须有人工确认闸门，不允许 AI 或系统自动执行"

这意味着 Agent 可以**提议**操作（读取状态、推荐绑定），但**执行**必须由人类在 UI 中确认。

---

## Requirements Trace

- R1. 前端正确显示 Shop 的平台名称与市场名称（非 UUID）。
- R2. 前端类型与后端 API 实际响应完全对齐。
- R3. 支持解绑操作（撤销 ShopBinding 的 `lingxingShopId` 并置 `syncEnabled = false`）。
- R4. **所有写操作**（绑定、解绑、切换同步）在执行前必须弹出确认对话框。
- R5. Agent 可通过标准 REST 端点完成 UI 全部可见操作（parity）。
- R6. 系统提示注入 shop 域上下文，Agent 能感知可用能力与资源。

---

## Scope Boundaries

- 不新增 Shop 记录（Shop 本身通过 seed 或后台管理另行维护，W7 只管理绑定关系）。
- 不实现写回领星（S4 阶段）。
- 不重写 ShopBinding 表结构；只在现有字段上扩展。
- 不实现 Agent 审批工作流（系统信任 REST 调用发起方是已认证管理员）；人工确认闸门**仅在 UI 层**。
- 不替换 Casbin RBAC；沿用 `shops:read` / `shops:write`。

### Deferred to Follow-Up Work

- 领星同步任务调度与批量拉取（W7 另一项：「仅绑定店铺生成同步任务」），属 MigrationProcessor 范畴，已在 W18-W20 处理，此处不重叠。
- `/lingxing` 领星同步状态仪表盘（计划表中 W7+ 路由）。

---

## Context & Research

### Relevant Code and Patterns

- `apps/api/src/shop/shop.service.ts` — 现有 `list`/`bind`/`updateBinding` 逻辑
- `apps/api/src/shop/shop.controller.ts` — 4 个端点；`getById` 方法已有但未注册
- `apps/api/src/shop/dto/update-binding.dto.ts` — 仅含 `syncEnabled`；需扩展支持解绑
- `apps/web/app/[locale]/(admin)/shops/page.tsx` — Server Component 骨架
- `apps/web/components/shop/shop-binding-list.tsx` — 主表格，`BindDialog`，toggle UI
- `apps/web/lib/api/shop-client.ts` — API 客户端；类型有误，待修正
- `packages/lingxing-client/src/operations/shops.ts` — 领星返回 `shopId/shopName/marketplaceId/isActive`
- `apps/api/prisma/schema.prisma` — `Shop`（含 `marketId`/`platformId` FK）、`ShopBinding`（含 `lingxingShopId?`）
- `apps/web/components/admin/admin-sidebar.tsx` — 店铺绑定入口已存在（`shops:read`）
- `apps/web/app/[locale]/(admin)/listings/page.tsx` — AlertDialog 确认门参考

### Confirmation Gate Pattern

shadcn/ui `AlertDialog`：写操作均在 `AlertDialogAction` `onClick` 中执行，`AlertDialogCancel` 中止。已在 listings / 产品删除中使用此模式。

### Agent-Native Parity Pattern

AGENTS.md 说明：AI 写入规则 —「AI 只能写入 draft 版本，用户手动激活」。Shop 绑定操作性质类似：Agent 调用 `/shops/:id/bind` 后，真正在 UI 可见；但本计划中 **人工确认门在 UI 层**，Agent 通过已认证 JWT 调用 API 即视为「管理员操作」，不需要额外 draft 机制。这与 AI 生成内容（如 Listing）的 draft 模式不同。

---

## Key Technical Decisions

- **如何修复平台/市场显示名**：在 `shop.service.list()` 加 `include: { platform: { select: { name: true } }, market: { select: { name: true } } }`，后端返回嵌套对象；前端类型同步更新。比在前端单独查询更高效，无 N+1 问题。

- **解绑方式**：PATCH `/shops/:id/binding` 扩展支持 `{ unbind: true }`，service 将 `lingxingShopId` 设为 null、`syncEnabled` 设为 false，保留 ShopBinding 行（软解绑）。不新增 DELETE 端点，保持向后兼容，审计记录也得以保留。

- **确认门位置**：在**前端客户端组件层**（`ShopBindingList`）用 `AlertDialog` 包裹三类写操作；后端不做「预提交」暂存。这与用户接受的「手动确认闸门」约定一致，成本最低。

- **Agent Parity**：REST 端点本身即为 Agent 可调用工具（同 `migration-client.ts` 模式）；新增 `apps/web/lib/api/shop-client.ts` 类型补全，供 Agent 调用时有正确的 TypeScript 类型。Shop 操作的 system-prompt 注入放在管理后台 context 加载时（全局 system-prompt 将在 AI 助手模块集成时接入，此处预留注释锚点）。

---

## Open Questions

### Resolved During Planning

- **Platform/Market 表是否有 `name` 字段？** 是，Prisma schema 中 `Platform` 和 `Market` 均有 `name: String`（可在 schema 验证）。
- **解绑是否需要删除 ShopBinding 行？** 否，软解绑保留历史记录，支持重新绑定。
- **Agent 写操作是否需要 draft 机制？** 否，Shop binding 不属于 AI 生成内容；人工确认闸门在 UI 层即可。

### Deferred to Implementation

- `Platform` 和 `Market` 表中 `name` 字段的实际值格式（如 `"Amazon US"` vs `"US"` vs `"ATVPDKIKX0DER"`），视数据库实际数据调整显示逻辑。
- `lingxing-client` `MappedShop.marketplaceId` 与本系统 `Shop.marketId` 的匹配逻辑（领星用 marketplace ID，本系统用内部 UUID），需在 bind 流程中确认前端显示逻辑是否展示 `marketplaceId` 还是本系统 `market.name`。

---

## High-Level Technical Design

> _以下为方向性设计，供 review 确认意图，不是实现规范。_

```
Browser / Agent
    │
    ▼
GET  /shops              → list(brandId, include platform+market)
GET  /shops/lingxing-available  → getLingxingShops()
POST /shops/:id/bind     → bind(id, { lingxingShopId, bindingToken? })
PATCH /shops/:id/binding → updateBinding(id, { syncEnabled?, unbind? })
    │
    ▼
ShopBindingList (Client Component)
    │
    ├─ [绑定] → AlertDialog 确认 → bindShop()
    ├─ [解绑] → AlertDialog 确认 → unbindShop()
    └─ [同步开关] → AlertDialog 确认 → toggleSync()

确认门规则（UI 层）：
  绑定 → 确认框："将 {shopName} 绑定至领星店铺 {lingxingName}？此操作将开始数据同步。"
  解绑 → 确认框："解除 {shopName} 的领星绑定？同步将停止，历史记录保留。"
  同步切换 → 确认框："{启用/停止} {shopName} 的数据同步？"
```

---

## Implementation Units

- [ ] U1. **修复后端 list 响应：include platform / market 关联**

**Goal:** `GET /shops` 返回的每条记录包含可读的平台名 `platform.name` 和市场名 `market.name`，不再只有 UUID。

**Requirements:** R1, R2

**Dependencies:** None

**Files:**

- Modify: `apps/api/src/shop/shop.service.ts`
- Modify: `apps/api/src/shop/shop.controller.ts` （注册 `GET /shops/:id`）
- Test: `apps/api/src/shop/shop.service.spec.ts`

**Approach:**

- `list()` 中 `include` 增加 `{ platform: { select: { name: true } }, market: { select: { name: true } } }`
- 同时在 `getById()` 中做同样的 include
- `shop.controller.ts` 注册 `@Get(':id')` 映射到 `getById()`（供 Agent 与前端详情使用）

**Patterns to follow:**

- `apps/api/src/migration/migration.controller.ts` — NestJS 控制器端点注册模式

**Test scenarios:**

- Happy path：`list('homtone')` 返回数组，每项含 `platform: { name: 'Amazon' }` 与 `market: { name: 'US' }`
- Edge case：brandId 无匹配，返回空数组而非错误
- Happy path：`getById(id)` 返回含 `platform`/`market` 嵌套的完整 shop
- Error path：`getById('non-existent')` 抛 `NotFoundException`

**Verification:**

- `GET /shops` 响应 JSON 中每条 shop 有 `platform.name` 和 `market.name` 字段（非空字符串）
- 单元测试通过

---

- [ ] U2. **扩展 updateBinding：支持软解绑操作**

**Goal:** PATCH `/shops/:id/binding` 除现有的 `syncEnabled` 切换外，支持 `unbind: true` 将 `lingxingShopId` 设为 null 并强制 `syncEnabled = false`。

**Requirements:** R3

**Dependencies:** None（可与 U1 并行）

**Files:**

- Modify: `apps/api/src/shop/dto/update-binding.dto.ts`
- Modify: `apps/api/src/shop/shop.service.ts`
- Test: `apps/api/src/shop/shop.service.spec.ts`

**Approach:**

- DTO 新增可选字段 `unbind?: boolean`
- `updateBinding()` 中：若 `unbind === true`，`data = { lingxingShopId: null, syncEnabled: false }`；否则沿用 `data = { syncEnabled }`
- 审计日志写 `shop.binding.unbind`

**Patterns to follow:**

- `apps/api/src/shop/dto/update-binding.dto.ts` 现有结构（class-validator decorators）
- `apps/api/src/shop/shop.service.ts` 中 `updateBinding` 的审计写入模式

**Test scenarios:**

- Happy path：`updateBinding(id, { syncEnabled: false })` 只更新 `syncEnabled`，`lingxingShopId` 不变
- Happy path：`updateBinding(id, { unbind: true })` 将 `lingxingShopId` 设为 null，`syncEnabled` 设为 false
- Error path：shop 不存在时抛 `NotFoundException`
- Edge case：`unbind: true` 且同时传 `syncEnabled: true`，`unbind` 优先（`syncEnabled` 被强制为 false）

**Verification:**

- PATCH 请求 `{ unbind: true }` 后，GET shop 列表该店铺无 `lingxingShopId`，`syncEnabled = false`
- 单元测试通过

---

- [ ] U3. **修复前端类型对齐：shop-client.ts + ShopBindingList 字段渲染**

**Goal:** 前端 TypeScript 类型与后端实际 API 响应严格一致；`ShopBindingList` 正确渲染平台名和市场名。

**Requirements:** R1, R2

**Dependencies:** U1（需后端先返回新字段）

**Files:**

- Modify: `apps/web/lib/api/shop-client.ts`
- Modify: `apps/web/components/shop/shop-binding-list.tsx`
- Test: （ShopBindingList 为客户端组件，验证方式为手动/E2E，此处不新增 unit test 文件）

**Approach:**

- `LingxingShop` 类型更正为 `{ shopId: string; shopName: string; marketplaceId: string; isActive: boolean }`（与 `MappedShop` 对齐）
- `ShopItem` 类型新增 `platform: { name: string }` 和 `market: { name: string }` 嵌套字段，移除旧的顶层 `platform: string`
- `ShopBinding` 中 `boundAt` 改为 `createdAt`（与 Prisma 字段一致）
- `ShopBindingList` 表格列：平台列从 `shop.platformId` 改为 `shop.platform?.name`；市场列从无改为 `shop.market?.name`；领星店铺列从 `lingxingShopId` 改为领星店铺名（如有）或 `lingxingShopId`
- `BindDialog` 中 select option 改用 `s.shopId` / `s.shopName`（不再是 `s.id` / `s.name`）

**Patterns to follow:**

- `apps/web/lib/api/listing-client.ts` — TypeScript 接口与 API 响应对齐模式
- `apps/web/components/migration/import-job-progress.tsx` — 组件内类型声明风格

**Test scenarios:**

- Happy path：`LingxingShop` 列表渲染时显示 `shopName`（非 `name`）
- Happy path：绑定列表表格中平台列显示 `"Amazon"` 等可读名（非 UUID）
- Edge case：`platform` 或 `market` 为 null（未关联时），显示占位符 `—`

**Verification:**

- TypeScript 编译无类型错误（`pnpm -F @yaemartos/web tsc --noEmit`）
- 浏览器中 `/shops` 表格平台列显示可读名称，非 UUID

---

- [ ] U4. **前端：三类写操作人工确认闸门（AlertDialog）**

**Goal:** 绑定、解绑、切换同步三个操作，在执行前均弹出 `AlertDialog` 说明操作后果，用户点「确认」才真正调用 API；符合「所有写入操作必须有人工确认闸门」约定。

**Requirements:** R4

**Dependencies:** U3（需要解绑操作的 UI 入口）

**Files:**

- Modify: `apps/web/components/shop/shop-binding-list.tsx`

**Approach:**

- 引入 shadcn/ui `AlertDialog`（已在 `@/components/ui/alert-dialog` 注册）
- **绑定确认**：BindDialog 内原有「确认绑定」按钮改为触发 `AlertDialog`，标题「确认绑定」，描述「将 {shopName} 绑定至领星 {selectedLingxingShopName}？数据同步将在下次调度时启动。」，AlertDialogAction 执行 `bindShop()`。
- **解绑确认**：表格操作列在已绑定行添加「解绑」按钮，点击触发 AlertDialog，标题「确认解绑」，描述「解除 {shopName} 的领星绑定？同步将停止，已有数据保留。」，AlertDialogAction 执行 `unbindShop()`（PATCH `{ unbind: true }`）。
- **同步切换确认**：现有 toggle switch `onChange` 改为先弹出 AlertDialog，标题「确认{启用/停止}同步」，描述「{shopName} 的数据同步将{立即启用/停止}。」，AlertDialogAction 执行 `toggleSync()`。
- 操作进行中（loading state）：按钮显示 spinner，禁止重复点击。
- 操作失败时：toast 显示错误信息（沿用现有 `useToast` 模式）。

**Execution note:** 人机交互密集，优先保证 UX 流程完整，再考虑代码简洁。

**Patterns to follow:**

- `apps/web/components/migration/trigger-import-form.tsx` — loading state 与 toast 错误处理模式
- shadcn/ui AlertDialog 在 listings 或产品删除中的用法

**Test scenarios:**

- Happy path：点击「绑定」→ 弹出 AlertDialog → 点确认 → API 调用 → 表格刷新
- Happy path：点击「解绑」→ AlertDialog → 点取消 → 无 API 调用，状态不变
- Happy path：切换 sync switch → AlertDialog → 点确认 → toggle 更新
- Error path：API 返回 4xx/5xx → toast 显示错误，表格状态回滚

**Verification:**

- 每个写操作均需两步交互（点击 + 确认）才能执行
- 取消任一步操作，API 不被调用，表格状态不变
- 网络错误时有 toast 反馈

---

- [ ] U5. **Agent Parity：补全 shop 域 MCP-ready REST 端点文档与系统提示锚点**

**Goal:** 确保 Agent 可通过 REST API 完成 UI 全部可用操作（parity check）；在管理后台 AI 助手上下文注入处预留 shop 域注释锚点，方便后续系统提示集成。

**Requirements:** R5, R6

**Dependencies:** U1, U2（后端端点完整后才能记录准确的能力表）

**Files:**

- Create: `docs/adr/ADR-010-shop-agent-parity.md`
- Modify: `apps/api/src/shop/shop.controller.ts` （添加 JSDoc 描述，帮助 API 文档生成）
- Modify: `apps/web/lib/api/shop-client.ts` （新增 `unbindShop` 函数）

**Approach:**

Agent Capability Map（UI 操作 vs Agent 工具）：

| UI 操作            | Agent 调用                         | HTTP                                            |
| ------------------ | ---------------------------------- | ----------------------------------------------- |
| 查看店铺列表       | `listShops()`                      | `GET /shops`                                    |
| 查看领星可绑定店铺 | `listLingxingShops()`              | `GET /shops/lingxing-available`                 |
| 查看单个店铺详情   | `getShop(id)`                      | `GET /shops/:id`                                |
| 绑定店铺           | `bindShop(id, { lingxingShopId })` | `POST /shops/:id/bind`                          |
| 切换同步           | `toggleSync(id, enabled)`          | `PATCH /shops/:id/binding`                      |
| 解绑店铺           | `unbindShop(id)`                   | `PATCH /shops/:id/binding` + `{ unbind: true }` |

- `shop-client.ts` 新增 `unbindShop(shopId, token)` 函数（PATCH `{ unbind: true }`）
- `ADR-010` 记录 Agent Parity 决策：shop 写操作无 draft 机制，人工确认闸门在 UI 层；Agent 调用等同管理员操作（需 JWT）
- `ShopController` 各端点添加 JSDoc 说明（操作含义 + 所需权限），为后续 Swagger/OpenAPI 生成做准备
- 在 `shop.controller.ts` 或单独的 `shop-agent-context.ts` 文件中，添加 `SHOP_AGENT_SYSTEM_CONTEXT` 常量（描述 shop 域可用资源与操作），注释标记为 `// TODO: inject into AI assistant system prompt (phase: AI assistant module)`

**Patterns to follow:**

- `docs/adr/ADR-009-path-a-field-mapping.md` — ADR 格式
- `apps/web/lib/api/migration-client.ts` — `unbindShop` 函数结构

**Test scenarios:**

- Test expectation: none — 此单元为文档与类型补全，无行为变更

**Verification:**

- `GET /shops/:id` 端点存在（U1 中已注册），Agent 可获取单店详情
- `apps/web/lib/api/shop-client.ts` 导出 `unbindShop` 函数
- `docs/adr/ADR-010-shop-agent-parity.md` 文件存在，含完整 capability map 表

---

## System-Wide Impact

- **Interaction graph:** `ShopBindingList` 调用 3 个写端点；MigrationProcessor 依赖 `ShopBinding.syncEnabled` 筛选同步店铺（U2 的软解绑会将 `syncEnabled` 改为 false，可能影响下次调度任务队列）。
- **Error propagation:** 前端 API 调用失败 → toast 错误提示 + UI 状态回滚；后端抛 `NotFoundException` → 4xx → 前端 catch。
- **State lifecycle risks:** 软解绑不删行，`ShopBinding` 行 `lingxingShopId = null` 后，MigrationProcessor 的 `where: { binding: { syncEnabled: true } }` 已能正确过滤；无 orphan 风险。
- **API surface parity:** `shop-client.ts` 是唯一 API 入口；U5 补全 `unbindShop` 后覆盖所有操作。
- **Integration coverage:** PATCH 解绑 → MigrationProcessor `getShopsForSync` 过滤逻辑（需确认 processor 仅拉取 `syncEnabled: true` 的 shop）。
- **Unchanged invariants:** Casbin 权限规则（`shops:read` / `shops:write`）不变；Shop 记录本身不被创建/删除（仅管理 ShopBinding）。

---

## Risks & Dependencies

| Risk                                                   | Mitigation                                                                              |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Platform/Market 表 `name` 字段为空或数据未 seed        | U1 中对空值做 null 安全处理，UI 显示占位符 `—`                                          |
| 领星 `marketplaceId` 与本系统 `market.name` 无直接匹配 | 前端 BindDialog 仅用于选择领星店铺名；市场名从本系统 `market.name` 显示，不要求匹配领星 |
| AlertDialog 状态与 API loading 竞争条件                | `useTransition` + disabled 按钮防止重复触发                                             |
| MigrationProcessor 依赖 `syncEnabled` 受软解绑影响     | 软解绑同步设 false，MigrationProcessor 过滤逻辑无需改动，行为可预期                     |

---

## Documentation / Operational Notes

- ADR-010 记录 Agent Parity 决策，作为后续 AI 助手系统提示集成的依据。
- Feature flag 可选：`FF_SHOP_UNBIND`（默认 `true`）控制解绑按钮显示，方便上线前灰度。若不设 flag，解绑按钮默认对有 `shops:write` 权限的用户可见。

---

## Sources & References

- W7 实施计划：`docs/yaemartOS-implementation-plan.md`（第 498–505 行）
- UI 规范：`docs/ui/B-admin-shell.md`（§3.2 导航，§5.1 列表页规格）
- 现有 shop 后端：`apps/api/src/shop/`
- 现有 shop 前端：`apps/web/components/shop/shop-binding-list.tsx`，`apps/web/app/[locale]/(admin)/shops/page.tsx`
- Agent-Native 原则：ce-agent-native-architecture skill
- Confirmation gate 参考：shadcn/ui AlertDialog（listings / 产品删除中现有用法）
