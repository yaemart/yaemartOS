---
title: 'feat: W21-W23 存量数据迁移执行 — 店铺选择器 + 批量导入 + 质量验收'
type: feat
status: active
date: 2026-05-03
origin: docs/yaemartOS-implementation-plan.md
---

# feat: W21-W23 存量数据迁移执行 — 店铺选择器 + 批量导入 + 质量验收

## Overview

W18-W20 已交付 Path A 后端管线（领星 → Gemini 提取 → 产品档案入库）、BullMQ 异步队列、前端进度 UI，以及 APISIX 查询参数签名认证。

W21-W23 的目标是**实际执行 Spoonlemon + Walmart 全量存量数据迁移，验收准确率 ≥ M-07**。当前最大阻碍是前端触发表单要求手动粘贴领星 shopId 列表 —— 运营无法知道哪些 shopId 对应哪个品牌，且无法一键导入。本计划补全：① 后端"可用店铺"查询接口，② 前端智能店铺选择器，③ 品牌级批量导入，④ 迁移质量报告页面，⑤ 端到端验收流程。

---

## Problem Frame

现状差距：

1. `TriggerImportForm` 有一个 `<textarea>` 让用户手动输入 `shop-001, shop-002` 形式的 shopId——运营不知道领星 shopId 是什么，每次需要从 `/shops` 页面复制粘贴，误操作风险高。
2. 没有"一键导入品牌所有已绑定店铺"的快捷操作；W21-W23 要求 Spoonlemon 全量在售 SKU 入库，若每个店铺逐一触发则耗时且易遗漏。
3. 迁移完成后，运营无法在 UI 中查看质量报告（`quality-metrics.ts` 已存在但未被前端消费）。
4. `MigrationController` 只有 `migration:write` 权限检查（已有 Casbin 策略），但缺少 `migration:read` 策略用于只读查询新接口。

---

## Requirements Trace

- R1. 前端触发表单展示品牌+平台维度下所有已绑定领星店铺，可多选，无需手动输入 shopId
- R2. 支持"全选本品牌已绑定店铺"一键导入
- R3. 单次任务完成后，运营可查看成功率、失败 SKU 列表、质量评分
- R4. Spoonlemon 全量在售 SKU 端到端导入，准确率 ≥ M-07（≥ 85% 字段匹配）
- R5. Walmart 平台 listing 数据双品牌入库，可跨平台查询
- R6. 新接口遵守现有 IAM 体系（`JwtAuthGuard` + `CasbinGuard` + `RequirePolicy`）

---

## Scope Boundaries

- 不修改 Path A 提取算法或字段映射逻辑（已有 unit tests 覆盖，稳定）
- 不新增 Prisma 数据模型（`ProductContent` / `ShopBinding` 已存在且满足需求）
- 不改动 `PathAImportProcessor` 的 BullMQ 处理逻辑
- 不在本计划内实现 W24-W25（多平台批量生成 + 矩阵分析 dashboard）
- 质量报告仅展示单次 job 维度的数据，不实现跨 job 聚合趋势图

### Deferred to Follow-Up Work

- 端到端 E2E Playwright 测试（W26 上线前专项）
- GLM-5 Provider 接入 + AI router 增强（W14-W15 范畴，另立计划）
- Spoonlemon 店铺实际绑定到领星（运营操作，依赖 /shops 页面已可用）

---

## Context & Research

### Relevant Code and Patterns

