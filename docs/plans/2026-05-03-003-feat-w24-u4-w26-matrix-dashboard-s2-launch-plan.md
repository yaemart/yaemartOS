---
title: 'feat: W24-U4 + W26 矩阵分析 Dashboard + S2 上线准备'
type: feat
status: active
date: 2026-05-03
origin: docs/plans/2026-05-03-002-feat-w24-w25-multi-platform-listing-matrix-plan.md
---

# feat: W24-U4 + W26 矩阵分析 Dashboard + S2 上线准备

## Overview

W24-W25 的 U1–U3 已完成（批量生成 API、L1 审计日志、矩阵分析后端 + EmbeddingService）。本计划交付剩余三块：

1. **U4**：矩阵分析前端 Dashboard（完成 W24-W25 最后功能单元，R4/R5）。
2. **U5**：`LISTING_MATRIX` Feature Flag 闸门（W26 灰度开放前提）。
3. **U6**：W26 S2 上线准备（12 人 beta 所需环境核验 + Feature Flag seed + 上线 checklist）。

W26 的 S2 上线要求双品牌（Homtone + Spoonlemon）× 双平台（Amazon + Walmart）× 12 名运营可用，本计划是 W26 末 milestone 的最后功能交付与上线前置。

---

## Problem Frame

运营现在可以在后端生成多平台 Listing，但没有前端视图来查看同一产品跨平台的差异化程度，无法判断是否需要调整 `trafficStrategy`。与此同时，W26 上线需要以下前置条件：`LISTING_MATRIX` 功能通过 Feature Flag 按品牌灰度开放、`GEMINI_EMBED_MODEL` 等环境变量已部署、12 人 beta 的品牌级开关已配置。

---

## Requirements Trace

- R4. 矩阵分析前端 Dashboard：按产品查看跨平台 listing 汇总、相似度可视化、strategy 分布
- R5. 所有文案使用"矩阵分析"/"差异化建议"/"相似度评分"等中性词，不出现"违规"/"合规风险"字眼
- W26-1. Feature flag 按品牌+平台控制矩阵分析功能可见性
- W26-2. S2 上线：双品牌双平台 12 人 beta 运营可用

---

## Scope Boundaries

- 不含销售额/曝光数据展示（`salesAvailableFrom: 'S4'` 占位，前端标注"S4 上线后可用"）
- 不含矩阵分析写操作（只读 GET `/listings/matrix`）
- 不含多语言批量生成（S3 W29-W30 交付）
- U4 dashboard 不依赖外部图表库；使用纯 CSS + Tailwind 渲染相似度矩阵与策略分布柱状

### Deferred to Follow-Up Work

- ES 向量字段扩展：S3 W27-W28 在语义搜索时同步推进
- 12 人 beta 反馈闭环（录屏 + 反馈表）：W26 运营正式上线后的 PM 跟踪任务

---

## Context & Research

### Relevant Code and Patterns

- `apps/web/lib/api/listing-client.ts` — 已有 `authHeaders` + `request<T>` 模式；在此文件追加 `getListingMatrix`
- `apps/web/app/[locale]/(admin)/listings/[id]/page.tsx` — Server Component，`requireAuth` 后传 `accessToken` + `brandId` 给 Client Shell；增加 matrix tab 入口
- `apps/web/components/migration/trigger-import-form.tsx` — AbortController + 分支 UI（loading / error / data）模式
- `apps/web/components/shop/shop-binding-list.tsx` — 原生 `<table>` + `rounded-xl border bg-white` 风格
- `apps/web/tailwind.config.ts` — `brand.primary`、`brand.primary/10` 等已注册 CSS 变量色
- `apps/web/components/settings/feature-flags-panel.tsx` — 功能开关 UI；key 约定如 `feature_flag.LISTING_AI`，可加品牌后缀
- `apps/api/src/common/feature-flag/feature-flag.service.ts` — `isEnabled(key, brand?)` 方法；DB `SystemConfig` 优先于环境变量
- `apps/api/src/settings/settings.controller.ts` — `GET/PUT feature-flags` 端点
- `apps/api/prisma/seed.ts` — 初始 Feature Flag 数据写入示例

### Institutional Learnings

