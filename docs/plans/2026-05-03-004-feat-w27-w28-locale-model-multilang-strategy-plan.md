---
title: 'feat: W27–W28 Locale 数据模型 + 多语言策略 (S3 Kickoff)'
type: feat
status: active
date: 2026-05-03
---

# feat: W27–W28 Locale 数据模型 + 多语言策略 (S3 Kickoff)

## Overview

S3 切片（W27–W39）的第一个 2-week sprint。目标是建立多语言基础设施：
引入 `Locale = Market × Language` 数据模型、术语库（`TerminologyEntry`）、
IAM `locale_reviewer` 角色，并将 Listing 生成 prompt 升级为"直生成"策略——
Gemini 2.5 Pro 直接输出 ES/FR，不再先生成 EN 再翻译。

W29–W30 依赖本计划的数据模型与 prompt 接口；在本计划完成前不可启动。

---

## Problem Frame

S2 的 Listing 生成仅支持 EN（`targetLocale: 'en'`），prompt 文案也是英文写给英文
模型读。北美西班牙语市场（US×ES）与法语加拿大市场（CA×FR）进入视野后，
需要：

1. **数据层**：一个 `Locale` 实体把市场（Market）与语言（LocaleCode）组合起来，
   标记哪些语言组合是"已激活/主语言"，供前端切换器与后端路由使用。
2. **术语层**：品牌运营可以导入 CSV 术语表，生成时注入品牌专属词汇，保证
   跨语言品牌一致性。
3. **IAM 层**：引入 `locale_reviewer` 角色，让语言审校人员只能读写
   locale-specific 内容（listing 多语言字段 + 术语库），不能操作定价等核心字段。
4. **Prompt 层**：升级 Amazon / Walmart prompt 为"多语言直写"策略——
   目标语言不是 EN 时，模型用目标语言写作（不翻译），并在 prompt 中注入
   对应语种的 Writing Guidelines 和术语对照表。

---

## Requirements Trace

- R1. `Locale` 实体：`(marketId, language)` 唯一约束，`isActive` 开关，`isPrimary`
  标记每个市场的默认语言；北美（US×EN primary、US×ES、US×FR）可配置
- R2. `TerminologyEntry`：按 `(brandId, locale, term)` 唯一，支持 CSV 批量导入
  （upsert 语义）；API 暴露 list + import 端点
- R3. IAM：`locale_reviewer` 角色能读写 `listings`（locale 字段范围）和
  `terminology`（read + write），不能写 `listings:pricing` 字段
- R4. Prompt：`assembleAmazonEnPrompt` / `assembleWalmartPrompt` 接收
  `targetLocale: LocaleCode`；EN 走原有逻辑，ES/FR 直接用目标语言写作，
  并将术语表注入 prompt 的 Brand Voice 章节
- R5. 种子数据：`Locale` 种子包含 US×EN（primary）/ US×ES / US×FR /
  CA×EN / CA×FR 五条记录（Homtone + Spoonlemon 两品牌）

---

## Scope Boundaries

- 不实现 W29–W30 的"6 版本并行生成"前端 UI 与批量触发逻辑
- 不实现 CA 市场的 Market 新建（Market 种子在 S1/S2 已完成，若 CA 缺席则
  由实现者在 seed 补充；不单独立 issue）
- `TerminologyEntry` 本期只做 CRUD + CSV import，不做 Elasticsearch 同步
  （E向量搜索将在 W34 AI Chat 模块引入术语召回时处理）
- `locale_reviewer` 本期只在 Casbin 层定义，不做前端角色管理 UI

### Deferred to Follow-Up Work

- 前端语言切换器 + Listing 编辑器多语言 Tab（W29–W30）
- 术语向量化 + ES 语义搜索（W34）
- DE / IT 语言的 prompt 支持（计划外扩展，按需添加）

---

## Context & Research

### Relevant Code and Patterns

- `apps/api/prisma/schema.prisma` — `LocaleCode` 枚举已含 `en / es / fr / de / it`；
  `Market` model 已有 `brandId / code / name / currency / timezone`
