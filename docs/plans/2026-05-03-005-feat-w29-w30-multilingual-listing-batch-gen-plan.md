---
title: 'feat: W29–W30 多语言批量生成收尾 + Listing 语言过滤'
type: feat
status: active
date: 2026-05-03
origin: docs/plans/2026-05-03-004-feat-w27-w28-locale-model-multilang-strategy-plan.md
---

# feat: W29–W30 多语言批量生成收尾 + Listing 语言过滤

## Overview

W27–W28 已完成了多语言核心基础设施：`Locale` 实体、`LocaleController`、
`batch-generate` 的 `languages[]` 笛卡尔积、`LocaleSwitcher` 组件、前端
`fetchMarketLocales`/`fetchSiblingListings`/`batchGenerateMultilingual` 函数
以及编辑器内的多语言生成按钮。

W29–W30 目标是**完成闭环**：

1. **`GET /listings` 语言过滤**：后端 + 前端列表页新增 `?language=` 过滤器，
   让运营在生成 ES/FR 版本后能快速筛选查看
2. **批量生成结果反馈**：当前编辑器静默刷新，需展示每个语言×平台的生成
   结果（成功/失败计数），给运营明确的操作反馈
3. **Dev env 文档补全**：`.env.local.example` 补充
   `NEXT_PUBLIC_FEATURE_MULTILINGUAL_LISTING_GENERATION=true`
4. **集成测试**：6 版本（EN/ES/FR × Amazon/Walmart）批量生成路径的端到端覆盖

W31–W33 客户中心 V1 门户依赖 W29–W30 的 `Locale` 基础设施稳定，本计划是 S3
进入客户中心阶段前的最后收尾。

---

## Problem Frame

经 W27–W28 实施后，运营可以在 Listing 编辑器内点击"一键多语言生成"，后端
并发生成 EN/ES/FR × Amazon/Walmart 最多 6 个版本。但有以下待完善项：

1. **列表页无语言过滤**：Listing 列表（`/listings`）只支持按状态过滤，
   不支持 `?language=es` 过滤，运营生成完 ES 版本后无法快速定位
2. **结果无 UI 反馈**：`startMultilingualGeneration()` 成功后只做 `router.refresh()`，
   若有个别语言失败（如 FR 版本 Gemini 超时），运营完全不知情
3. **Env 文档缺口**：`.env.local.example` 未包含
   `NEXT_PUBLIC_FEATURE_MULTILINGUAL_LISTING_GENERATION`，新开发者本地启动后
   多语言按钮永远不出现（因默认值 `false`）
4. **测试覆盖**：6-combo 笛卡尔积路径无集成测试

---

## Requirements Trace

- R1. `GET /listings` 支持 `?language=<LocaleCode>` 过滤（backend 服务层 + 控制器）
- R2. 列表页新增语言过滤 Tab（全部 / EN / ES / FR），与现有状态过滤并列
- R3. `startMultilingualGeneration()` 完成后展示每个语言+平台的生成结果摘要
  （成功 N 条，失败 M 条；失败时显示原因）
- R4. `.env.local.example` 补充 `NEXT_PUBLIC_FEATURE_MULTILINGUAL_LISTING_GENERATION=true`
- R5. `listing.controller.spec.ts` 覆盖 6-combo 笛卡尔积 + 部分失败场景

---

## Scope Boundaries

- 不在本计划实现实时生成进度（SSE/WebSocket）——保持同步响应 + spinner，推迟至 W34+
- 不修改 `MULTILINGUAL_ENABLED` env var 向 capabilities prop 的重构（保留现有 env var 模式）
- 不实现 DE/IT 语言过滤（`BATCH_LOCALES` 已含，但 S3 不激活 DE/IT）
- 语言过滤不与状态过滤做交叉组合 URL（复杂度过高，`?language=es&status=draft` 留 S4+）

### Deferred to Follow-Up Work

