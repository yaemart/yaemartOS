---
title: 'feat: W16-W17 Walmart Listing 字段规则 + 平台自适应 AI 生成'
type: feat
status: active
date: 2026-05-02
origin: docs/yaemartOS-implementation-plan.md
---

# feat: W16-W17 Walmart Listing 字段规则 + 平台自适应 AI 生成

## Overview

S1 的 Listing 生成管线硬编码了 Amazon EN 字段规则（`amazon-en-limits.ts`）、验证器（`validateListingContent`）和 Prompt（`assembleAmazonEnPrompt`）。S2 W16-W17 需要接入 Walmart 平台，字段结构与 Amazon 差异显著（Key Features / Short Description / Search Keywords 而非 Bullets / Description / Search Terms；条数和字符上限也不同）。

本计划通过引入 **`PlatformListingRules` 接口** 统一规则模型，让验证器、Prompt 组装、Zod Schema 和 AI 生成服务全部变成平台自适应的，同时保持 Amazon EN 逻辑零回归。

---

## Problem Frame

`GeminiListingGenerationService.generateListing()` 中存在三处硬编码：

1. Zod schema 引用 `AMAZON_EN_LIMITS`（字段数量和上限写死）
2. 调用 `assembleAmazonEnPrompt()`（使用 Amazon 术语和字符限制）
3. 调用 `validateListingContent(content)`（只验证 Amazon EN 规则）

当 `input.platform === 'walmart'` 时，传入 Amazon prompt 会导致 AI 生成错误数量的 bullets（5 而非最多 10），字符限制也不符合 Walmart Seller Center 规范，且验证器会用 Amazon 规则误判 Walmart 内容。

---

## Requirements Trace

- R1. 引入 `PlatformListingRules` 接口，统一描述任意平台的字段规则
- R2. `walmart-en-limits.ts` 定义 Walmart EN 字段上限（Title/Key Features/Short Description/Search Keywords）
- R3. `validateListingContent` 接受 `rules` 参数，实现平台自适应验证；默认保持 Amazon EN 行为（向后兼容）
- R4. `assembleWalmartEnPrompt()` 使用 Walmart 术语和字段约束组装 prompt
- R5. `GeminiListingGenerationService.generateListing()` 按 `input.platform` 选择对应的规则/schema/prompt
- R6. 规则层有完整的自动化单元测试（CI 强制通过）

---

## Scope Boundaries

- 不修改数据库 schema（`Listing` 表已有通用字段 `title/bullets/description/searchTerms`，平台映射在服务层完成）
- 不引入 Walmart A+ 等效能力（Rich Media 不在 W16-W17 范围内）
- 不实现前端 Tab 标签名称随平台变化（UI 适配在 W16-W17 之后的 iteration 完成）
- 不实现多语言 Walmart listing（仅 EN；多语言在 S3）
- 不实现 Product ID 验证（UPC/GTIN 格式校验属于 W17 后的数据导入环节）

---

## Context & Research

### Relevant Code and Patterns

- `apps/api/src/listing/rules/amazon-en-limits.ts` — 现有 Amazon EN 常量，作为新接口设计的参照
- `apps/api/src/listing/rules/validate-listing-content.ts` — 现有验证器，改为接受 rules 参数
- `apps/api/src/listing/rules/validate-listing-content.spec.ts` — 现有测试，需补充 Walmart 场景并适配泛化签名
- `apps/api/src/listing/prompts/assemble-listing-prompt.ts` — Amazon EN Prompt，Walmart 版照此结构新建
- `apps/api/src/ai/providers/gemini-listing-generation.service.ts` — 生成服务，硬编码需要泛化
- `packages/shared-types/src/index.ts` — `ListingContent`（`bullets/description/searchTerms` 字段名保持不变；Walmart 对应 Key Features/Short Description/Search Keywords，映射在规则层）

### Institutional Learnings

- 没有 `docs/solutions/` 中关于 platform rules 的先前文档（全新领域）

### External References

- Walmart Seller Center Style Guide（2024）：Title ≤ 200 chars；Key Features ≤ 10 条，每条 ≤ 1000 chars；Short Description ≤ 4000 chars；Search Keywords ≤ 1000 chars（字符数，非字节数）

---

## Key Technical Decisions

