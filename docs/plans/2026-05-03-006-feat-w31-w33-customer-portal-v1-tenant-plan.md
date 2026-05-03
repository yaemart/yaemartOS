---
title: 'feat: W31–W33 客户中心 V1 — Tenant 架构 + 客户门户 + 注册/登录 + 商品目录'
type: feat
status: active
date: 2026-05-03
origin: docs/yaemartOS-implementation-plan.md
---

# feat: W31–W33 客户中心 V1 — Tenant 架构 + 客户门户 + 注册/登录 + 商品目录

## Overview

W31–W33 是 S3 的核心里程碑，为 Homtone + Spoonlemon（首发 2 品牌，架构预留 4 品牌）
交付**完全隔离的客户门户**：独立 PostgreSQL schema（4 品牌）+ 客户注册/登录/邮箱验证/密码重置 +
公开商品目录（Product × Market + FAQ 多语言）+ 品牌隐私政策。

W31–W33 为 W34（AI Chat + 工单）提供 Tenant 基础设施和客户会话基础，是 S3 最高优先级交付件。

---

## Problem Frame

当前系统仅有运营人员（admin panel）门户。S3 要求面向消费者的客户门户上线，核心挑战：

1. **4 品牌客户库严格隔离**：同一邮箱在 4 个品牌可各自独立注册账户，物理 schema 隔离
   （homtone/spoonlemon/davivy/tysun），任何跨 schema 数据泄漏视为 P0 缺陷
2. **Auth 双轨**：运营 JWT（admin 域）与客户 JWT（portal 域）完全分离，不同 secret、
   不同 payload、不同 audience claim
3. **Tenant 数据模型不完整**：现有 `tenant.schema.prisma` 只有骨架（Customer/Ticket 字段缺失
   auth 所需字段：passwordHash、emailVerifiedAt、emailVerificationToken、resetToken 等）
4. **Portal 前端不存在**：现有 `apps/web` 是运营 admin panel，客户门户需新建 `apps/portal`
   Next.js 应用，品牌主题通过 `NEXT_PUBLIC_BRAND` env var 注入
5. **无 Email 服务**：验证邮件和密码重置邮件功能需要新建 SMTP 服务，支持品牌独立 FROM 地址

---

## Requirements Trace

- R1. 4 个品牌 tenant PostgreSQL schema 各含完整 Customer 域模型（含 auth 字段）
- R2. `scripts/migrate-tenant-schemas.ts` 脚本为全部 4 个 schema 执行迁移
- R3. 邮件服务支持品牌独立 FROM 配置（通过 SystemConfig），模板含品牌 Logo
- R4. 客户注册（邮箱+密码）→ 邮箱验证邮件 → 激活账户
- R5. 客户登录返回 Customer JWT（audience=`customer`，与 operator JWT 完全隔离）
- R6. 密码重置：忘记密码 → 重置邮件 → 填写新密码 → 成功
- R7. `apps/portal` 新 Next.js 14 app：品牌主题、next-intl 国际化、Auth 页面组
- R8. 公开商品目录 API（无需登录）：产品列表 + 详情，支持 `?locale=` 过滤 ProductContent
- R9. Portal 商品列表页 + 详情页（含 FAQ/规格 via 产品描述）+ 多语言切换
- R10. 品牌隐私政策页面（从 SystemConfig 动态读取文案，按 brand+locale 组合）
- R11. 跨 tenant 隔离测试：任意请求泄漏到错误 schema 即失败

---

## Scope Boundaries

- 不在本计划实现 AI Chat / 工单（W34–W35）
- 不实现手册下载（W36–W37）
- 不实现保修注册（W36–W37）
- 不实现非登录订单查询（W38，需要 Lingxing API 接入）
- 不实现 OAuth（Google/Facebook）登录（S3 仅邮箱+密码）
- 不实现管理员跨品牌聚合看板（W34 AI Chat 同期实现）
- 不实现 Davivy / Tysun 品牌（S3 仅 Homtone + Spoonlemon）
- 不实现实时聊天（W34 WebSocket 基础设施）

### Deferred to Follow-Up Work

- Davivy / Tysun 品牌开通：S4 或 S5 随 4 品牌全量上线时追加 NEXT_PUBLIC_BRAND env 配置
- Google/Facebook OAuth：S4 统一 OAuth 集成计划
- 管理员跨品牌聚合服务：W34 AI Chat 与工单模块同期实现

---

## Context & Research

### Relevant Code and Patterns

