---
title: 'feat: W29–W30 多语言 Listing 批量生成 + 前端语言切换'
type: feat
status: active
date: 2026-05-03
origin: docs/plans/2026-05-03-004-feat-w27-w28-locale-model-multilang-strategy-plan.md
---

# feat: W29–W30 多语言 Listing 批量生成 + 前端语言切换

## Overview

在 W27–W28 建立的 Locale 数据模型和多语言 Prompt 策略基础上，实现
EN/ES/FR × Amazon/Walmart 6 版本并行批量生成（后端），以及前端语言切换器

- Listing 编辑器多语言 Tab（前端）。完成后运营人员可在一次操作中为同一
  产品生成所有语言版本，并通过语言 Tab 在编辑器内快速切换查看/编辑。

---

## Problem Frame

现有 `POST /listings/batch-generate` 每次只接受单一 `language`，运营若要生成
EN + ES + FR 三个语言版本需要调用三次。前端 listing 编辑器仅显示单语言版本
列表，无法在同一界面横向比较或切换不同语言的 Listing。

W29-W30 目标：

1. 后端支持 `languages: LocaleCode[]` 参数，一次调用生成所有语言组合，
   并注入术语库
2. 新增 `GET /locales?marketId=xxx` 端点，前端据此渲染可用语言 Tab
3. 前端语言切换器 + listing 编辑器内嵌多语言 Tab，允许跨语言版本浏览

---

## Requirements Trace

- R1. `POST /listings/batch-generate` 接受 `languages: LocaleCode[]`（保留
  `language` 字段向后兼容）；按 `languages × targets` 笛卡尔积并发生成
- R2. 每个目标语言调用 `TerminologyService.findByBrandAndLocale(brandId, locale)`
  并将术语表注入 prompt；术语查询失败时降级为空数组，不阻塞生成
- R3. 新增 `GET /locales?marketId=xxx` 返回该市场激活的语言列表，供前端
  语言切换器渲染 Tab
- R4. Feature flag `MULTILINGUAL_LISTING_GENERATION`：关闭时只允许 EN 单语言
  批量生成
- R5. 前端 `LocaleSwitcher` 组件：按 `/locales` API 渲染语言 Tab；切换语言时
  切换显示对应语言的 Listing 版本列表
- R6. listing 编辑器页面新增"批量多语言生成"按钮，一键触发 3 语言 × 当前
  platform 的生成，生成后自动刷新页面展示新版本

---

## Scope Boundaries

- 不实现 W31+ 客户中心门户
- 不实现 DE/IT 语言（LocaleCode 已存在，但不在 S3 激活范围内）
- 语言切换器不实现实时 diff 视图（W34+ 可考虑）
- `batch-generate` 的进度推送（SSE/WebSocket）不在本期：保持同步返回，
  前端显示 spinner；超时问题留 W34+ 处理
- 不修改 listing 编辑器的内容字段编辑功能（仅增加语言导航层）

---

## Context & Research

### Relevant Code and Patterns

- `apps/api/src/listing/listing.controller.ts` — `batchGenerate` 已有 `languages`
  单值字段；改为数组即可扩展并发
- `apps/api/src/listing/dto/batch-generate-listing.dto.ts` — 当前 `language: string`
  需扩展为 `languages: LocaleCode[]`，保留 `language` 作 backward-compat alias
- `apps/api/src/listing/listing.service.ts` — `findOrCreateDraft` 和
  `resolvePlatformId` 已存在，无需修改
- `apps/api/src/terminology/terminology.service.ts` — `findByBrandAndLocale`
  已在 W27-W28 实现
- `apps/api/src/locale/locale.service.ts` — `findActive(marketId)` 已实现，
  需新增 `LocaleController` 暴露为 REST
- `apps/web/components/listing/listing-editor-shell.tsx` — 现有编辑器 shell，
  需在顶部添加语言 Tab 导航层
- `apps/web/lib/api/listing-client.ts` — 需添加 `batchGenerateMultilingual`
  和 `fetchMarketLocales`

### Institutional Learnings

- W27-W28 的 `TerminologyService` 注入模式已验证（313 tests ✅）
- `BatchGenerateListingDto` 的 `targets` 数组并发用 `Promise.allSettled`，
  部分失败不中断整体；多语言版本沿用同一模式

---

## Key Technical Decisions