- `apps/api/src/migration/migration.controller.ts` — 已有 `POST /migration/path-a/jobs`、`GET /migration/path-a/jobs/:jobId`、`GET /migration/path-a/jobs` 三个接口，本计划新增 `GET /migration/path-a/shops`
- `apps/api/src/shop/shop.service.ts` — `list(brandId)` 方法已 include binding，可复用
- `apps/api/src/migration/path-a/quality-metrics.ts` — 已有 `calculateQualityMetrics()` 函数，`path-a-import.service.ts` 已在 import 结果中记录 failures
- `apps/web/components/migration/trigger-import-form.tsx` — 当前 textarea 实现，改为选择器
- `apps/web/lib/api/migration-client.ts` — 已有 `triggerPathAImport`, `getPathAImportJob`, `listPathAImportJobs`
- `apps/web/lib/api/shop-client.ts` — `listShops()` 可复用，也可新建专用 migration 端点
- IAM 策略约定：`RequirePolicy({ obj: 'shops', act: 'read' })` 模式，migration 查询沿用 `{ obj: 'migration', act: 'read' }`

### Institutional Learnings

- `docs/solutions/` — integration-issues 目录有领星 API 相关历史记录，注意 APISIX 迁移后端点路径变更
- `ShopBinding.lingxingShopId` 为 `String | null`，过滤时需确认非 null 才加入可用店铺列表

### External References

- BullMQ `job.returnvalue` 文档：任务返回值在 `job.returnvalue` 中，`ImportSummary` 已映射为 `result` 字段

---

## Key Technical Decisions

- **新增 `GET /migration/path-a/shops` 接口而非复用 `/shops`**：migration controller 已有独立权限策略（`migration:read`），避免 shop 模块和 migration 模块的 IAM 耦合。接口返回数据精简，只含 `shopId`（内部主键）、`lingxingShopId`、`shopName`、`platform`、`market`。
- **前端选择器状态在 `TriggerImportForm` 内部维护**：用 `useState<string[]>` 存选中的 `lingxingShopId` 数组，替换原来的 textarea。不引入全局状态管理。
- **质量报告嵌入 `ImportJobProgress` 组件**：job 完成后拉取 `job.returnvalue`，渲染 failures 列表 + 成功率。不单独建页面，减少路由复杂度。
- **Casbin 策略需手动注册 `migration:read`**：现有代码只有 `migration:write`，新增读策略时需同步更新 casbin 初始化种子。

---

## Open Questions

### Resolved During Planning

- **领星 shopId 使用哪个字段**：`MappedShop.shopId` = `String(raw.sid)`，即领星内部 `sid`；`ShopBinding.lingxingShopId` 存储的是该值。Processor 中 `getListingsForShop(shopId, ...)` 传入的即是此 sid 字符串。✓
- **质量指标在哪里计算**：`ImportSummary.failures` 已包含失败 SKU 列表，成功率 = `(imported / total) * 100`，前端直接计算展示，不需后端新接口。✓

### Deferred to Implementation

- **Walmart listing 端点路径验证**：`/erp/sc/walmart/listing` 在 APISIX 迁移后是否需要调整 —— 实现时以真实领星文档为准，若路径有变只改 `listings.ts` 中的路径字符串。
- **Casbin admin 店铺**：seed 中是否已包含 `migration:read` 策略 —— 实现时检查 `apps/api/prisma/seed.ts` 中 casbin policies 数组。

---

## High-Level Technical Design

> _以下为方向性指引，供评审验证设计方向，不是实现规格，实现 agent 应将其作为参考而非直接照搬。_

```
前端 TriggerImportForm                   后端
─────────────────────────────────────────────────────
① 渲染时 → GET /migration/path-a/shops
              ?brandId=homtone
              &platformCode=amazon
                         ↓
         ShopBinding JOIN Shop WHERE
         lingxingShopId IS NOT NULL
         AND shop.brandId = brandId
         AND shop.platform.code = platformCode
                         ↓
         返回: [{ lingxingShopId, shopName, marketName }]

② 用户勾选店铺（含"全选"）→ POST /migration/path-a/jobs
   { brandId, marketCode, platformCode,
     shopIds: [lingxingShopId, ...] }
                         ↓
         BullMQ job → PathAImportProcessor（已有）

③ 轮询 GET /migration/path-a/jobs/:jobId（已有）
   job.status=completed → 前端渲染
   ImportJobProgress：
     ✓ 成功率 (imported/total)
     ✗ 失败 SKU 列表 + 原因
```