- `apps/api/src/database/prisma.service.ts` — `PrismaClientManager`（schema-per-tenant，已实现，
  基于 `@prisma/adapter-pg`；`getTenantClient()` **W31-W33 首次激活**，此前业务代码只用 public schema）
- `apps/api/src/database/database.module.ts` — `PRISMA_PUBLIC_CLIENT` / `PRISMA_TENANT_CLIENT` tokens（已实现）
- `apps/api/src/common/tenant/tenant-context.service.ts` — `TenantContextService`（nestjs-cls，已实现）
- `apps/api/src/common/tenant/tenant.guard.ts` — `TenantGuard`（x-tenant header → CLS，已实现）
- `packages/db/src/index.ts` — `TENANT_SCHEMAS`, `TenantSchema`, `buildSchemaConnectionString`（已实现）
- `apps/api/src/auth/auth.service.ts` — operator JWT 模式（Customer auth 应复用相同 JWT 基础设施但独立 secret）
- `apps/api/prisma/tenant.schema.prisma` — Tenant 模型骨架（需扩展 auth 字段）
- `apps/api/prisma/schema.prisma` — `Product`/`ProductContent`/`Article`/`Locale` 模型（已实现）
- `apps/web/app/[locale]/(public)/login/page.tsx` — 运营登录页（Portal Auth 页面参考布局）
- `apps/web/components/listing/locale-switcher.tsx` — 语言切换组件（Portal 可复用相同视觉风格）

### Institutional Learnings

- **NestJS + Prisma + Neon 多租户 Schema**（`docs/solutions/backend-patterns/nestjs-prisma-neon-multitenant-2026-04-30.md`）：
  - `PrismaClientManager` 单例 Map 缓存 pattern（不用 `.schema()` 动态方法，该方法仍为 open PR）
  - `nestjs-cls` + `TenantGuard` 请求上下文流
  - 4 schema 迁移脚本：`scripts/migrate-all-schemas.ts` + `DIRECT_URL`（direct 连接，非 PgBouncer）
  - 审计日志 Prisma Extension + PostgreSQL 触发器双层
  - Neon PgBouncer transaction mode 下 `set_config(..., TRUE)` is_local 约束
- **运营域 auth pattern**：`apps/api/src/auth/auth.service.ts`——refresh token hash 存 DB、`issueTokens()` 生成 access+refresh pair

### External References

- 无需额外外部研究：本地 solutions doc 和现有 auth 模式充分；multi-tenant 方案已有权威经验文档

---

## Key Technical Decisions

- **Portal 独立 Next.js app（apps/portal）而非 route group**：客户门户与 admin panel 有不同
  部署域名（support.homtone.com）、不同品牌主题配置、不同 CI 环境变量；独立 app 在 monorepo 内
  维护单一代码库，同时保持职责清晰
- **Customer JWT 与 Operator JWT 完全分离**：独立 `CUSTOMER_JWT_SECRET` env var；JWT payload
  含 `aud: 'customer'` claim；`CustomerGuard` 拒绝携带 `aud: 'operator'` token 的请求
- **客户路由必须用 `CustomerTenantGuard` 替代现有 `TenantGuard`**：现有 `TenantGuard`
  当 `x-yaemart-brand` 缺失时静默 fallback 到 `DEFAULT_TENANT`（fail-open），会把无 header
  请求路由到 homtone schema，形成 P0 隔离漏洞。客户路由专用 guard 缺少 header 时直接
  返回 `400 Bad Request`，不走 fallback（fail-closed）
- **`CustomerGuard` 必须交叉验证 JWT brand 与请求 header**：JWT payload 中的 `brand` 字段
  必须与 `x-yaemart-brand` header 一致，不一致返回 `403`，防止持有 homtone token 的请求
  通过替换 header 访问 spoonlemon schema
- **Email 服务用 Nodemailer + SMTP**：不引入第三方 Email SaaS（避免额外成本和依赖）；
  FROM 地址和 SMTP 凭证通过 SystemConfig 表按品牌配置，测试环境用 ethereal/mailtrap mock
- **Article 商品目录策略**：W31-W33 的公开商品 API 读取 `public.Product` + `public.ProductContent`
  （locale-aware），Article 模型用于品牌 CMS 内容；ProductContent.payload（JSON）包含 FAQ/规格
  (implementation 阶段确认 payload schema 是否足够，不足时可 `ALTER TABLE` 添加 faq 列)
- **品牌主题注入**：`NEXT_PUBLIC_BRAND` env var → `<html data-brand="homtone">` → CSS custom
  properties；复用 `apps/web/app/globals.css` 4 品牌 CSS Custom Properties（已就绪），
  `BrandProvider`（`apps/web/providers/brand-provider.tsx`）可抽取到 shared package 后复用