- SSE 实时进度推送：W34 客户中心 AI Chat 阶段一并做 streaming 基础设施
- `MULTILINGUAL_ENABLED` 改用 server capabilities prop：S4 统一 capabilities 重构时处理

---

## Context & Research

### Relevant Code and Patterns

- `apps/api/src/listing/listing.service.ts` — `ListListingsQuery` type（L29–37）无
  `language` 字段；`list()` 方法的 `where` 构造（L71–79）需追加 language 条件
- `apps/api/src/listing/listing.controller.ts` — `@Get()` 端点（L91）已有
  `status / shopId / platformId` 查询参数，`language` 同模式追加
- `apps/web/app/[locale]/(admin)/listings/page.tsx` — 现有状态过滤 Tab（L8–15, L51–67）
  是语言过滤的参考样式
- `apps/web/components/listing/listing-editor-shell.tsx` — `startMultilingualGeneration()`
  函数（约 L122–165）当前静默 `router.refresh()`，需接收并展示 API 返回的 results
- `apps/web/components/listing/locale-switcher.tsx` — 已实现的语言 Tab 组件，
  语言过滤 Tab 可复用相同视觉风格
- `apps/api/src/listing/listing.controller.spec.ts` — 现有批量生成测试，需扩展
  多语言 + 部分失败场景

### Institutional Learnings

- **`Promise.allSettled` 部分失败模式**：batch-generate 已用此模式；前端结果
  展示需对应处理 `status: 'failed'` 的 combo（参见 W24-W25 审计日志经验）
- **状态过滤 URL 模式**：列表页已用 `?status=draft` query param + `<Link>`，
  语言过滤沿用同一模式，不引入新状态管理库
- **枚举过滤的 Prisma 模式**：`where: { status: query.status as ListingStatus }`——
  language 使用同样的 `as LocaleCode` 类型断言

### External References

- 无需外部研究：本地模式充分（listing 过滤、状态 Tab、部分失败展示皆有现成参考）

---

## Key Technical Decisions

- **语言过滤 URL 参数名用 `language`（不用 `locale`）**：与 Listing 数据模型的
  `language` 字段保持一致；避免与 Next.js App Router 的 `[locale]` segment 混淆
- **语言过滤 Tab 静态枚举**：仅显示 `全部 / EN / ES / FR`（不动态拉 `/locales`
  API），因为 S3 北美激活语言固定，动态化反而增加 waterfall 请求
- **结果反馈用 inline alert**：不引入 toast 库，沿用现有 `alert()` 风格但改为
  inline summary panel（`<div role="status">`），避免 A11y 问题和新依赖

---

## Open Questions

### Resolved During Planning

- **语言过滤是否要支持多选**：否——单选下拉/Tab 足够，多选留 S4 高级筛选
- **结果反馈是否需要持久化**：否——页面刷新后消失，运营可通过列表页语言过滤验证结果

### Deferred to Implementation

- 6 combo 并发时如果某个语言全部超时（>30s），前端 spinner 无超时提示——
  实现时若发现响应时间超过 UI 可接受范围，临时加 30s `AbortController` 超时

---

## Implementation Units

- [ ] U1. **后端：`GET /listings` 语言过滤**

**Goal:** 让列表端点支持 `?language=en` 过滤，运营可按语言维度筛选 Listing。

**Requirements:** R1

**Dependencies:** 无（`Locale` 模型在 W27-W28 已完成，listing 表已有 `language` 字段）

**Files:**

- Modify: `apps/api/src/listing/listing.service.ts`
- Modify: `apps/api/src/listing/listing.controller.ts`
- Test: `apps/api/src/listing/listing.controller.spec.ts`

**Approach:**

- `ListListingsQuery` 新增 `language?: string` 字段
- `list()` 的 `where` 构造追加 `...(query.language ? { language: query.language as LocaleCode } : {})`
- Controller `@Get()` 追加 `@Query('language') language?: string`，传入 `list()` 调用
- 遵循现有 `status / shopId / platformId` 参数的完全相同模式