- W24-W25 计划中的 `salesAvailableFrom: 'S4'` 约定：前端对空数据区域统一显示"S4 上线后可用"

---

## Key Technical Decisions

- **矩阵 dashboard 挂载点**：在 `listings/[id]/page.tsx` 增加"矩阵分析"Tab，`productId` 从 listing 的 `productId` 字段获取；Tab 只读，不含编辑操作，与现有 Editor Tab 并列。
- **Feature Flag 键名**：`feature_flag.LISTING_MATRIX`（不加品牌后缀，通过 `brand?` 参数实现品牌级开关），与已有的 `feature_flag.LISTING_AI` 命名风格对齐。
- **相似度矩阵渲染**：不引入第三方图表库；以纯 HTML `<table>` + `bg-brand-primary/N` inline style opacity 渐变（`opacity = similarity`）表示相似度；保持零额外依赖。
- **Strategy 分布柱状图**：纯 CSS width percentage + `bg-brand-primary` fill，单 `<div>` bar per strategy，不需要 recharts / d3。
- **W26 环境核验**：使用 pnpm script `check:env:s2` 在 apps/api 侧读取 process.env，列出 S2 必需变量的有/缺状态，不使用硬编码脚本文件。

---

## Open Questions

### Resolved During Planning

- **Q: 矩阵 dashboard 放哪个入口页面？** → 放 `listings/[id]/page.tsx` 的 Tab；该页已有 auth guard + brandId，无需新路由。
- **Q: Listing 详情页是否有 Tab 切换机制？** → 当前 `ListingEditorShell` 是单视图（编辑器）；需在 page 层增加简单 Tab 路由（`?tab=matrix`），server 侧读取 `searchParams.tab` 决定渲染哪个 Client Component。
- **Q: Feature Flag 是否影响 API？** → U3 的 `GET /listings/matrix` 已对全部 `listings:read` 权限用户开放；U5 只控制前端 Tab 的**可见性**，不新增 API 层门卫（保持 API 对 Agent 始终可用，符合 Agent-native 要求）。

### Deferred to Implementation

- 矩阵分析 Tab 的 SSR vs CSR 切换策略（服务端直接预取 matrix data，还是 Client Component 挂载后拉取）— 建议 CSR（matrix 数据依赖 embedding 计算，不适合 SSR cache），实施时根据实际响应时间确认。
- `getListingMatrix` 的超时处理 — Gemini embedding 最长 10s；实施时决定是否加 `signal` with timeout。

---

## High-Level Technical Design

> _此流程图说明意图，为审查提供方向，不作为实现规范。_

```
listings/[id]/page.tsx（Server Component）
  ├── Tab=editor（默认）→ <ListingEditorShell />（现有 Client Shell）
  └── Tab=matrix → <ListingMatrixDashboard productId={listing.productId} accessToken token brandId />
                          │
                          └── useEffect → getListingMatrix(token, productId, brandId)
                                            │  GET /listings/matrix?productId=xxx
                                            │  Authorization: Bearer + x-yaemart-brand
                                            ▼
                                 {listings, similarityMatrix, strategyDistribution, salesAvailableFrom}
                                          │
                                 ┌────────┴─────────────────────────────┐
                                 │ 汇总卡片                 矩阵表       策略柱图    │
                                 │ N listings             NxN table    bar rows  │
                                 │ N platforms            opacity      CSS width  │
                                 │ primary badge          gradient     % fill     │
                                 └──────────────────────────────────────────────┘

Feature Flag Gate（U5）:
  AdminShell → fetchCapabilities() → capability: LISTING_MATRIX
    → Tab 仅在 capability 存在时渲染（API 不受影响）
```

---

## Implementation Units

- [ ] U4. **矩阵分析前端 Dashboard**

**Goal:** 运营可在 Listing 详情页切换到"矩阵分析"Tab，查看同产品跨平台 listing 的相似度矩阵、strategy 分布，以及 S4 数据占位提示。

**Requirements:** R4, R5

**Dependencies:** U3（`GET /listings/matrix` 端点已完成）

**Files:**