---

## Open Questions

### Resolved During Planning

- **是否 4 个品牌都在 W31-W33 上线**：否——仅首发 Homtone + Spoonlemon，
  架构预留 4 品牌（migrate-tenant-schemas.ts 迁移全部 4 个 schema）
- **Customer JWT 是否需要 refresh token**：是，与 operator auth 相同模式，
  refresh token hash 存于 tenant schema `customer_refresh_token` 表
- **产品目录是否需要 ES 搜索**：否（W31-W33 仅基础列表 + 详情），
  ES 搜索在 W34 AI Chat 阶段引入（ES index 已包含 locale 字段）
- **邮件服务是否支持 HTML 模板**：是，Nodemailer + handlebars/mjml 模板，
  品牌 logo 从 Cloudinary CDN 加载（品牌 logo 已有 Brand.logoUrl 字段）

### Deferred to Implementation

- `ProductContent.payload` JSON schema 是否已包含 FAQ/规格结构，或需要 migration 追加字段：
  实施时查看已有 ProductContent 数据后决定
- Neon 环境下 migrate-tenant-schemas.ts 的 DIRECT_URL schema override 语法
  （`?options=-csearch_path=homtone,public` 兼容性）：实施时集成测试验证
- Portal app 如何在 Vercel/K8s 部署时绑定 `support.homtone.com` 域名：
  S3 上线前的 DNS 配置由运维处理，不在代码范围内

---

## High-Level Technical Design

> _此图展示 W31-W33 的请求流设计，供架构评审用，是方向性指引而非实现规范。_

```
客户请求 → support.homtone.com
  │
  ▼ apps/portal (Next.js, NEXT_PUBLIC_BRAND=homtone)
  │ middleware.ts → next-intl locale 解析
  │ 所有 /api/customer/* 请求附加 x-yaemart-brand: homtone header
  │
  ▼ apps/api (NestJS)
  │ ClsMiddleware (挂载 requestId)
  │ TenantGuard (x-brand → CLS: tenantId='homtone')
  │ CustomerGuard (Customer JWT → CLS: customerId)
  │
  ▼ CustomerAuthService / ArticlePublicService
  │ @Inject(PRISMA_TENANT_CLIENT) → PrismaClientManager
  │ PrismaClientManager.getTenantClient('homtone')
  │ pg adapter: search_path = homtone, public
  │
  ▼ PostgreSQL schema: homtone
    ├── customer (auth, profile)
    ├── customer_refresh_token
    └── [未来 W34: ticket, warranty_registration]

公共域（无需租户）：
  GET /customer/products → public.product + public.product_content (locale filter)
  ├── 不需要 CustomerGuard
  └── 使用 PRISMA_PUBLIC_CLIENT
```

---

## Implementation Units

- [ ] U1. **Tenant Customer 域 Schema 扩展**

**Goal:** 将 `tenant.schema.prisma` 的 Customer 骨架扩展为支持完整 auth 流程的生产 schema，
并为全部 4 个品牌 schema 创建可重复执行的迁移脚本。

**Requirements:** R1, R2

**Dependencies:** 无（PrismaClientManager 和 TENANT_SCHEMAS 已存在）

**Files:**

- Modify: `apps/api/prisma/tenant.schema.prisma`
- Create: `scripts/migrate-tenant-schemas.ts`
- Create: `apps/api/prisma/tenant-migrations/` (SQL migration files for tenant schemas)

**Approach:**

- 在 `tenant.schema.prisma` 的 `Customer` 模型追加字段：`passwordHash String`、
  `emailVerifiedAt DateTime?`、`isActive Boolean @default(false)`、`name String?`
- 新增 `CustomerEmailVerification` 模型：`token String @unique`、`expiresAt DateTime`、
  `usedAt DateTime?`、`customerId String`
- 新增 `CustomerPasswordReset` 模型：同上
- 新增 `CustomerRefreshToken` 模型：`tokenHash String @unique`、`expiresAt DateTime`、
  `revokedAt DateTime?`、`customerId String`
- `scripts/migrate-tenant-schemas.ts`：循环 `TENANT_SCHEMAS`，对每个 schema 执行
  raw SQL migration（使用 `DIRECT_URL` + `pg` 直连，不走 PgBouncer）
- SQL migration 文件手写（因 Prisma CLI 对 tenant schema 不直接支持 migrate deploy）

**Patterns to follow:**