---

## Implementation Units

- [ ] U1. **后端：可用店铺查询接口**

**Goal:** 新增 `GET /migration/path-a/shops` 接口，返回指定品牌+平台下所有已绑定领星 shopId 的店铺列表，供前端选择器使用。

**Requirements:** R1, R6

**Dependencies:** 无（复用已有 `ShopService.list()` 逻辑或直接 Prisma 查询）

**Files:**

- Modify: `apps/api/src/migration/migration.controller.ts`
- Modify: `apps/api/src/migration/migration.module.ts`（注入 PrismaClientManager）
- Modify: `apps/api/prisma/seed.ts`（确认 `migration:read` casbin 策略已种入）
- Test: `apps/api/src/migration/migration.controller.spec.ts`（新建）

**Approach:**

- 在 `MigrationController` 中新增 `@Get('path-a/shops')` handler，接受 `brandId` 和 `platformCode` query 参数
- 直接用 Prisma 查询 `shop` JOIN `shopBinding`（where `lingxingShopId IS NOT NULL`）JOIN `platform`（code = platformCode）
- 返回 `{ lingxingShopId, shopName, platformName, marketName }[]`，前端只需展示名称、传递 lingxingShopId
- `RequirePolicy({ obj: 'migration', act: 'read' })`；若 casbin seed 未包含该策略需补入

**Patterns to follow:**

- `apps/api/src/shop/shop.controller.ts`：同样的 `@Get()` + `@RequirePolicy` + `@Headers('x-yaemart-brand')` 模式
- `apps/api/src/shop/shop.service.ts`：`list()` 中 include binding + platform + market 的写法

**Test scenarios:**

- Happy path: `GET /migration/path-a/shops?brandId=homtone&platformCode=amazon` → 返回所有 `lingxingShopId` 非 null 的 homtone × amazon 店铺
- Edge case: `platformCode=walmart` 但无绑定店铺 → 返回空数组 `[]`，HTTP 200
- Edge case: 不传 `brandId` → HTTP 400（class-validator `@IsString()` 校验）
- Security: 无 JWT 令牌调用 → HTTP 401；无 migration:read 权限 → HTTP 403

**Verification:**

- `GET /migration/path-a/shops?brandId=homtone&platformCode=amazon` 返回至少包含 shop 名称和 lingxingShopId 的数组
- Casbin migration:read 策略在 admin role 下生效

---

- [ ] U2. **前端：智能店铺选择器替换手动 textarea**

**Goal:** 将 `TriggerImportForm` 中的 shopId textarea 替换为从 API 加载的可多选店铺列表，并提供"全选"快捷操作。

**Requirements:** R1, R2

**Dependencies:** U1（后端接口）

**Files:**

- Modify: `apps/web/components/migration/trigger-import-form.tsx`
- Modify: `apps/web/lib/api/migration-client.ts`（新增 `listAvailableShops()` 函数）

**Approach:**

- 在 `migration-client.ts` 新增 `listAvailableShops(token, brandId, platformCode)` → 调用 U1 接口
- `TriggerImportForm` 在品牌/平台选择变化时 `useEffect` 拉取店铺列表
- 渲染为 checkbox 列表：店铺名 + 平台/市场标签；顶部加"全选/取消全选"
- 加载中状态用 `Loader2` skeleton；加载失败时展示 inline error + 降级到原 textarea 输入
- 已绑定领星 ID 的店铺才展示（由 API 保证），无已绑定店铺时展示引导文案"请先在店铺管理页绑定领星店铺"
- 选中 lingxingShopId 数组作为 `shopIds` 传给 trigger API

**Patterns to follow:**

- `apps/web/components/shop/shop-binding-list.tsx`：brand theme 变量用法、loading skeleton 模式
- `apps/web/components/shop/shops-page-client.tsx`：`useCallback` + `useEffect` 加载远程数据

**Test scenarios:**