- Modify: `apps/web/lib/api/listing-client.ts`（追加 `getListingMatrix` 函数）
- Create: `apps/web/components/listing/listing-matrix-dashboard.tsx`
- Modify: `apps/web/app/[locale]/(admin)/listings/[id]/page.tsx`（增加 matrix Tab 路由）

**Approach:**

- 在 `listing-client.ts` 追加 `getListingMatrix(accessToken, productId, brand?, signal?)` → `GET /listings/matrix?productId=xxx`，使用文件内已有私有 `authHeaders` + `request<T>` 模式；返回类型为 `ListingMatrixResult`（含 `listings`, `similarityMatrix`, `strategyDistribution`, `salesAvailableFrom`）
- `listing-matrix-dashboard.tsx`（`'use client'`）：接受 `productId, accessToken, brandId` props；用 `useState` + `useEffect` + `AbortController` 拉取数据（模式同 `trigger-import-form.tsx`）
  - 加载中：`Loader2` spinner（同现有组件）
  - 错误：amber 边框提示
  - 空状态（listings 数 < 2）：显示"当前产品仅有 N 条 Listing，暂无可对比数据"
  - 正常态：三区布局（汇总卡片行 → 矩阵表 → 策略柱图）
  - 矩阵表：NxN 原生 `<table>`，列/行头显示 `{platformCode} / {shopName}` 前 20 字符，单元格 `bg-brand-primary` + `opacity` = similarity 值，对角线跳过；悬停 tooltip 显示精确百分比
  - 策略柱图：每策略一行 `<div>`，bar width 为占总数百分比，fill 用 `bg-brand-primary`，行标为策略名（不出现违规类字眼，R5）
  - `salesAvailableFrom: 'S4'` 时在底部显示"销售数据将于 S4 上线后可用"灰色占位块
- `listings/[id]/page.tsx`：在 server 侧读 `searchParams.tab`（`'editor' | 'matrix'`，默认 `'editor'`）；渲染 Tab 导航栏（"编辑器" / "矩阵分析"两 Tab，用 Link 切换 `?tab=xxx`）；`tab === 'matrix'` 时渲染 `<ListingMatrixDashboard>`（传 `listing.productId, accessToken, brandId`），否则渲染现有 `<ListingEditorShell>`

**Patterns to follow:**

- AbortController + loading/error/data 三分支：`trigger-import-form.tsx`
- 表格 UI 风格：`shop-binding-list.tsx`（`rounded-xl border bg-white`、原生 `<table>`）
- Tab 导航链接风格：参考 `admin-shell.tsx` nav item 的 active/inactive 状态（`border-b-2 border-brand-primary` vs `text-zinc-500`）
- 品牌色：`bg-brand-primary/10`、`text-brand-primary`（Tailwind `brand.*`）

**Test scenarios:**

- Happy path: 3 条 listing（2 Amazon + 1 Walmart），相似度矩阵 3×3，策略柱图包含至少 1 行，销售占位块可见
- Edge case: listing 数 < 2 → 渲染空状态提示，不渲染矩阵表
- Edge case: 所有 listing 无 title → `similarityMatrix` 为 `{}`，矩阵区域显示"暂无标题数据"
- Edge case: `salesAvailableFrom === 'S4'` → 底部显示占位块
- Error path: `getListingMatrix` 抛 fetch error → 显示错误提示，不崩溃
- R5 compliance: 渲染输出不含"违规"/"合规风险" 等字样（文本检索验证）
- AbortController: 快速切换 productId → 旧请求被 abort，不产生状态竞态（测试 mock 调用次数）

**Verification:**

- TypeScript 零报错，无 lint 警告
- 开发环境下可在 `listings/[id]?tab=matrix` 看到矩阵分析 Tab（dev preview 演示）
- 所有文案符合 R5 中性化（文本搜索无"违规"/"合规风险"字样）

---

- [ ] U5. **LISTING_MATRIX Feature Flag 闸门**

**Goal:** `LISTING_MATRIX` 功能通过 `SystemConfig` Feature Flag 按品牌灰度开放；矩阵分析 Tab 仅在 Flag 启用时可见，API 层不受限（保持 Agent-native 可用）。

**Requirements:** W26-1

**Dependencies:** U4

**Files:**