**Patterns to follow:**

- `apps/api/src/listing/listing.service.ts` L71–79 的 `where` 构造模式
- `apps/api/src/listing/listing.controller.ts` `@Get()` 端点参数模式

**Test scenarios:**

- Happy path: `?language=es` → 只返回 `language === 'es'` 的 listings
- Happy path: `?language=en&brandId=xxx` → brandId + language 双重过滤生效
- Edge case: 无 `language` 参数 → 返回全部语言（向后兼容）
- Edge case: `?language=de`（未激活但合法的 LocaleCode）→ 返回空列表，无 400 错误

**Verification:**

- `listing.controller.spec.ts` 新增测试全绿
- `GET /listings?language=es` 在集成环境只返回 ES 语言 listings

---

- [ ] U2. **前端：Listing 列表页语言过滤 Tab**

**Goal:** 在 Listing 列表页顶部新增语言过滤 Tab（全部 / EN / ES / FR），
让运营在批量生成完成后能快速定位新生成的语言版本。

**Requirements:** R2

**Dependencies:** U1

**Files:**

- Modify: `apps/web/app/[locale]/(admin)/listings/page.tsx`
- Modify: `apps/web/lib/api/listing-client.ts`（`listListings` 函数新增 `language` 参数）

**Approach:**

- `listListings()` 函数新增可选 `language?: string` 参数，追加到查询字符串
- 列表页读取 `searchParams.language` 并传入 `listListings()`
- 新增语言过滤 Tab 区域（静态枚举 `['', 'en', 'es', 'fr']`，label `全部/EN/ES/FR`）
- Tab 激活样式与现有状态 Tab 一致（`bg-[rgb(var(--brand-primary))]`）
- Tab href 格式：`/${locale}/listings?language=es`（若同时有 status 则追加 `&status=draft`）

**Patterns to follow:**

- `apps/web/app/[locale]/(admin)/listings/page.tsx` L8–67 现有状态过滤 Tab 模式

**Test scenarios:**

- Happy path: 点击"ES" Tab → URL 变为 `?language=es`，列表只显示 ES 版本
- Happy path: "全部" Tab 无 `language` 参数 → 显示所有语言
- Edge case: 无 ES Listing 时显示空状态，不报错
- Integration: 语言 Tab 与状态 Tab 的 href 不互相覆盖（已有 status 参数时语言 Tab 保留 status）

**Verification:**

- 列表页顶部出现"全部 / EN / ES / FR"4 个语言 Tab
- 点击 Tab 后列表按语言过滤，面包屑 URL 可书签收藏

---

- [ ] U3. **前端：批量生成结果反馈**

**Goal:** `startMultilingualGeneration()` 完成后显示 inline 结果摘要，
让运营明确知道哪些语言×平台版本生成成功或失败。

**Requirements:** R3

**Dependencies:** 无（纯前端，不依赖 U1/U2）

**Files:**

- Modify: `apps/web/components/listing/listing-editor-shell.tsx`

**Approach:**

- 新增 state `multilingualResult: { succeeded: number; failed: { language: string; platformCode: string; error: string }[] } | null`
- `startMultilingualGeneration()` 捕获 API 返回的 `results` 数组，统计
  `status === 'completed'` 和 `status === 'failed'` 数量
- 结果展示：`<div role="status">` inline panel，绿色显示"✓ N 个版本生成成功"，
  红色列出失败 combo（语言 + 平台 + 错误摘要）
- Panel 关闭按钮或 5s 后自动清除（`setTimeout` 设 `multilingualResult = null`）
- 结果展示后再调 `router.refresh()` 以加载新版本列表

**Patterns to follow:**

- `apps/web/components/listing/generating-overlay.tsx`（现有生成状态展示模式）

**Test scenarios:**