- Happy path: 选择品牌=Homtone、平台=Amazon → 展示已绑定店铺列表，勾选后触发 → job 成功排队
- Edge case: 该品牌下无已绑定店铺 → 展示空状态引导文案，"全选"不可点击
- Edge case: API 加载失败 → 降级为手动输入 textarea，展示错误 banner
- UI: "全选"点击 → 所有店铺被勾选；再次点击 → 全部取消
- Regression: 表单提交时 `shopIds` 为空 → 不发请求，展示 inline error "请至少选择一个店铺"

**Verification:**

- 切换品牌/平台后，店铺列表自动刷新
- 提交后 `TriggerPathAImportPayload.shopIds` 只包含 lingxingShopId，不含内部主键

---

- [ ] U3. **前端：迁移质量报告嵌入任务进度 UI**

**Goal:** 任务完成后，在 `ImportJobProgress` 中展示成功率、失败 SKU 列表（含失败原因），让运营可直接在 UI 内判断是否达到 M-07 准确率基线。

**Requirements:** R3

**Dependencies:** 无（`PathAImportJobDetail.imported/failed/failures` 字段已由后端返回）

**Files:**

- Modify: `apps/web/components/migration/import-job-progress.tsx`
- Modify: `apps/web/lib/api/migration-client.ts`（`PathAImportJobDetail` 类型已包含 failures，确认字段）

**Approach:**

- 当 `job.status === 'completed'` 且 `job.imported !== undefined` 时渲染质量摘要块：
  - 成功率圆环或进度条：`Math.round((imported / (imported + failed)) * 100)%`
  - 成功/失败数量徽章
  - 若 `failures.length > 0`：可展开的失败 SKU 表格（SKU | 失败原因）
  - 达标提示：成功率 ≥ 85% 展示绿色"准确率达标 ≥ M-07"；< 85% 展示黄色警告
- 当 `job.status === 'failed'` 时展示 `job.error` 字符串

**Patterns to follow:**

- `apps/web/components/migration/import-job-progress.tsx` 现有 status badge 样式
- `apps/web/components/shop/shop-binding-list.tsx`：inline error banner 样式

**Test scenarios:**

- Happy path: `imported=85, failed=15, total=100` → 成功率 85%，黄色警告（恰好在临界值）
- Happy path: `imported=90, failed=10, total=100` → 成功率 90%，绿色达标
- Edge case: `failures` 数组非空 → 展示可折叠失败列表
- Edge case: `failures` 为空 → 不展示失败区块
- Edge case: `imported=0, failed=0`（空运行）→ 展示"本次无数据"

**Verification:**

- 任务完成后质量摘要即时渲染，无需刷新页面
- 成功率计算公式为 `imported / (imported + failed)`（不含 deduplicated 跳过的记录）

---

- [ ] U4. **端到端验收：Spoonlemon × Amazon + Walmart 迁移运行**

**Goal:** 以真实 Spoonlemon 领星数据运行 Path A 管线，验证 Homtone+Spoonlemon × Amazon+Walmart 各 2 个店铺的 8 款以上 SKU，准确率 ≥ M-07。

**Requirements:** R4, R5

**Dependencies:** U1, U2, U3（所有 UI 就绪）；Spoonlemon 店铺已在 `/shops` 页面绑定领星 ID（运营操作前置）

**Files:**

- Create: `scripts/migration/run-w21-23-acceptance.md`（验收脚本文档，非代码）
- Modify: `apps/api/prisma/seed.ts`（若 Spoonlemon 店铺 lingxingShopId 已知，可更新占位 externalId）

**Approach:**

- 前置：运营在 `/shops` 页面确认 Spoonlemon × Amazon US + DE + UK、Spoonlemon × Walmart US 的 lingxingShopId 已设置
- 运行顺序：
  1. Homtone × Amazon US（已有，回归验证）
  2. Homtone × Walmart US
  3. Spoonlemon × Amazon US
  4. Spoonlemon × Walmart US