- **规则对象而非多文件继承**：`PlatformListingRules` 是一个纯数据对象（常量），不使用 class 继承。这样 `validateListingContent(content, rules)` 可直接接受规则常量，无需 DI，适合在测试中无依赖使用。
- **`ListingContent` 字段名不变**：`bullets`、`description`、`searchTerms` 作为 canonical 内部字段名，Walmart 平台的字段标签（Key Features 等）只在 Prompt 文本和 UI 标签层体现，不改变类型定义。
- **search terms 度量统一为字符数**：Amazon 用字节（249 bytes），Walmart 用字符（1000 chars）。`PlatformListingRules` 分别用 `searchTermsMaxBytes` 和 `searchTermsMaxChars` 两个可选字段，验证器按存在性选择度量方式。
- **Zod Schema 工厂函数**：生成服务中改为 `buildListingSchema(rules)` 从规则常量动态构建 Zod schema，避免维护两套 schema 常量。
- **默认行为向后兼容**：`validateListingContent(content)` 无第二参数时默认使用 `amazonEnRules`，不破坏现有调用点。

---

## Open Questions

### Resolved During Planning

- **Walmart bullets 字段名**：内部仍存为 `bullets`，`assembleWalmartEnPrompt` 在 prompt 中称为 "Key Features"，规则层记录 `bulletFieldLabel: 'Key Features'`。
- **Walmart A+ 对应字段**：Walmart 无 A+ 概念，`aPlusMaxChars` 在 `walmartEnRules` 中设为 `undefined`，验证器跳过 aPlus 检查。

### Deferred to Implementation

- Walmart 禁用词表（sensitive words list）：Walmart 的禁用词逻辑比 Amazon 复杂，推迟到 W17 后的 iteration 添加；本计划的规则常量预留 `prohibitedWords?: string[]` 字段但不实现校验逻辑。

---

## Implementation Units

- [ ] U1. **`PlatformListingRules` 接口 + Walmart EN 常量**

**Goal:** 定义通用的平台字段规则接口，并为 Walmart EN 实例化一个常量对象。

**Requirements:** R1, R2

**Dependencies:** None

**Files:**

- Create: `apps/api/src/listing/rules/platform-listing-rules.interface.ts`
- Create: `apps/api/src/listing/rules/walmart-en-limits.ts`

**Approach:**

- `PlatformListingRules` 包含：`platformCode`、`titleMaxChars`、`bulletsMaxCount`、`bulletMaxChars`、`descriptionMaxChars`、`searchTermsMaxBytes?`（Amazon 用）、`searchTermsMaxChars?`（Walmart 用）、`aPlusMaxChars?`、`bulletFieldLabel`（'Bullet Points' | 'Key Features'）、`descriptionFieldLabel`（'Description' | 'Short Description'）、`searchTermsFieldLabel`（'Search Terms' | 'Search Keywords'）
- 同时将 `amazon-en-limits.ts` 中的常量收拢为 `amazonEnRules: PlatformListingRules` 导出（保留原常量导出兼容现有引用）
- Walmart EN 限制：titleMaxChars=200，bulletsMaxCount=10，bulletMaxChars=1000，descriptionMaxChars=4000，searchTermsMaxChars=1000，无 aPlusMaxChars

**Patterns to follow:**

- `apps/api/src/listing/rules/amazon-en-limits.ts` — 命名风格和注释格式

**Test scenarios:**

- Test expectation: none — 纯常量定义，逻辑在 U2 验证

**Verification:**

- TypeScript 编译通过，`walmartEnRules.bulletsMaxCount === 10`，`walmartEnRules.searchTermsMaxChars === 1000`

---

- [ ] U2. **平台自适应验证器**

**Goal:** 将 `validateListingContent` 改为接受可选 `rules: PlatformListingRules` 参数，默认 `amazonEnRules`；补充 Walmart EN 场景测试。

**Requirements:** R3

**Dependencies:** U1

**Files:**

- Modify: `apps/api/src/listing/rules/validate-listing-content.ts`
- Modify: `apps/api/src/listing/rules/validate-listing-content.spec.ts`

**Approach:**

- 函数签名改为 `validateListingContent(content: ListingContent, rules: PlatformListingRules = amazonEnRules): ValidationResult`
- 所有 limit 引用改为 `rules.titleMaxChars` 等，替换原来直接引用 `AMAZON_EN_LIMITS.*`
- searchTerms 校验：若 `rules.searchTermsMaxBytes` 存在则用字节度量；若 `rules.searchTermsMaxChars` 存在则用字符度量
- aPlus 校验：仅当 `rules.aPlusMaxChars` 存在时执行
- 新增 Walmart EN 的完整测试 describe 块（happy path + 边界值 + 多字段违规）