- **笛卡尔积展开在 controller**：`languages × targets` 的组合由 controller
  展开，service 层保持"一次生成一个版本"的职责不变
- **backward-compat 字段**：保留 `language?: string` 作 deprecated 字段，
  优先使用 `languages`；若两者都缺则 400
- **LocaleController 新建**（不污染 LocaleModule 的 no-controller 设计）：
  暴露 `GET /locales?marketId=xxx`，返回 `{ locales: { language, isPrimary }[] }`
- **前端语言 Tab 基于 URL param**：`?locale=es` query param 控制当前显示语言；
  切换时浏览器 push，不走 state（SEO 友好，刷新稳定）

---

## Open Questions

### Resolved During Planning

- **`TerminologyModule` 在 `ListingModule` 中的循环依赖风险**：
  `ListingModule` 可直接 import `TerminologyModule`（后者只依赖 PrismaModule），
  无循环
- **并发上限**：目前 3 languages × 2 platforms = 6 calls，Gemini API
  并发不超过 10，无需限流；若后续扩展到 DE/IT 再加 rate limiter

### Deferred to Implementation

- 单次批量生成总超时（3×2=6 次 LLM 调用）：实现时若 > 30s 需加 timeout 提示

---

## Implementation Units

- [ ] U1. **后端：多语言批量生成 + 术语注入 + LocaleController**

**Goal:** 将 `batch-generate` 端点升级为接受 `languages[]`，笛卡尔积并发生成，
并注入 TerminologyService；同时新增 `GET /locales` 端点。

**Requirements:** R1, R2, R3, R4

**Dependencies:** W27-W28 Locale/Terminology 已完成

**Files:**

- Modify: `apps/api/src/listing/dto/batch-generate-listing.dto.ts`
- Modify: `apps/api/src/listing/listing.controller.ts`
- Modify: `apps/api/src/listing/listing.module.ts`
- Create: `apps/api/src/locale/locale.controller.ts`
- Modify: `apps/api/src/locale/locale.module.ts`
- Modify: `apps/api/prisma/seed.ts` _(添加 MULTILINGUAL_LISTING_GENERATION flag)_
- Test: `apps/api/src/listing/listing.controller.spec.ts` _(新建或扩展)_

**Approach:**

- `BatchGenerateListingDto` 新增 `@IsArray() @IsIn(LOCALES, { each: true }) languages?: string[]`；
  controller 取 `resolvedLanguages = body.languages ?? (body.language ? [body.language] : null)`；
  若 null 则 400
- Feature flag `MULTILINGUAL_LISTING_GENERATION`：关闭时 `resolvedLanguages` 强制截断为 `['en']`
- 笛卡尔积：`resolvedLanguages.flatMap(lang => body.targets.map(t => ({ ...t, lang })))`
- 每个 combo 调用 `TerminologyService.findByBrandAndLocale(body.brandId, lang)`；
  catch 所有异常 → 空数组降级
- `LocaleController`: `@Get() @UseGuards(JwtAuthGuard)` →
  `localeService.findActive(marketId)` → `{ locales }`

**Test scenarios:**

- Happy path: `languages: ['en', 'es']` + 1 target → 2 结果，每个结果含 `language` 字段
- Happy path: `languages: ['en', 'es', 'fr']` + 2 targets → 6 结果
- Backward compat: 只传 `language: 'en'`（老字段）→ 生成 1 个版本
- Error path: 两者都不传 → 400 BadRequest
- Feature flag off: `languages: ['en', 'es']` → 只生成 `['en']` 1 版本
- Integration: terminology 查询失败 → 降级空数组，生成不中断
- `GET /locales?marketId=mkt_homtone_us` → 返回 3 条语言记录

**Verification:**

- `listing.controller.spec.ts` 新增测试全绿
- `POST /listings/batch-generate` with `languages: ['en','es','fr']` × 2 targets → 6 results

---

- [ ] U2. **前端 API 层：`fetchMarketLocales` + `batchGenerateMultilingual`**

**Goal:** 在 `listing-client.ts` 中新增两个 API 函数，供 UI 组件调用。

**Requirements:** R3, R6

**Dependencies:** U1

**Files:**

- Modify: `apps/web/lib/api/listing-client.ts`

**Approach:**

- `fetchMarketLocales(token, marketId)` → `GET /locales?marketId=xxx` → 返回
  `{ language: string; isPrimary: boolean; label: string }[]`；
  `label` 由 client side map（`en` → `EN`, `es` → `ES`, `fr` → `FR`）