- `packages/db/src/index.ts` — `TENANT_SCHEMAS` 枚举和 `buildSchemaConnectionString()`
- `apps/api/src/auth/auth.service.ts` — refresh token hash 模式（`createHash('sha256')`）
- `docs/solutions/backend-patterns/nestjs-prisma-neon-multitenant-2026-04-30.md` §6.1 迁移脚本

**Test scenarios:**

- Happy path: `pnpm tsx scripts/migrate-tenant-schemas.ts` 对 4 个 schema 迁移成功，
  各 schema 中出现 `customer`, `customer_email_verification`, `customer_refresh_token` 表
- Idempotent: 二次执行不报错（SQL 用 `CREATE TABLE IF NOT EXISTS`）
- Error path: `DIRECT_URL` 未设置 → 脚本抛出明确错误并退出非零状态码
- Edge case: 其中一个 schema 迁移失败 → 打印该 schema 错误，继续执行其他 schema（不整体回滚）

**Verification:**

- `psql $DIRECT_URL -c "\dt homtone.*"` 可见 4 张 customer 域表
- 同上验证 spoonlemon/davivy/tysun schema

---

- [ ] U2. **Mail 服务模块（Nodemailer + 品牌模板）**

**Goal:** 提供可复用的邮件发送基础设施，支持按品牌切换 FROM 地址和模板样式，
为 U3 的邮箱验证和密码重置提供依赖。

**Requirements:** R3

**Dependencies:** U1（无直接代码依赖；逻辑上邮件内含验证链接，需 U1 的 token 数据模型）

**Files:**

- Create: `apps/api/src/mail/mail.module.ts`
- Create: `apps/api/src/mail/mail.service.ts`
- Create: `apps/api/src/mail/templates/email-verification.hbs`
- Create: `apps/api/src/mail/templates/password-reset.hbs`
- Modify: `apps/api/src/app.module.ts`（注册 MailModule）

**Approach:**

- 使用 `nodemailer`（`pnpm add nodemailer @types/nodemailer`）
- `MailService.sendVerification(to, token, brandId, locale)` — 渲染 Handlebars 模板，
  FROM 地址从 `SystemConfig.key = 'mail.from.{brandId}'` 读取
- `MailService.sendPasswordReset(to, token, brandId, locale)` — 同上
- Brand logo URL 从 `SystemConfig.key = 'brand.logo_url.{brandId}'` 读取（或 Brand.logoUrl）
- 测试环境检测 `process.env.MAIL_TEST_MODE === 'true'` → 不实际发送，将邮件内容写入内存 store
  （供测试断言）
- SMTP 配置：`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` env vars

**Patterns to follow:**

- `apps/api/src/settings/settings.service.ts` — SystemConfig 读取模式（如果存在）
- `apps/api/src/common/` — common service 注入模式

**Test scenarios:**

- Happy path: `sendVerification()` 在 `MAIL_TEST_MODE=true` 下 resolve 且不抛出，
  内存 store 中包含正确 to/subject
- Happy path: 邮件主题含品牌名（`[Homtone] 请验证您的邮箱`）
- Edge case: SystemConfig 中无该 brandId 的 FROM 配置 → 使用默认 `FROM` env var，不抛出
- Error path: SMTP 连接失败 → 异常向上传播（不吞掉），使得调用方可以捕获并返回 503

**Verification:**

- Unit test 在 `MAIL_TEST_MODE=true` 下通过
- 手动测试：向真实邮箱发送验证邮件，品牌 Logo 正确显示

---

- [ ] U3. **Customer Auth 模块（注册/登录/邮箱验证/密码重置）**

**Goal:** 在 NestJS 后端实现与运营 auth 完全隔离的客户认证 API，4 品牌客户库
物理隔离（不同 schema），Customer JWT 独立 secret/audience。

**Requirements:** R4, R5, R6, R11

**Dependencies:** U1, U2

**Files:**

- Create: `apps/api/src/customer-portal/customer-portal.module.ts`
- Create: `apps/api/src/customer-portal/customer-auth/customer-auth.controller.ts`
- Create: `apps/api/src/customer-portal/customer-auth/customer-auth.service.ts`
- Create: `apps/api/src/customer-portal/customer-auth/customer-auth.service.spec.ts`
- Create: `apps/api/src/customer-portal/customer-auth/customer.guard.ts`
- Create: `apps/api/src/customer-portal/customer-auth/current-customer.decorator.ts`
- Create: `apps/api/src/customer-portal/customer-tenant.guard.ts`（fail-closed，替代 TenantGuard）
- Modify: `apps/api/src/app.module.ts`（注册 CustomerPortalModule）