- `apps/api/src/listing/prompts/assemble-listing-prompt.ts` —
  `targetLocale` 字段已传入，但 prompt 内容固定为英文写作规则
- `apps/api/src/listing/prompts/assemble-walmart-en-prompt.ts` — 同上
- `apps/api/src/iam/casbin.service.ts` — `onModuleInit` 直接写 `addPolicy`，
  新角色按同一模式追加即可
- `apps/api/src/iam/iam.controller.ts` — `KNOWN_OBJECTS` 数组 + `CAPABILITY_ACTIONS`
  映射，新增 `terminology` 对象和 `locale_reviewer` 的 action 列表
- `apps/api/prisma/seed.ts` — 现有品牌/市场/商店种子，`Locale` 种子追加到末尾

### Institutional Learnings

- S2 的 `PlatformCode` enum 扩展教训：新增 enum 值需要同步更新种子数据和
  `KNOWN_OBJECTS`，否则 capabilities API 出现空洞（参见 shop-management ADR）
- Migration 文件命名约定：`YYYYMMDDHHMMSS_<descriptive>.sql`，时间戳在同一天
  内顺序递增避免冲突（参见 `20260502030000` 的 no-op 补救教训）

### External References

- Gemini 2.5 Pro 支持直接生成 ES/FR 而不经过英文中间步骤（符合 ADR-010 中的
  "单模型起步"策略）

---

## Key Technical Decisions

- **Locale 为独立实体而非 Market 字段**：方便后续按 Locale 粒度控制 feature flag
  和用量计费（S3 目标：EN/ES/FR × Amazon/Walmart 6 版本并行），同时让
  `Listing.language` 直接与 `Locale.language` 对齐，不引入额外外键
- **TerminologyEntry 不复用 ProductContent 模型**：术语是跨 SKU 的品牌级配置，
  生命周期和权限与产品内容不同，独立模型更清晰
- **locale_reviewer 的 `field` 维度限制**：利用 Casbin `field` 维度精确控制审校人
  只能修改 `title / bullets / description / searchTerms`，不能碰 `price` / `asin`
- **Prompt 多语言策略：直写 vs 翻译**：选直写（Gemini 直接输出目标语言）。
  中间翻译会丢失品牌语气，且双次 LLM 调用成本翻倍；Gemini 2.5 Pro 的西班牙语
  / 法语生成质量已满足 S3 M-02 指标

---

## Open Questions

### Resolved During Planning

- **CA 市场是否在 S1/S2 种子中存在？**：检查 `seed.ts`；若缺失，U1 的种子在同一
  PR 补充 `CA` Market，不单独立任务
- **术语库 CSV 格式**：`term,definition,example`（3 列），`locale` 和 `brandId`
  由 URL 路径参数提供，不放在 CSV 文件内

### Deferred to Implementation

- 术语库导入时的重复行处理策略（upsert vs reject）：实现时参考 `seed.ts` 的
  `upsertMany` 模式，若 Prisma 不支持批量 upsert 则用事务 + `findFirst` 前置检查
- 单次 CSV 导入的行数上限：先不限制，后续按实际性能测试结果添加

---

## Implementation Units

- [ ] U1. **Locale 数据模型 + 种子数据**

**Goal:** 引入 `Locale` 实体（Market × Language），迁移数据库，更新种子数据。

**Requirements:** R1, R5