**Patterns to follow:**

- 现有 `validate-listing-content.spec.ts` 的 describe/it 命名风格

**Test scenarios:**

- Happy path: `validateListingContent(validWalmartContent(), walmartEnRules)` → `valid: true`
- Edge: Walmart title 恰好 200 chars → 通过；201 chars → `title` violation
- Edge: 10 个 Key Features → 通过；11 个 → `bullets` violation
- Edge: 单条 Key Feature 恰好 1000 chars → 通过；1001 chars → `bullets[0]` violation
- Edge: Search Keywords 恰好 1000 chars → 通过；1001 chars → `searchTerms` violation，violation.limit = 1000
- Edge: Walmart aPlus = undefined → 不报违规（规则无 aPlusMaxChars）
- Regression: 无 rules 参数调用 `validateListingContent` → 默认 Amazon EN 行为，已有测试全通过

**Verification:**

- `pnpm --filter @yaemartos/api test -- --run apps/api/src/listing/rules/validate-listing-content.spec.ts` 全绿

---

- [ ] U3. **Walmart EN Prompt 组装器**

**Goal:** 新建 `assembleWalmartEnPrompt(input)` 函数，使用 Walmart 平台术语和 Walmart EN 字段约束组装 AI prompt。

**Requirements:** R4

**Dependencies:** U1

**Files:**

- Create: `apps/api/src/listing/prompts/assemble-walmart-en-prompt.ts`

**Approach:**

- 函数签名和结构与 `assembleAmazonEnPrompt` 一致（方便后续抽象为通用工厂）
- prompt 使用 Walmart 特定术语：Key Features（不是 Bullet Points）、Short Description（不是 Description）、Search Keywords（不是 Search Terms）
- 约束部分基于 `walmartEnRules`：最多 10 个 Key Features，每条 ≤ 1000 chars，Short Description ≤ 4000 chars，Search Keywords ≤ 1000 chars
- 加入 Walmart 风格指南说明：Key Features 以动词开头（"Holds up to..."），Short Description 为段落文字
- prompt 输出格式仍为 JSON（与 Amazon 版统一）

**Patterns to follow:**

- `apps/api/src/listing/prompts/assemble-listing-prompt.ts` — 结构和格式

**Test scenarios:**

- Happy path: `assembleWalmartEnPrompt(sampleInput)` 包含 "Key Features" 字符串（不含 "Bullet Points"）
- Happy path: 输出包含 "Short Description" 字符串（不含 "product description"）
- Happy path: 输出包含 "10" 作为最大条数约束
- Happy path: competitor URLs section 正确插入

**Verification:**

- 新建单测文件 `assemble-walmart-en-prompt.spec.ts` 全绿；TypeScript 编译通过

---

- [ ] U4. **`GeminiListingGenerationService` 平台自适应**

**Goal:** 让 `generateListing()` 按 `input.platform` 选择正确的规则常量、Zod schema 和 prompt 组装器；`validateListingContent` 调用传入对应规则。

**Requirements:** R5

**Dependencies:** U1, U2, U3

**Files:**

- Modify: `apps/api/src/ai/providers/gemini-listing-generation.service.ts`

**Approach:**

- 新建私有方法 `buildPlatformContext(platform)` 返回 `{ rules, prompt, schema }`
  - `amazon` → `{ amazonEnRules, assembleAmazonEnPrompt, ListingContentAmazonSchema }`
  - `walmart` → `{ walmartEnRules, assembleWalmartEnPrompt, ListingContentWalmartSchema }`
  - 其他平台 → throw `UnsupportedPlatformError`
- `ListingContentWalmartSchema` 用 `buildListingSchema(walmartEnRules)` 工厂函数生成（bullets 最多 10 条）
- `generateListing()` 的 `throw new Error(...)` 消息也要平台自适应（"AI output violates [platform] EN character rules"）
- mockContent 也按平台返回正确条数的 bullets（5 或 10）

**Patterns to follow:**

- 现有 `generateListing()` 的整体结构和错误处理方式

**Test scenarios:**