**Approach:**

- `CustomerTenantGuard`（先于所有 customer 路由运行）：读取 `x-yaemart-brand` header；
  header 缺失或值非合法 TenantSchema → 立即 `400 Bad Request`，不走 fallback
- 路由前缀：`/customer/auth/`（全部路由受 `CustomerTenantGuard` 保护，auth 路由无 `CustomerGuard`）
  - `POST register` → 创建 Customer（inactive）→ 生成 verification token → `MailService.sendVerification()`
  - `POST verify-email` body: `{ token }` → Customer.isActive=true → 删除 token；
    另增 `POST resend-verification`（防止首次邮件丢失）
  - `POST login` → 校验 email+password（bcrypt）→ 只允许 isActive=true → 403+`EMAIL_NOT_VERIFIED`；
    返回 accessToken+refreshToken
  - `POST refresh` → 校验 refresh token hash → **原子操作**（同一事务内 revoke 旧 token + issue 新 token，
    防并发竞态）→ 滚动 refresh token
  - `POST forgot-password` → 无论邮箱是否存在均返回 200（防枚举）；生成 reset token（TTL 1h）
  - `GET validate-reset-token?token=xxx` → 前端进入重置页前校验 token 是否有效（200 / 400）
  - `POST reset-password` body: `{ token, newPassword }` → 校验 token 未过期未使用 →
    更新 passwordHash → 标记 token usedAt
- Customer JWT payload: `{ sub: customerId, email, brand: tenantId, aud: 'customer' }`
- `CustomerGuard`（保护需要登录的路由）：
  1. 验证 JWT `aud === 'customer'`
  2. **交叉验证**：`jwt.brand === x-yaemart-brand header`，不一致返回 `403`（防 tenant 越权）
  3. 读取 tenant schema 确认 Customer 存在且 isActive
- 速率限制：register/login/forgot-password/resend-verification 端点用 `@nestjs/throttler`
  `5 req/15min per IP`（防暴力破解）
- CSRF 防护：refresh token 走 httpOnly cookie；accessToken 走 Response body；
  登录后 cookie 设 `SameSite=Strict`（Portal 与 API 同域名部署时）或接受 double-submit cookie 方案
- 依赖注入：`@Inject(PRISMA_TENANT_CLIENT)` 注入租户 Prisma client

**Patterns to follow:**

- `apps/api/src/auth/auth.service.ts` — refresh token hash、`issueTokens()` 模式
- `apps/api/src/auth/guards/` — JwtAuthGuard 模式
- `apps/api/src/common/tenant/tenant.guard.ts` — CLS tenant 写入模式

**Test scenarios:**

- Happy path: 完整注册→验证→登录流程（以 homtone tenant 为例），返回 Customer JWT
- Happy path: refresh token 滚动——旧 token 被撤销，新 token 可用
- Error path: 未验证邮箱登录 → 403 with code `EMAIL_NOT_VERIFIED`
- Error path: 重复注册相同邮箱（同 tenant）→ 409 `CUSTOMER_ALREADY_EXISTS`
- Error path: 使用已过期 email verification token → 400 `TOKEN_EXPIRED`
- Error path: 使用已使用的 password reset token → 400 `TOKEN_ALREADY_USED`
- Security: 无 `x-yaemart-brand` header 的请求 → `CustomerTenantGuard` 返回 400（不走 homtone fallback）
- Security: 持有 homtone Customer JWT + `x-yaemart-brand: spoonlemon` → `CustomerGuard` 交叉验证失败 → 403
- Security: register/login/forgot-password 超过 5 次/15min per IP → 429
- Error path: 登录密码错误 5 次后触发速率限制，不返回"账户不存在"（防枚举）
- Integration: `CustomerTenantGuard` 从 `x-yaemart-brand: homtone` header 设置 CLS →
  `CustomerAuthService` 使用 PRISMA_TENANT_CLIENT 查询 homtone schema
- Integration: refresh token 并发请求（同 token 两次同时 POST /refresh）→ 只有一个成功，另一个 401

**Verification:**

- `pnpm test` in `apps/api` 全绿
- E2E smoke：POST /customer/auth/register → verify email token → POST /customer/auth/login 返回 JWT

---

- [ ] U4. **Article 公开商品目录 API**

**Goal:** 提供无需登录的公开 REST API，返回 Brand × Market 维度的产品列表和详情
（含多语言 ProductContent），供 Portal 前端商品页使用。