**Dependencies:** 无

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/YYYYMMDDHHMMSS_add_locale/migration.sql`
- Modify: `apps/api/prisma/seed.ts`
- Test: `apps/api/src/locale/locale.service.spec.ts` _(新建)_

**Approach:**

- 在 `schema.prisma` 新增 `Locale` model：`id / marketId / language(LocaleCode) /
isPrimary(Boolean, default false) / isActive(Boolean, default true) /
createdAt / updatedAt`，`@@unique([marketId, language])`，
  `@@schema("public")`
- `Market` 加 `locales Locale[]` 反向关系
- 种子：US×EN(primary) / US×ES / US×FR / CA×EN / CA×FR；
  每条记录绑定 Homtone + Spoonlemon 对应的 Market

**Patterns to follow:**

- `SystemConfig` model 在 schema.prisma 中的 `@@schema("public")` 声明
- 种子数据的 `upsert` + `where: { marketId_language: ... }` 复合唯一键写法

**Test scenarios:**

- Happy path: 调用 `LocaleService.findByMarket(marketId)` 返回该市场所有激活 Locale
- Happy path: `isPrimary` 每个市场最多一条（unique constraint 验证）
- Edge case: 同一 `(marketId, language)` 重复插入抛 ConflictException
- Edge case: `isActive=false` 的 Locale 不被 `findActive` 返回

**Verification:**

- `pnpm prisma migrate dev` 无报错
- 种子运行后 DB 中存在 5 条 Locale 记录（US×EN primary, US×ES, US×FR, CA×EN, CA×FR）
- `LocaleService.findByMarket` 单测全绿

---

- [ ] U2. **TerminologyEntry 模型 + CRUD + CSV 导入**

**Goal:** 品牌运营可以通过 API 上传 CSV 术语表，或直接 CRUD 单条记录；
术语条目后续被注入 listing 生成 prompt。

**Requirements:** R2

**Dependencies:** U1（依赖 LocaleCode 枚举，已有）

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/YYYYMMDDHHMMSS_add_terminology_entry/migration.sql`
- Create: `apps/api/src/terminology/terminology.module.ts`
- Create: `apps/api/src/terminology/terminology.service.ts`
- Create: `apps/api/src/terminology/terminology.controller.ts`
- Create: `apps/api/src/terminology/dto/create-terminology.dto.ts`
- Create: `apps/api/src/terminology/dto/import-terminology-csv.dto.ts`
- Create: `apps/api/src/terminology/terminology.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Approach:**

- `TerminologyEntry` model：`id / brandId / locale(LocaleCode) / category(String?) /
term(String) / definition(String) / example(String?) / createdAt / updatedAt`，
  `@@unique([brandId, locale, term])`
- REST endpoints under `/terminology`：
  - `GET /terminology?brandId=&locale=` — 列表，Casbin `terminology:read`
  - `POST /terminology` — 单条创建，Casbin `terminology:write`
  - `PATCH /terminology/:id` — 单条更新，Casbin `terminology:write`
  - `DELETE /terminology/:id` — 单条删除，Casbin `terminology:write`
  - `POST /terminology/import` — multipart CSV 导入（`multer` 内存模式），
    Casbin `terminology:write`；返回 `{ imported: N, skipped: M }`
- CSV 解析：逐行 upsert，跳过空 `term`，`skipped` 计数统计重复行

**Patterns to follow:**

- `ShopController` / `ShopService` 的 Casbin guard 写法 (`@RequirePolicy`)
- `CasbinService.addPolicy` 的 `operator` 模式（`casbin.service.ts`）

**Test scenarios:**

- Happy path: `POST /terminology/import` 上传 3 行 CSV，返回 `{ imported: 3, skipped: 0 }`
- Happy path: `GET /terminology?brandId=x&locale=es` 只返回该品牌+语言条目
- Edge case: CSV 含重复 term → 第二次 upsert 覆盖，`skipped` +1
- Edge case: CSV 含空 term 行 → 跳过，`skipped` +1
- Error path: 上传非 CSV 文件（`text/plain` 无 header）→ 400 BadRequest
- Error path: 无 `terminology:write` 权限的 `operator` → 403

**Verification:**

- CSV 导入端点返回正确 `imported/skipped` 计数
- `terminology.service.spec.ts` 全绿
- `GET /terminology` 只返回当前用户品牌数据（品牌隔离）

---

- [ ] U3. **IAM `locale_reviewer` 角色**

**Goal:** 在 Casbin 中添加 `locale_reviewer` 角色，限定其只能读写 listing
的多语言内容字段（title / bullets / description / searchTerms）和术语库；
更新 `IamController` 的 `KNOWN_OBJECTS` 和 `CAPABILITY_ACTIONS`。

**Requirements:** R3

**Dependencies:** U2（`terminology` object 需先定义）

**Files:**

- Modify: `apps/api/src/iam/casbin.service.ts`
- Modify: `apps/api/src/iam/iam.controller.ts`
- Modify: `apps/api/src/iam/iam.controller.spec.ts`

**Approach:**

- `casbin.service.ts` 在 `onModuleInit` 末尾追加 4 条 policy：
  1. `locale_reviewer, listings, read, *, *, *, *, *, *` (allow)
  2. `locale_reviewer, listings, write, *, *, *, *, *, title|bullets|description|searchTerms` (allow)
  3. `locale_reviewer, terminology, read, *, *, *, *, *, *` (allow)
  4. `locale_reviewer, terminology, write, *, *, *, *, *, *` (allow)
- `KNOWN_OBJECTS` 加入 `'terminology'`
- `CAPABILITY_ACTIONS` 加入 `terminology` → `[GET /terminology, POST /terminology/import, ...]`
  以及 `locale_reviewer` 对应的 actions 子集

**Patterns to follow:**

- 现有 `operator` 的 `addPolicy` 调用模式（9 个位置参数 + `'allow'`）
- `CAPABILITY_ACTIONS` 的 `ActionDescriptor` 结构

**Test scenarios:**

- Happy path: `locale_reviewer` 可 `listings:read` → capabilities 包含 listings read action
- Happy path: `locale_reviewer` 可 `listings:write` field=`title` → 允许
- Edge case: `locale_reviewer` 尝试 `listings:write` field=`price` → 拒绝（Casbin enforce 返回 false）
- Happy path: `locale_reviewer` 可 `terminology:write` → capabilities 包含 terminology write action
- Integration: `GET /iam/capabilities` with `locale_reviewer` token → `availableActions` 包含
  `GET /terminology` 和 `POST /terminology/import`

**Verification:**

- `iam.controller.spec.ts` 新增 `locale_reviewer` 用例全绿
- `casbin.service.spec.ts`（若存在）验证 field-level restrict

---

- [ ] U4. **多语言直写 Prompt 策略**

**Goal:** 升级 `assembleAmazonEnPrompt` 和 `assembleWalmartPrompt`，使其在
`targetLocale` 为 `es` / `fr` 时直接用目标语言写作，并将传入的术语表注入
Brand Voice 章节。

**Requirements:** R4

**Dependencies:** U2（`TerminologyEntry` 数据结构需先定义，prompt 引用其字段）

**Files:**

- Modify: `apps/api/src/listing/prompts/assemble-listing-prompt.ts`
- Modify: `apps/api/src/listing/prompts/assemble-walmart-en-prompt.ts`
- Create: `apps/api/src/listing/prompts/locale-writing-guidelines.ts`
- Modify: `apps/api/src/listing/prompts/assemble-listing-prompt.spec.ts`
- Modify: `apps/api/src/listing/prompts/assemble-walmart-en-prompt.spec.ts`
- Modify: `apps/api/src/listing/listing.controller.ts` _(传递术语表)_

**Approach:**

- 新建 `locale-writing-guidelines.ts`：导出 `LOCALE_GUIDELINES: Record<LocaleCode, string>`，
  每种语言一段写作规范（EN 保持原有 Amazon/Walmart 规则，ES / FR 分别写对应语言规范）
- `assemble-listing-prompt.ts` 接收新参数 `terminology?: TermEntry[]`（`{ term, definition }[]`）；
  当 `targetLocale !== 'en'`：
  1. System prompt 改为"You write Amazon listings in [language]"
  2. 注入 `LOCALE_GUIDELINES[locale]` 替换原有 EN Writing Guidelines
  3. 在 Brand Voice 章节追加"专用术语对照表"块
- `assemble-walmart-en-prompt.ts` 同理（文件名可保持不变，内部按 locale 分支）
- `listing.controller.ts` 在调用 prompt 前，从 `TerminologyService` 查询
  `(brandId, targetLocale)` 的术语表并传入

**Patterns to follow:**

- 现有 `BRAND_VOICE` map 在 `assemble-listing-prompt.ts` 中的注入方式
- `GenerateListingInput` 类型扩展（添加可选字段 `terminology`）

**Test scenarios:**

- Happy path: `targetLocale='en'` → prompt 包含英文写作规则，不含术语块
- Happy path: `targetLocale='es'` → prompt system message 为西班牙语，包含 ES Writing Guidelines
- Happy path: `targetLocale='fr'` → prompt system message 为法语，包含 FR Writing Guidelines
- Happy path: 传入 `terminology=[{term:'HomPure', definition:'...'}]` →
  prompt 的 Brand Voice 章节包含该术语
- Edge case: `terminology=[]` → 不注入术语块（无多余空行）
- Edge case: 未知 locale（`de`）→ 回退到 EN Guidelines，不抛异常
- Integration: `listing.controller.ts` 在生成 ES listing 前查询术语表并传入 prompt

**Verification:**

- `assemble-listing-prompt.spec.ts` + `assemble-walmart-en-prompt.spec.ts` 全绿
- 手动调用 `POST /listings/generate` with `language: 'es'` →
  返回的 listing title/bullets 为西班牙语

---

## System-Wide Impact

- **Interaction graph:** `listing.controller.ts` 在调用 prompt 前新增一次
  `TerminologyService.findByBrandAndLocale` 查询；若术语库为空则降级（空数组传入），
  不阻塞生成
- **Error propagation:** 术语库查询失败 → 捕获 + 警告日志 + 空术语表降级，
  不向客户端暴露术语库状态
- **State lifecycle risks:** `Locale.isPrimary` 多条并存可能性——U1 需在
  `TerminologyService` 和种子层保证每市场只有一条 `isPrimary=true`（通过
  application-level guard，非 DB unique constraint，因 Prisma 不支持
  条件唯一索引）
- **API surface parity:** `GET /iam/capabilities` 的 `availableActions` 需覆盖
  新增的 `terminology` 端点；U3 显式更新 `CAPABILITY_ACTIONS`
- **Integration coverage:** listing 生成时的术语注入是跨服务交互，需集成测试
  验证 `controller → service → terminology → prompt` 的完整链路
- **Unchanged invariants:** 现有 EN listing 生成行为不变；`targetLocale='en'`
  走原有代码路径，仅追加 `terminology` 参数（空时无副作用）

---

## Risks & Dependencies

| Risk                                                   | Mitigation                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `Locale.isPrimary` 无 DB 唯一约束，可能多条 primary    | `LocaleService.setPrimary` 在事务中先清除同市场其他 primary 再设置新 primary       |
| Gemini 2.5 Pro ES/FR 直写质量未验证（M-02 达标率未知） | W27–W28 末提供 10 条 ES / 10 条 FR 样本给运营评审；未达标则 W29 前加 revision pass |
| CSV 导入大文件（> 1k 行）内存压力                      | 本期内存模式，multer 设上限 2MB；后续按实际使用量决定是否改流式处理                |
| 术语库查询给 listing 生成增加额外延迟                  | 术语库小（<200 条/品牌），单次查询 < 10ms；无需缓存，可按需加 Redis                |

---

## Documentation / Operational Notes

- `locale_reviewer` 角色说明需同步更新 `docs/adr/ADR-010-shop-agent-parity.md`
  的 IAM 权限矩阵章节（或单独 IAM 角色文档）
- Feature flag：`multilingual_listing_generation` 开关；`isActive=false` 时
  只允许 EN 生成，ES/FR 请求返回 400 with feature flag hint

---

## Sources & References

- 实施方案: `docs/yaemartOS-implementation-plan.md` §8 W27–W28
- 现有 Casbin 策略: `apps/api/src/iam/casbin.service.ts`
- 现有 prompt 组装: `apps/api/src/listing/prompts/assemble-listing-prompt.ts`
- S2 listing 矩阵计划: `docs/plans/2026-05-03-002-feat-w24-w25-multi-platform-listing-matrix-plan.md`