- `batchGenerateMultilingual(token, payload)` → `POST /listings/batch-generate`
  with `languages` array；返回 `{ results: BatchResult[] }`

**Test scenarios:**

- `fetchMarketLocales` 映射 label 正确（`en` → `EN`）
- `batchGenerateMultilingual` 将 `languages` 数组正确传入 body

**Verification:**

- 函数类型安全（TypeScript 编译无报错）

---

- [ ] U3. **前端 UI：`LocaleSwitcher` + listing 编辑器多语言 Tab**

**Goal:** listing 编辑器页面顶部新增语言 Tab；切换语言导航至对应语言的
Listing（同产品/同店/同平台、不同语言）；新增"批量多语言生成"按钮。

**Requirements:** R5, R6

**Dependencies:** U2

**Files:**

- Create: `apps/web/components/listing/locale-switcher.tsx`
- Modify: `apps/web/app/[locale]/(admin)/listings/[id]/page.tsx`
- Modify: `apps/web/components/listing/listing-editor-shell.tsx`
- Modify: `apps/web/lib/api/listing-client.ts` _(添加 `fetchSiblingListings`)_

**Approach:**

- `LocaleSwitcher`: 接收 `locales[]` + `activeLocale` + `onSwitch(locale)` props；
  渲染水平 Tab bar（复用 brand-switcher.tsx 的样式模式）；
  激活 Tab 高亮 `border-brand-primary`
- `fetchSiblingListings(token, listingId, brandId)` → `GET /listings?productId=&shopId=&platformId=`
  过滤出同产品/店/平台的所有语言 Listing，返回 `{ id, language }[]`
- listing 详情页（server component）：并行 fetch `fetchMarketLocales` +
  `fetchSiblingListings`；将结果传入 `ListingEditorShell`
- `ListingEditorShell`: 顶部渲染 `LocaleSwitcher`；切换时 `router.push` 到
  对应语言 listing 的 `/listings/[siblingId]`；新增"批量多语言生成"按钮（触发
  `batchGenerateMultilingual` 后 `router.refresh()`）

**Test scenarios:**

- `LocaleSwitcher` 渲染 3 个语言 Tab，激活 Tab 有高亮样式
- `LocaleSwitcher` 点击非激活 Tab → `onSwitch` 被调用
- "批量多语言生成"按钮存在且在生成期间显示加载状态
- 无兄弟 listing 时语言 Tab 不显示（graceful fallback）

**Verification:**

- 编辑器页面顶部出现语言 Tab 区域（EN / ES / FR）
- 切换语言 Tab 导航至对应语言版本的 Listing 编辑器
- "批量多语言生成"按钮一键触发 3 语言生成并刷新页面

---

## System-Wide Impact

- **Interaction graph:** `listing.controller.ts` 新增 `TerminologyService` 依赖；
  `LocaleModule` 新增 controller，暴露 `/locales` 端点
- **Error propagation:** 术语查询失败静默降级；单个语言版本生成失败只影响该
  combo 的 result，不影响其他语言（`Promise.allSettled`）
- **State lifecycle risks:** 多语言并发生成可能出现 `findOrCreateDraft` 竞态
  （同一 productId+shopId+language 被重复创建）；已有 `@@unique` 约束保护
- **Unchanged invariants:** 单语言 `language` 字段保持 backward-compat，
  现有 agent/API 调用不受影响
- **API surface parity:** `GET /iam/capabilities` 的 `CAPABILITY_ACTIONS` 需
  新增 `GET /locales` entry（update `iam.controller.ts`）

---

## Risks & Dependencies

| Risk                                    | Mitigation                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| 3×2=6 LLM 并发调用超时（> 30s）         | 前端 spinner + 30s 超时提示；W34 加 SSE 进度流                                        |
| 兄弟 listing 查询逻辑复杂（无直接 API） | 用 `GET /listings?productId&shopId&platformId` 过滤；若字段不存在则先添加 query param |

---

## Sources & References

- 实施方案: `docs/yaemartOS-implementation-plan.md` §8 W29–W30
- 依赖计划: `docs/plans/2026-05-03-004-feat-w27-w28-locale-model-multilang-strategy-plan.md`
- 现有 batch-generate: `apps/api/src/listing/listing.controller.ts`
- 现有编辑器 shell: `apps/web/components/listing/listing-editor-shell.tsx`