- 每次运行后：记录 imported/failed 数量，导出 failures 列表，与运营逐条核对 5 款产品的字段匹配度
- M-07 基线（准确率 ≥ 85%）：`imported / (imported + failed) ≥ 0.85`
- 若不达标：检查 `PathAExtractService` prompt 或 `mapLingxingPathAExtraction` 映射，对症修复（不在本 U 中改代码，而是作为 defect 新建任务）

**Execution note:** 先跑 Homtone × Amazon 做基准（如已知成功），再新增 Spoonlemon 和 Walmart。

**Test scenarios:**

- Integration: Homtone × Amazon US，选取至少 2 个绑定店铺 → job 完成，imported > 0，无 Redis/Lingxing 认证错误
- Integration: Spoonlemon × Amazon US → 成功率 ≥ 85%
- Integration: 任一品牌 × Walmart US → `LingxingWalmartListingRaw` 字段完整映射，bullet_points 出现在 `keyFeatures` 而非 `bulletPoints`
- Regression: 第二次触发相同 shopId → deduplication 生效，`deduplicated > 0`，不新增重复产品档案

**Verification:**

- 4 次迁移运行均完成（status=completed），无 active/failed 状态残留
- `scripts/migration/run-w21-23-acceptance.md` 包含实际运行截图或日志，由运营签字确认

---

## System-Wide Impact

- **Interaction graph:** `MigrationController` 新增查询只读 `shopBinding`，不触发 audit log；ShopService 无改动
- **Error propagation:** U1 接口若 Prisma 查询失败 → HTTP 500，前端降级为手动输入 textarea（U2 降级路径）
- **State lifecycle risks:** BullMQ job 并发：同一 shopId 被多个 job 处理时，`pickLatestBySku` 冲突规则已处理（`conflict-rules.ts`），无需额外保护
- **API surface parity:** `migration-client.ts` 的 `listAvailableShops()` 函数与 U1 接口一一对应，类型严格匹配
- **Integration coverage:** U4 是唯一跨越 Lingxing API → Gemini → Prisma 完整链路的验收；U1-U3 为支撑基础设施

---

## Risks & Dependencies

| 风险                                                                     | 缓解措施                                                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Spoonlemon 店铺在 `/shops` 页面尚未绑定领星 ID（运营尚未操作）           | U1/U2 先行上线；U4 等运营确认绑定后再执行，计划中明确标注为前置条件                |
| Walmart 领星 API 端点 `/erp/sc/walmart/listing` 在 APISIX 迁移后路径有变 | U4 实际运行时若遇 404/签名错误，立即对照领星官方文档更新 `listings.ts`，改动范围小 |
| Gemini 提取准确率未达 M-07（< 85%）                                      | U3 质量报告提供 failures 列表辅助诊断；若不达标，在 U4 验收阶段创建独立 fix 任务   |
| Casbin `migration:read` 策略缺失导致 U1 接口始终 403                     | 在 U1 实现时同步检查并补种 casbin seed；plan-ahead 标注为实现时 checklist 项       |

---

## Documentation / Operational Notes

- 运营前置步骤：W21-W23 执行前，需在 `/shops` 页面完成 Spoonlemon 所有店铺的领星绑定
- 验收文档路径：`scripts/migration/run-w21-23-acceptance.md`，含运行命令、截图记录栏、运营签字区
- S2 上线前 Feature Flag：`feature_flag.PATH_A_MIGRATION` 已在 SystemConfig 模型中可配置，W26 前确认为 `"true"`

---

## Sources & References

- **Origin document:** [docs/yaemartOS-implementation-plan.md § W21-W23](docs/yaemartOS-implementation-plan.md)
- Related code: `apps/api/src/migration/`, `apps/web/components/migration/`, `packages/lingxing-client/src/operations/listings.ts`
- Related plans: `docs/plans/2026-05-01-004-feat-w7-lingxing-openapi-credential-shop-binding-plan.md`（店铺绑定前置）