**Requirements:** R8

**Dependencies:** U3（CustomerPortalModule 模块边界，但可独立于 U3 先行）

**Files:**

- Create: `apps/api/src/customer-portal/article-public/article-public.controller.ts`
- Create: `apps/api/src/customer-portal/article-public/article-public.service.ts`
- Create: `apps/api/src/customer-portal/article-public/article-public.service.spec.ts`

**Approach:**

- 路由：`GET /customer/products`（query: `locale`, `brandId`, `page`, `limit`）
  - 查询 `public.Product` + join `public.ProductContent`（按 `locale + status=active` 过滤）
  - 返回：`{ id, sku, slug, title, description, imageUrls, locale, category }` 分页结果
- 路由：`GET /customer/products/:slug`（query: `locale`）
  - 查询 `public.Product`（by sku 或 slug）+ `public.ProductContent`
  - 返回：产品详情 + `payload.faq` 数组（如存在）
- 使用 `PRISMA_PUBLIC_CLIENT`（无需 tenant 切换）
- 无需 `CustomerGuard`（公开接口）；需要 `TenantGuard`（确定品牌上下文）
- 限流：使用 NestJS Throttler（`@nestjs/throttler`）`100 req/min` per IP

**Patterns to follow:**

- `apps/api/src/product/product.service.ts` — Product 查询模式（如存在）
- `apps/api/src/locale/locale.controller.ts` — 多语言过滤模式

**Test scenarios:**

- Happy path: `GET /customer/products?locale=en&brandId=xxx` 返回 EN 语言 ProductContent 分页列表
- Happy path: `GET /customer/products?locale=es` 返回 ES 版本，无 ES 内容的产品不出现在列表
- Happy path: `GET /customer/products/:slug?locale=en` 返回单品详情含 FAQ
- Edge case: 产品无该 locale 的 active ProductContent → 降级返回 EN（若有）或 404
- Edge case: 分页参数超出范围（page=999）→ 返回空 items 数组，不报错
- Error path: slug 不存在 → 404 `PRODUCT_NOT_FOUND`

**Verification:**

- `GET /customer/products?locale=es` 在集成环境只返回 ES 版 ProductContent
- Throttler 测试：101 次请求触发 429

---

- [ ] U5. **Portal 前端 App 骨架（apps/portal）**

**Goal:** 建立独立的 Next.js 14 App Router 客户门户，支持品牌主题注入（NEXT_PUBLIC_BRAND）、
next-intl 国际化（EN/ES/FR），以及完整的 Auth 页面组（注册/登录/邮箱验证/忘记密码/重置密码）。

**Requirements:** R7

**Dependencies:** U3（auth API 端点必须可调用）

**Files:**

- Create: `apps/portal/package.json`
- Create: `apps/portal/next.config.mjs`
- Create: `apps/portal/tailwind.config.ts`
- Create: `apps/portal/middleware.ts`
- Create: `apps/portal/app/[locale]/layout.tsx`
- Create: `apps/portal/app/[locale]/(auth)/register/page.tsx`
- Create: `apps/portal/app/[locale]/(auth)/login/page.tsx`
- Create: `apps/portal/app/[locale]/(auth)/verify-email/page.tsx`
- Create: `apps/portal/app/[locale]/(auth)/forgot-password/page.tsx`
- Create: `apps/portal/app/[locale]/(auth)/reset-password/page.tsx`
- Create: `apps/portal/components/brand-header.tsx`
- Create: `apps/portal/components/brand-footer.tsx`
- Create: `apps/portal/components/locale-switcher.tsx`
- Create: `apps/portal/lib/api/customer-api-client.ts`（封装 fetch with x-brand header）
- Create: `apps/portal/.env.local.example`
- Modify: `pnpm-workspace.yaml`（如需加入 apps/portal）

**Approach:**

- `NEXT_PUBLIC_BRAND=homtone` → `<html data-brand="homtone">` → CSS custom properties 品牌主题
  （复用 `apps/web` 的 `data-brand` + CSS variables 体系，颜色从 `Brand.themeColor` 同步）
- `middleware.ts`：`next-intl` middleware，locales=[en,es,fr]，defaultLocale=en
- `customer-api-client.ts`：所有请求自动注入 `x-yaemart-brand: ${process.env.NEXT_PUBLIC_BRAND}` header
- Auth 页面只含表单逻辑（客户端组件），服务层调用通过 Next.js API Route
  `/app/api/customer/` 代理（避免 CORS，keep credentials cookie-safe）