- Happy path: platform='amazon' → 使用 Amazon limits schema，调用 `assembleAmazonEnPrompt`，验证 Amazon rules（回归）
- Happy path: platform='walmart' → 使用 Walmart limits schema，调用 `assembleWalmartEnPrompt`，生成 8 条 Key Features → 通过验证
- Error path: platform='shopify' → generateListing 抛出 UnsupportedPlatformError
- Edge: platform='walmart'，AI 返回 11 条 bullets → `validateListingContent(content, walmartEnRules)` 失败 → service 抛出 Error（不因为 Amazon 的 5 条限制误判）

**Verification:**

- `pnpm --filter @yaemartos/api test -- --run apps/api/src/ai/providers/gemini-listing-generation.service.spec.ts` 全绿；现有 Amazon 场景零回归

---

- [ ] U5. **E2E/集成冒烟 + CI**

**Goal:** 确认 Walmart listing generation 端到端链路在 CI 中可通过；不需要真实 API key（mock 模式）。

**Requirements:** R6

**Dependencies:** U1, U2, U3, U4

**Files:**

- Modify: `apps/api/src/ai/providers/gemini-listing-generation.service.spec.ts` （新增 Walmart mock 场景）
- Create: `tests/e2e/w16-w17-walmart-listing.spec.ts`

**Approach:**

- unit test：补充 Walmart mock path 场景（无 GEMINI_API_KEY 时 `mockContent` 返回 10 条 bullets，且通过 Walmart 验证）
- E2E spec：覆盖 `POST /listing/generate` with `{ platform: 'walmart' }` 返回 200 且 `bullets.length <= 10`（使用 mock 模式，不需要真实 key）

**Patterns to follow:**

- `tests/e2e/w11-es-knowledge.spec.ts` — E2E spec 结构
- `apps/api/src/ai/providers/gemini-listing-generation.service.spec.ts` — mock 模式测试结构

**Test scenarios:**

- Happy path（unit，mock）: platform='walmart' + GEMINI_API_KEY 未设置 → mockContent 返回 10 条 bullets，每条 ≤ 1000 chars
- Happy path（E2E，mock）: `POST /listing/generate { platform: 'walmart' }` → HTTP 200 + body.bullets.length ≤ 10

**Verification:**

- `pnpm test` in API workspace 全绿；E2E Playwright 测试通过

---

## System-Wide Impact

- **Interaction graph:** `GeminiListingGenerationService` 是唯一调用点；`validateListingContent` 只被该服务调用（当前），无其他调用链影响
- **Error propagation:** `UnsupportedPlatformError` 从 `buildPlatformContext` 抛出，`generateListing` 不捕获，由 `ListingController` 的 NestJS 全局 ExceptionFilter 转为 HTTP 400 Bad Request
- **State lifecycle risks:** 无持久化副作用，规则常量为纯数据对象
- **API surface parity:** `POST /listing/generate` 入参已有 `platform` 字段（来自 `GenerateListingInput`），无 API contract 变更
- **Integration coverage:** unit mock 验证规则选择逻辑；E2E mock 验证 HTTP 链路完整性；真实 AI 调用不在 CI 中运行
- **Unchanged invariants:** `ListingContent` 类型不变；Amazon EN 的 `validateListingContent()` 无参调用行为不变；`listing.service.ts` 和 `listing.controller.ts` 不修改

---

## Risks & Dependencies

| Risk                                               | Mitigation                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| Walmart 字符限制与 Seller Center 实际不一致        | 常量集中在 `walmart-en-limits.ts`，运营对照 Seller Center 后一处改动全局生效 |
| `buildListingSchema` 工厂函数引入的 Zod 运行时错误 | U4 补充 schema 工厂单元测试，覆盖边界值                                      |
| 现有 Amazon 测试因签名变化失败                     | U2 中验证器默认参数保证向后兼容；CI 必须全绿后才合并                         |

---

## Sources & References

- **Origin document:** `docs/yaemartOS-implementation-plan.md` §7 W16-W17
- Related code: `apps/api/src/listing/rules/amazon-en-limits.ts`
- Related code: `apps/api/src/listing/rules/validate-listing-content.ts`
- Related code: `apps/api/src/ai/providers/gemini-listing-generation.service.ts`
- External docs: [Walmart Seller Center — Content Guidelines](https://sellerhelp.walmart.com/s/guide?article=000007655)