- Modify: `apps/api/src/common/feature-flag/feature-flag.service.ts`（注册 `LISTING_MATRIX` 默认键）
- Modify: `apps/api/src/auth/auth.service.ts` 或 `capabilities`（将 `LISTING_MATRIX` 列入 capability 列表）
- Modify: `apps/web/app/[locale]/(admin)/listings/[id]/page.tsx`（用 capability 控制 matrix Tab 渲染）
- Modify: `apps/api/prisma/seed.ts`（为开发环境插入 `feature_flag.LISTING_MATRIX = 'true'` 种子数据）

**Approach:**

- 在 `feature-flag.service.ts` 的已知 flag key 列表中追加 `feature_flag.LISTING_MATRIX`；保持 `isEnabled(key, brand?)` 调用签名不变
- 在 capabilities 解析处（`fetchCapabilities` 对应的后端 controller）将 `LISTING_MATRIX` capability 加入列表（参考 `LISTING_AI` 的处理方式）
- `listings/[id]/page.tsx`：在现有 capabilities 对象中检查 `capabilities.LISTING_MATRIX`；为 false 时隐藏"矩阵分析"Tab 和 `<ListingMatrixDashboard>`
- `prisma/seed.ts`：仅在 `NODE_ENV !== 'production'` 时插入 `{ category: 'feature_flag', key: 'feature_flag.LISTING_MATRIX', value: 'true', label: '矩阵分析 Dashboard' }`

**Patterns to follow:**

- 参考 `feature_flag.LISTING_AI` 在 `feature-flag.service.ts` 和 capabilities 中的注册方式
- Seed 写法参考 `apps/api/prisma/seed.ts` 中已有的 feature flag upsert 模式

**Test scenarios:**

- Happy path: `feature_flag.LISTING_MATRIX = 'true'` → capabilities 含 `LISTING_MATRIX`，page 渲染 matrix Tab
- Feature off: `feature_flag.LISTING_MATRIX = 'false'` 或缺失 → page 不渲染 matrix Tab，但 `GET /listings/matrix` API 仍可调用返回 200
- Brand scope: Homtone 开启 / Spoonlemon 关闭 → 各自 capabilities 独立；Spoonlemon 登录用户看不到 matrix Tab（如果后端 flag 支持 brand 参数）
- Edge case: seed 仅在非 production 写入（检查条件逻辑）

**Verification:**

- 设置 flag `false` → 详情页无矩阵分析 Tab
- 设置 flag `true` → Tab 出现，dashboard 正常渲染
- TypeScript 零报错

---

- [ ] U6. **W26 S2 上线准备**

**Goal:** 完成 S2 上线前置工作：必需环境变量核验、12 人 beta 开关配置指引、上线 checklist 文档。W26 末可安全开放 12 名运营 beta 试用。

**Requirements:** W26-2

**Dependencies:** U5

**Files:**

- Create: `scripts/ops/check-s2-env.ts`（可执行的环境变量核验脚本）
- Create: `docs/runbooks/w26-s2-launch-checklist.md`（上线 checklist 文档）

**Approach:**

- `check-s2-env.ts`：读取 `process.env` 检查 S2 必需变量是否存在且非空；打印通过/缺失表格，缺失时以非零退出码退出（可嵌入 CI/CD 预检）
  - 必检变量清单：`GEMINI_API_KEY`、`GEMINI_EMBED_MODEL`（应为 `text-embedding-004`）、`REDIS_URL`、`DATABASE_URL`、`NEXTAUTH_SECRET`、`LINGXING_APP_ID`、`LINGXING_APP_SECRET`
- `w26-s2-launch-checklist.md`：结构化 Markdown checklist，覆盖以下步骤：
  1. 运行 `pnpm --filter @yaemartos/api run check:env:s2` 确认环境变量 ✅
  2. 在 Settings → Feature Flags 开启 `LISTING_MATRIX`（Homtone + Spoonlemon）
  3. 在 Settings → Feature Flags 确认 `LISTING_AI`、`BATCH_LISTING_GENERATE` 对双品牌已开启
  4. 验证 Redis 中 `listing:embed:*` 键可写（跑一次矩阵分析触发 embedding）
  5. 邀请 12 名 beta 用户，分配 `listing_editor` 角色（双品牌各 6 人）
  6. 录屏路径：Homtone + Spoonlemon × 批量生成 + 矩阵分析
  7. 反馈表链接填入 `AdminShell` 通知条