- 登录成功后 JWT 存 httpOnly cookie（不存 localStorage，防 XSS）
- Auth 跳转流：注册成功 → 提示"查收邮件验证"页；验证成功 → 跳转登录；登录成功 → `/products`
- Error 显示：inline `<p role="alert">` 组件，不用 toast 库（与 admin panel 风格一致）

**Patterns to follow:**

- `apps/web/app/[locale]/(public)/login/page.tsx` — 登录表单结构
- `apps/web/middleware.ts` — next-intl middleware 配置
- `apps/web/tailwind.config.ts` — Tailwind + CSS variables 主题

**Test scenarios:**

- Happy path: `NEXT_PUBLIC_BRAND=homtone` → `data-brand="homtone"` 属性注入，品牌色变量生效
- Happy path: 注册表单提交 → POST `/api/customer/auth/register` → 跳转"验证邮箱"页
- Happy path: 登录后 cookie 中有 httpOnly `customer_token`
- Edge case: NEXT_PUBLIC_BRAND 未设置 → 页面仍正常渲染（降级用默认主题），控制台 warn
- Error path: 注册失败（409 邮箱已存在）→ 表单内显示错误，不跳转

**Verification:**

- `pnpm dev:portal`（新增 turbo/pnpm script）在本地启动无报错
- 浏览器打开 http://localhost:3001 可见 Homtone 主题品牌色
- 完整注册→验证→登录流程可在浏览器手动走通

---

- [ ] U6. **Portal 商品目录页 + 隐私政策页**

**Goal:** 实现公开的商品列表+详情页（无需登录）和品牌隐私政策页（动态加载），
支持 URL 多语言切换（/en/products → /es/products）。

**Requirements:** R9, R10

**Dependencies:** U4, U5

**Files:**

- Create: `apps/portal/app/[locale]/(public)/products/page.tsx`
- Create: `apps/portal/app/[locale]/(public)/products/[slug]/page.tsx`
- Create: `apps/portal/app/[locale]/(public)/privacy-policy/page.tsx`
- Create: `apps/portal/components/product-card.tsx`
- Create: `apps/portal/components/product-faq.tsx`
- Modify: `apps/portal/lib/api/customer-api-client.ts`（新增 getProducts / getProduct）

**Approach:**

- 商品列表页：Server Component，调用 `GET /customer/products?locale={locale}&brandId=xxx`
  → `<ProductCard>` 网格布局；`<LocaleSwitcher>` 使用 next-intl `usePathname()`
- 商品详情页：Server Component + generateStaticParams（构建时预渲染热门产品），
  `revalidate = 3600`（ISR 每小时刷新）
- FAQ 展示：`ProductFaq` 组件读取 `ProductContent.payload.faq` 数组（
  `[{ question: string, answer: string }]`），若字段不存在则不渲染 FAQ 区块
- 隐私政策页：从 `GET /customer/config/privacy-policy?locale={locale}` 获取 HTML/markdown 文案
  → 渲染（需在 U4 同期追加此 config 端点，或暂时用 static MDX 文件）
- 多语言切换：`<LocaleSwitcher>` 组件生成各语言版本链接，`hreflang` meta 标签 SEO 友好

**Patterns to follow:**

- `apps/web/app/[locale]/(admin)/listings/page.tsx` — Server Component + searchParams 模式
- `apps/web/components/listing/locale-switcher.tsx` — 语言切换组件视觉风格

**Test scenarios:**

- Happy path: `/en/products` 渲染 EN 版产品列表，每个 card 含产品图、标题、SKU
- Happy path: 点击语言切换到 `/es/products` → 显示 ES 版 ProductContent
- Happy path: `/en/products/my-product` 显示详情和 FAQ（若 FAQ 存在）
- Edge case: ProductContent 无 FAQ payload → 页面正常渲染，不出现 FAQ 区块
- Edge case: 商品列表为空（该 brand+locale 无 active 产品）→ 显示空状态文案，不报错
- Happy path: 隐私政策页加载并显示品牌专属文案

**Verification:**

- 浏览器访问 `/en/products` 可见商品列表（至少 1 款测试产品）
- 语言切换后 URL 变更且内容按语言切换
- 隐私政策页 URL 可访问，内容含品牌名

---

## System-Wide Impact

- **Interaction graph:** 新增 `/customer/*` API 路由组（CustomerPortalModule），与现有
  operator 路由（`/auth/*`, `/listings/*` 等）无交叉；`TenantGuard` 追加 `x-brand` header
  别名，不影响现有 `x-tenant` 用法