- Happy path: 6 combos 全成功 → 显示"✓ 6 个版本生成成功"
- Error path: 2 combos 失败 → 显示"✓ 4 个成功，✗ 2 个失败"+ 失败明细（语言/平台）
- Edge case: API 整体抛出异常（网络错误）→ 显示通用错误，不崩溃

**Verification:**

- 多语言生成完成后编辑器顶部出现结果摘要 banner
- 部分失败时 banner 列出失败语言和平台

---

- [ ] U4. **环境文档 + 集成测试**

**Goal:** 补全 dev env 文档，并为 6-version 批量生成路径增加集成测试覆盖。

**Requirements:** R4, R5

**Dependencies:** U1

**Files:**

- Modify: `apps/web/.env.local.example`
- Modify: `apps/api/src/listing/listing.controller.spec.ts`

**Approach:**

- `.env.local.example` 的"Feature Flags"章节补充
  `NEXT_PUBLIC_FEATURE_MULTILINGUAL_LISTING_GENERATION=true`，并附注释说明其作用
- `listing.controller.spec.ts` 新增测试组 `POST /listings/batch-generate (multilingual)`:
  - 3 languages × 2 targets = 6 combos 全成功
  - 1 个 combo 失败（mock `generateListing` 对 `fr` 抛异常）→ 其他 5 combos 成功，
    response 中 `failed` combo status='failed' 且整体 HTTP 200
  - Feature flag `MULTILINGUAL_LISTING_GENERATION` 关闭时 `languages: ['en','es']`
    → 只生成 `en`，不生成 `es`

**Test expectation (env file):** none — 文档变更，无行为测试

**Test scenarios:**

- 6-combo 全成功：`results.length === 6`，每个 `status === 'completed'`
- 部分失败：1 combo `status === 'failed'`，其他 5 combos `status === 'completed'`，HTTP 200
- Feature flag off：`resolvedLanguages` 被截断为 `['en']`，生成结果仅含 en combos
- Backward compat：`language: 'en'`（旧字段）→ 生成 1 个版本，兼容性不破坏

**Verification:**

- CI 测试通过（`pnpm test` in `apps/api`）
- 新开发者复制 `.env.local.example` 后多语言按钮可见（`MULTILINGUAL_ENABLED = true`）

---

## System-Wide Impact

- **Interaction graph:** `GET /listings` 新增 `language` 过滤参数；不影响现有
  调用方（`fetchSiblingListings` 用 `productId+shopId+platformId` 组合，不传 language）
- **Error propagation:** U3 结果面板吸收 API 部分失败（`Promise.allSettled`），
  不向上传播；网络错误单独 catch 展示
- **State lifecycle risks:** 无新状态写入——过滤是只读查询；结果 panel state 局限于
  `listing-editor-shell` 组件内
- **Unchanged invariants:** batch-generate 的笛卡尔积、术语注入、`@@unique` 约束
  均不变；`fetchSiblingListings` 继续用 `productId+shopId+platformId` 过滤

---

## Risks & Dependencies

| Risk                                                | Mitigation                                                              |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| 语言过滤 URL 参数与 Next.js `[locale]` segment 歧义 | 参数名用 `language`（非 `locale`），路由层无冲突                        |
| 6 LLM 并发调用超时导致结果面板卡死                  | U3 实现时添加 30s `AbortController` 超时；面板显示超时错误；不阻塞 W31+ |
| `.env.local.example` 更新未同步给所有开发者         | PR 描述明确提示需重新复制 `.env.local.example`                          |

---

## Sources & References

- **Origin document:** `docs/plans/2026-05-03-004-feat-w27-w28-locale-model-multilang-strategy-plan.md`
- 实施方案 §8 W29–W30: `docs/yaemartOS-implementation-plan.md`
- 现有 batch-generate: `apps/api/src/listing/listing.controller.ts`（L116–240）
- 现有编辑器 shell: `apps/web/components/listing/listing-editor-shell.tsx`
- 现有状态过滤参考: `apps/web/app/[locale]/(admin)/listings/page.tsx`