- `package.json`（apps/api）：追加 `"check:env:s2": "tsx scripts/ops/check-s2-env.ts"` script

**Patterns to follow:**

- 脚本语法参考 `apps/api/prisma/seed.ts`（tsx 执行，`process.env` 读取，无外部依赖）
- Checklist 文档格式参考 `scripts/migration/run-w21-23-acceptance.md`

**Test scenarios:**

- Happy path: 所有必需变量均设置 → 脚本打印全绿 + 退出码 0
- Error path: `GEMINI_EMBED_MODEL` 缺失 → 脚本打印缺失项 + 退出码 1
- Error path: `GEMINI_EMBED_MODEL` 存在但值不是 `text-embedding-004` → 打印警告（非致命）
- Edge case: 生产环境中运行（`NODE_ENV=production`）→ 脚本正常运行（核验与环境无关）

**Verification:**

- `pnpm --filter @yaemartos/api run check:env:s2` 可执行，在有/无缺失变量时分别给出正确退出码
- `w26-s2-launch-checklist.md` 覆盖所有 W26 milestone 前置步骤
- TypeScript 零报错（`scripts/ops/check-s2-env.ts`）

---

## System-Wide Impact

- **API surface parity**：`GET /listings/matrix` 在 U3 已对 `listings:read` 用户开放，本计划的 U5 Feature Flag 仅控制前端 Tab 可见性，API 对 Agent 始终可用（Agent-native 要求）。
- **Capabilities object**：U5 在 `fetchCapabilities` 响应中新增 `LISTING_MATRIX` 字段；现有 capabilities 消费代码（`AdminShell` capability-gated 菜单等）使用可选链访问，不受新字段影响。
- **Unchanged invariants**：现有 `listings/[id]` 默认路由行为（`tab=editor`）不变；`ListingEditorShell` 渲染路径无变化。

---

## Risks & Dependencies

| Risk                                                              | Mitigation                                                                                                           |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `listings/[id]/page.tsx` 增加 `searchParams` prop 后 SSG 缓存失效 | 该页已是完全动态（`requireAuth`）；`searchParams` 不影响缓存策略                                                     |
| Gemini embedding 在 beta 期间频繁调用消耗 quota                   | EmbeddingService 已有 Redis 24h 缓存；beta 12 人规模下每产品 embedding 调用可忽略                                    |
| Feature Flag capability 命名与已有 keys 冲突                      | 采用 `LISTING_MATRIX`（大写）capability + `feature_flag.LISTING_MATRIX`（小写点分） DB key，与 `LISTING_AI` 完全对齐 |
| check-s2-env.ts 脚本在 CI 中阻塞部署                              | 脚本仅在必需变量**完全缺失**时退出码非零；值存在但格式警告不阻塞                                                     |

---

## Documentation / Operational Notes

- W26 上线时执行 `check:env:s2` 核验，确认 `GEMINI_EMBED_MODEL=text-embedding-004` 已在生产环境设置
- Redis `listing:embed:*` TTL 24h，正常运营无需手动清理；模型版本升级时批量删除（见 W24-W25 计划注释）
- beta 反馈收集渠道需在 `AdminShell` 通知条（现有 Banner 组件）中嵌入链接，由 PM 在 W26 上线当日激活

---

## Sources & References

- Origin plan: `docs/plans/2026-05-03-002-feat-w24-w25-multi-platform-listing-matrix-plan.md`
- Implementation plan §7 S2 W24-W26：矩阵分析 + S2 上线
- Related API: `apps/api/src/listing/listing.controller.ts` (`GET /listings/matrix`)
- Related API: `apps/api/src/ai/embedding.service.ts`
- Related frontend: `apps/web/lib/api/listing-client.ts`
- Related frontend: `apps/web/app/[locale]/(admin)/listings/[id]/page.tsx`
- Related feature flags: `apps/api/src/common/feature-flag/feature-flag.service.ts`
- Related settings UI: `apps/web/components/settings/feature-flags-panel.tsx`