- **Error propagation:** Customer auth 失败（401/403）不暴露系统内部错误；
  MailService 发送失败抛出异常 → CustomerAuthService catch → 返回 503 提示用户稍后重试
- **State lifecycle risks:** 邮箱验证 token 和密码重置 token 均有 TTL（默认 24h/1h），
  需定期清理过期 token（W34 前可接受不清理，表数据量小；可加 cron job 标记）
- **API surface parity:** Portal 的 `GET /customer/products` 与 admin 的 `GET /products`
  完全独立，admin API 不对外暴露；两者返回格式有意不同（portal 返回 public-facing 字段子集）
- **Integration coverage:** 最关键集成路径：Portal → x-brand header → TenantGuard CLS →
  CustomerAuthService → PRISMA_TENANT_CLIENT → 正确 schema；需 E2E 测试覆盖，
  单元 mock 无法证明 CLS 流正确
- **Unchanged invariants:** 运营 admin auth（`/auth/login`、JWT `aud='operator'`）、
  Casbin 策略、`PRISMA_PUBLIC_CLIENT` 查询均不受本计划影响

---

## Risks & Dependencies

| Risk                                                               | Mitigation                                                                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **P0** TenantGuard fail-open → 无 header 请求路由到 homtone schema | U3 必须用 `CustomerTenantGuard`（fail-closed），不继承现有 `TenantGuard`           |
| **P0** CustomerGuard 无交叉验证 → JWT brand 与 header 可被独立篡改 | U3 `CustomerGuard` 强制验证 `jwt.brand === x-yaemart-brand`，不一致返回 403        |
| **P1** Auth 端点无速率限制 → 暴力破解/邮件轰炸                     | U3 注册/登录/forgot-password 端点加 `@Throttle(5, 900)`（5 次/15 min per IP）      |
| **P1** Refresh token 并发竞态 → 同一 token 被使用两次              | U3 refresh 操作用 DB 事务原子撤销旧 token + 签发新 token                           |
| **P1** CSRF（refresh token 走 httpOnly cookie）                    | Portal 与 API 同域部署时 `SameSite=Strict`；不同域时实现 double-submit cookie 方案 |
| Neon tenant schema migration 在 PgBouncer pooled URL 下失败        | 迁移脚本强制使用 `DIRECT_URL`（直连，非 pooled）；加校验断言                       |
| 邮件 SMTP 配置复杂（4 品牌 FROM 地址）                             | W31-W33 先用单一 SMTP，FROM 地址用 SystemConfig 表按品牌配置；S4 再接多个 SMTP     |
| Portal app 构建时间增加 CI pipeline                                | 仅在 `apps/portal/**` 变更时触发 portal build job（pnpm filter）                   |
| ProductContent.payload 无 FAQ 字段                                 | U6 实施时检查现有 payload schema；若无则添加 DB migration 追加 `faq Json?` 列      |

---

## Documentation / Operational Notes

- **新增 env vars**（需写入 `apps/portal/.env.local.example` 和 `apps/api/.env.local.example`）：
  - `CUSTOMER_JWT_SECRET`（必须，不与 `JWT_SECRET` 相同）
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
  - `NEXT_PUBLIC_BRAND=homtone`（portal 部署时按品牌设置）
  - `NEXT_PUBLIC_API_URL`（portal 调用 API 的 base URL）
  - `MAIL_TEST_MODE=true`（测试/开发环境禁用真实发送）
- **Neon 分支 CI 需更新**：`scripts/migrate-tenant-schemas.ts` 需要加入 PR preview 流水线
  （`preview.yml` 中 "Run All Schema Migrations" 步骤已有，确认覆盖 tenant schemas）
- **S3 上线前 DNS 配置**：`support.homtone.com` / `support.spoonlemon.com` → Portal 部署 IP，
  由运维在 W39 上线前完成；代码层面与域名无耦合

---

## Sources & References

- **Origin document:** `docs/yaemartOS-implementation-plan.md` §8 W31–W33
- Multi-tenant pattern: `docs/solutions/backend-patterns/nestjs-prisma-neon-multitenant-2026-04-30.md`
- Tenant schema: `apps/api/prisma/tenant.schema.prisma`
- PrismaClientManager: `apps/api/src/database/prisma.service.ts`
- Operator auth 模式: `apps/api/src/auth/auth.service.ts`
- TenantGuard: `apps/api/src/common/tenant/tenant.guard.ts`
- Product/Locale 数据模型: `apps/api/prisma/schema.prisma`
- packages/db 共享类型: `packages/db/src/index.ts`
