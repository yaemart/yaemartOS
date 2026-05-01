---
title: 'feat: W1 项目初始化 — Monorepo + 前后端骨架 + AI Services 层'
type: feat
status: active
date: 2026-05-01
origin: docs/brainstorms/pre-implementation-readiness-requirements.md
---

# feat: W1 项目初始化 — Monorepo + 前后端骨架 + AI Services 层

## Overview

建立 yaemartOS 的完整开发基础：pnpm monorepo、代码质量工具链、GitHub Actions CI、NestJS API 骨架、Prisma + Neon 数据库接入、Next.js 前端整合、AI Services 抽象层（Gemini only）、Cloudinary、Sentry、Playwright E2E。

W1 结束时，两位开发者应能从干净的 `git clone` 出发，5 分钟内完成本地启动，并看到前端调后端 `/health`、AI `helloWorld()`、Cloudinary 图片上传的全链路冒烟通过。

---

## Problem Frame

当前仓库状态：

- `apps/web/`：上一阶段已有 UI 原型组件（Listing Editor、Dev Preview Dock、Portal Shell），基于 Next.js 14 + Tailwind + shadcn/ui
- `apps/api/`：仅有 `.env.local.example`，无任何后端代码
- 根目录：无 `package.json`、无 pnpm workspace、无 CI 配置

W1 目标是把这些"文档就绪、代码空白"状态推进到"技术骨架可运行"状态，为 W2（领域模型 + 数据库）和 W3（IAM）提供稳固基础。

（see origin: `docs/brainstorms/pre-implementation-readiness-requirements.md`）

---

## Requirements Trace

- R-W1a. Monorepo 结构 + 代码质量门禁：`pnpm install` 跑通；`git commit` 走完 hook
- R-W1b. GitHub Actions CI：lint + typecheck + test + build 三 job 并行，CI 绿
- R-W1c. NestJS API 骨架：`pnpm dev:api` 启动；`/health` 返回 200；Sentry 见到首条 trace
- R-W1d. Prisma + Neon：`prisma migrate dev` 成功；User / Brand 占位表存在
- R-W1e. Docker Compose：`docker-compose up` 一键本地启动（postgres + redis + api + web）
- R-W1f. Next.js 整合：Storybook 跑通；next-intl 预埋；Sentry 前端接入
- R-W1g. 设计 Token：4 品牌 CSS 变量 + Tailwind 主题完整配置，Storybook 可见
- R-W1h. AI Services 层：3 个 service 接口定义；`listingGenerationService.helloWorld()` 单元测试通过（调 Gemini Flash）
- R-W1i. Cloudinary：后端上传 API + 前端展示；1 张图片上传成功 + CDN 访问
- R-W1j. 指标基础：Postgres `metrics` 表 DDL 入库；k6 hello-world 跑通；Sentry dashboard 配置完毕
- R-W1k. E2E 基础：Playwright 初始化；1 条冒烟用例（前端调后端 `/health`）CI 跑通
- R-W1l. ADR-002 + CONTRIBUTING.md + README 入库；W1 复盘文档模板就位

**Origin actors:** A1（tech lead）、A2（dev #2）

---

## Scope Boundaries

- **不包含** W2 领域模型（Category / Product / Listing 等表）
- **不包含** W3 IAM（Casbin / OAuth / JWT）
- **不包含** AI Services 的路由/fallback/cost tracking/rate limit（S2+ 才引入）
- **不包含** Elasticsearch 初始化（W4）
- **不包含** 领星 ERP 接入（W7+）
- **不包含** 生产环境 Kubernetes/Railway 部署（staging W13）
- 前端原型组件（Listing Editor、Dev Preview Dock）**保留但不重构**；W4 前端 shell 阶段统一整合

### Deferred to Follow-Up Work

- Neon branching CI（每 PR 独立数据库分支）：计划在 W2 搭建数据库层时一并配置（见 `docs/solutions/backend-patterns/nestjs-prisma-neon-multitenant-2026-04-30.md` §6.2）
- `packages/db`（共享 Prisma client）：W2 多租户 schema 实现后再抽取，W1 先放 `apps/api/src/database/`

---

## Context & Research

### Relevant Code and Patterns

- `apps/web/package.json`：现有 Next.js 14 依赖（next ^14.2、framer-motion、lucide-react、Radix UI）
- `apps/web/app/globals.css`：已有 4 品牌 CSS Custom Properties（`--brand-*`）
- `apps/web/tailwind.config.ts`：已有品牌色 token 扩展
- `apps/web/providers/brand-provider.tsx`：品牌切换 Context 已实现
- `apps/api/.env.local.example`：环境变量模板（**注意**：DB URL 需从 Supabase 格式改为 Neon 格式）
- `docs/ui/A-design-system.md`：4 品牌设计 token 完整规格
- `docs/ui/B-admin-shell.md`：管理后台 Shell 规范（W4 实现，W1 预埋路由结构）
- `docs/adr/ADR-001-tech-stack.md`：技术选型全决策

### Institutional Learnings

- `docs/solutions/backend-patterns/nestjs-prisma-neon-multitenant-2026-04-30.md`：NestJS + Prisma + Neon 多租户完整最佳实践，含 `PrismaClientManager`、`nestjs-cls`、审计触发器、GitHub Actions Neon 分支 CI 代码
- W1 只建 `public` schema 的 User/Brand 占位表；多租户 `PrismaClientManager` 在 W2 实现

### External References

- [Prisma Neon 连接指南](https://neon.com/docs/guides/prisma)（两条连接串：DATABASE_URL pooled + DIRECT_URL direct）
- [NestJS ConfigModule 文档](https://docs.nestjs.com/techniques/configuration)
- [Vercel AI SDK Providers](https://sdk.vercel.ai/providers/ai-sdk-providers/google-generative-ai)
- [Storybook + Next.js 集成](https://storybook.js.org/docs/get-started/nextjs)
- [next-intl 快速开始](https://next-intl-docs.vercel.app/docs/getting-started)

---

## Key Technical Decisions

- **pnpm workspace 包结构**：W1 仅建 `apps/web`、`apps/api`、`packages/shared-types`、`packages/eslint-config`；`packages/db` 推迟到 W2 多租户落地后再抽取，避免过早抽象
- **NestJS 目录结构**：`src/` 按模块分组（`database/`、`ai/`、`common/`、`config/`、`health/`），遵循 NestJS 官方 barrel export 约定
- **AI Services 层接口设计**：3 个 service（`ListingGenerationService`、`McpToolCallService`、`StructuredExtractionService`）定义 TypeScript interface，`GeminiListingGenerationService` 作为 W1 唯一实现；S2 引入 `GlmListingGenerationService`，通过 NestJS DI token 切换
- **Gemini Provider**：仅 Pro + Flash 两个模型；S1 无 fallback、无 cost tracking；`helloWorld()` 调 Flash（成本最低）
- **Prisma 双连接串**：`DATABASE_URL`（Neon pooled，应用运行时）；`DIRECT_URL`（Neon direct，`prisma migrate` 用）—— 参考 ADR-001 §2.3 和 solutions 文档
- **Docker Compose**：dev 环境用本地 postgres + redis（覆盖 DATABASE_URL），便于离线开发；staging/prod 用 Neon + Upstash
- **Storybook**：与 Next.js App Router 集成，使用 `@storybook/nextjs` framework；只需 Button / Card 两个 story 验证设计 token 渲染正确
- **next-intl**：W1 仅 EN locale，但文件结构预留 `messages/en.json`、`messages/es.json`（空）；路由结构 `/[locale]/...`
- **代码质量工具链**：ESLint（flat config `eslint.config.mjs`，继承 `@yaemartos/eslint-config`）+ Prettier + Husky v9 + commitlint（conventional commits）；pre-commit 运行 lint-staged

---

## Open Questions

### Resolved During Planning

- **Neon vs Supabase**：`.env.local.example` 中的 Supabase URL 格式需在 U1 完成后改为 Neon 格式（ADR-001 §2.3 已确认 Neon）
- **`packages/db` 时机**：推迟到 W2，W1 Prisma client 放 `apps/api/src/database/`
- **AI Services 层位置**：放 `apps/api/src/ai/`，不抽为 package（W2+ 若需 CLI 脚本共享再评估）
- **前端原型代码**：保留 `apps/web/components/listing/`、`apps/web/components/dev/`、`apps/web/providers/`——W4 前端 shell 时正式整合，W1 不动

### Deferred to Implementation

- Storybook 7 vs 8：安装时确认最新稳定版，`@storybook/nextjs` 文档随版本变化
- k6 脚本确切 threshold 数值：W1 只建骨架，M-01 baseline 在 W1 末 load test 后确定
- Sentry performance sampling rate：dev 环境设 1.0，staging/prod 设 0.1（环境变量控制）

---

## Output Structure

```
yaemartOS/
├── package.json                          # pnpm workspace root
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── .npmrc                                # shamefully-hoist=true for NestJS
├── .eslintrc.js  →  eslint.config.mjs   # flat config
├── .prettierrc
├── commitlint.config.js
├── .husky/
│   └── pre-commit
├── docker-compose.yml
├── docker-compose.override.yml           # dev overrides
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   ├── web/                              # existing + rationalized
│   │   ├── .storybook/
│   │   │   └── main.ts
│   │   ├── messages/
│   │   │   ├── en.json
│   │   │   └── es.json                   # empty placeholder
│   │   └── [existing files preserved]
│   └── api/
│       ├── package.json                  # @yaemartos/api
│       ├── tsconfig.json
│       ├── nest-cli.json
│       ├── .env.local.example            # updated to Neon format
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── prisma.config.ts
│       │   └── migrations/
│       └── src/
│           ├── main.ts
│           ├── app.module.ts
│           ├── config/
│           │   └── config.module.ts
│           ├── database/
│           │   └── prisma.service.ts
│           ├── health/
│           │   └── health.controller.ts
│           ├── ai/
│           │   ├── interfaces/
│           │   │   ├── listing-generation.interface.ts
│           │   │   ├── mcp-tool-call.interface.ts
│           │   │   └── structured-extraction.interface.ts
│           │   ├── providers/
│           │   │   └── gemini-listing-generation.service.ts
│           │   └── ai.module.ts
│           └── cloudinary/
│               └── cloudinary.module.ts
├── packages/
│   ├── shared-types/
│   │   ├── package.json                  # @yaemartos/shared-types
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts                  # BrandId, Locale 枚举
│   └── eslint-config/
│       ├── package.json                  # @yaemartos/eslint-config
│       └── index.js
├── scripts/
│   └── k6/
│       └── health-smoke.js              # k6 hello-world
└── tests/
    └── e2e/
        └── health-smoke.spec.ts         # Playwright smoke test
```

---

## High-Level Technical Design

> _以下图示为方向性指引，供评审验证整体架构，不是实现规格。_

### 依赖关系图（实施单元）

```
U1 (Monorepo) ──→ U2 (质量工具) ──→ U3 (CI)
                                          ↓
U1            ──→ U4 (NestJS)  ──→ U5 (Prisma + Docker)
                                          ↓
U1            ──→ U6 (前端整合) ──→ U7 (设计 Token)
                                          ↓
U4 + U5       ──→ U8 (AI Layer) ──→ U9 (Cloudinary)
                                          ↓
U4 + U5 + U8  ──→ U10 (指标基础)
                                          ↓
所有 U1-U10   ──→ U11 (E2E + 冒烟) ──→ U12 (ADR + 文档)
```

### 请求流（D5 冒烟验证）

```
浏览器 → Next.js /en → GET /api/health → NestJS /health → 200 OK
浏览器 → 上传图片 → POST /api/upload → Cloudinary → CDN URL 返回前端
浏览器 → 触发 helloWorld → POST /api/ai/hello → Gemini Flash → "Hello yaemartOS"
```

---

## Implementation Units

- [x] U1. **Monorepo 根目录结构**

**Goal:** 建立 pnpm workspace，统一 package 命名空间，安装所有 root-level 依赖

**Requirements:** R-W1a

**Dependencies:** 无

**Files:**

- Create: `package.json`（workspace root，scripts: dev / build / lint / test）
- Create: `pnpm-workspace.yaml`（packages: ["apps/*", "packages/*"]）
- Create: `.npmrc`（shamefully-hoist=true，解决 NestJS peer deps）
- Create: `packages/shared-types/package.json`（@yaemartos/shared-types）
- Create: `packages/shared-types/src/index.ts`（BrandId = 'homtone' | 'spoonlemon' | 'davivy' | 'tysun'；Locale = 'en' | 'es' | 'fr' | 'de' | 'it'）
- Create: `packages/eslint-config/package.json`（@yaemartos/eslint-config）
- Create: `packages/eslint-config/index.js`（基础 ESLint flat config rules）
- Modify: `apps/web/package.json`（name 改为 @yaemartos/web，添加 shared-types 依赖）
- Modify: `apps/api/.env.local.example`（DATABASE_URL 改为 Neon 格式；DIRECT_URL 字段添加）

**Approach:**

- `pnpm-workspace.yaml` packages 数组包含 `apps/*` 和 `packages/*`
- root `package.json` 的 `scripts` 用 `--filter` 派发到各 package
- `packages/shared-types` 不产生构建产物（`exports: "./src/index.ts"`），直接 TypeScript source 引用

**Patterns to follow:**

- `apps/web/package.json` 现有格式作为模板

**Test scenarios:**

- Happy path: `pnpm install` 从根目录运行，无报错，所有 workspace package 链接正确
- Happy path: `pnpm --filter @yaemartos/web dev` 启动 web，`pnpm --filter @yaemartos/api dev` 启动 api
- Edge case: `packages/shared-types` 中的 `BrandId` 类型在 `apps/web` 中可正常 import

**Verification:**

- `pnpm install` 零错误
- `ls node_modules/@yaemartos/` 中可见 shared-types 和 eslint-config 符号链接

---

- [x] U2. **代码质量工具链**

**Goal:** ESLint + Prettier + Husky + commitlint，pre-commit hook 自动拦截不合规提交

**Requirements:** R-W1a

**Dependencies:** U1

**Files:**

- Create: `eslint.config.mjs`（flat config，继承 @yaemartos/eslint-config）
- Create: `.prettierrc`（singleQuote: true, semi: true, printWidth: 100, trailingComma: 'all'）
- Create: `.prettierignore`
- Create: `commitlint.config.js`（extends @commitlint/config-conventional）
- Create: `.husky/pre-commit`（运行 lint-staged）
- Create: `.lintstagedrc.js`（_.{ts,tsx} → eslint --fix；_.{ts,tsx,json,md} → prettier --write）
- Modify: `package.json`（添加 prepare: husky；devDeps: husky, lint-staged, commitlint, @commitlint/config-conventional）

**Approach:**

- Husky v9 使用 `husky init` 生成，pre-commit 调 lint-staged
- commit-msg hook 调 commitlint，强制 conventional commits（type(scope): subject）
- 前后端共用根 ESLint config；各 app 可以在自己的目录 override

**Patterns to follow:**

- `packages/eslint-config/index.js` 的规则作为基准

**Test scenarios:**

- Happy path: `git commit -m "feat: add health endpoint"` 通过 hook
- Error path: `git commit -m "WIP"` 被 commitlint 拒绝，显示规则说明
- Error path: 提交含 ESLint 错误的 TypeScript 文件，pre-commit 失败并输出错误位置

**Verification:**

- `git commit` 走完完整 hook 链，无跳过
- `pnpm lint` 从根目录运行，遍历所有 app/package

---

- [x] U3. **GitHub Actions CI**

**Goal:** lint + typecheck + test 三 job 并行，PR 合入 main 需全绿

**Requirements:** R-W1b

**Dependencies:** U1, U2

**Files:**

- Create: `.github/workflows/ci.yml`

**Approach:**

- 三个并行 job：`lint-typecheck`、`test`（后端 unit + 前端 unit）、`build`
- 使用 `pnpm/action-setup@v4` 安装 pnpm；cache key: `pnpm.${{ hashFiles('pnpm-lock.yaml') }}`
- Node 20 LTS
- W1 的 `test` job 只跑 Vitest 单元测试（Playwright E2E 在 U11 单独 job）

**Technical design:**

```yaml
# 方向性结构（非实现规格）
jobs:
  lint-typecheck:
    steps: [checkout, pnpm, install, lint, typecheck-web, typecheck-api]
  test:
    steps: [checkout, pnpm, install, test-api, test-web]
  build:
    steps: [checkout, pnpm, install, build-web, build-api]
    if: branch == 'main' || startsWith(branch, 'release/')
```

**Patterns to follow:**

- `.harness/ci-pipeline.yaml` 中已有的并行 step 结构作为参考（Harness 版），转译为 GitHub Actions 语法

**Test scenarios:**

- Happy path: PR 推送后三 job 并行触发，全绿后允许合入
- Error path: lint 报错，`lint-typecheck` job 失败，PR 被阻止
- Edge case: 只有 docs 变更（`paths-ignore: ['docs/**']`），CI 跳过

**Verification:**

- 推一个 "hello world" commit 到测试 PR，GitHub Actions 显示三 job 全绿

---

- [x] U4. **NestJS API 骨架**

**Goal:** NestJS 应用可启动，提供 `/health` 接口，接入 Sentry，结构化日志（pino）

**Requirements:** R-W1c

**Dependencies:** U1

**Files:**

- Create: `apps/api/package.json`（@yaemartos/api；deps: @nestjs/core, @nestjs/common, @nestjs/config, nestjs-pino, pino-http, @sentry/nestjs, class-validator, class-transformer, rxjs, reflect-metadata）
- Create: `apps/api/tsconfig.json`（strict: true, experimentalDecorators: true, emitDecoratorMetadata: true）
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/src/main.ts`（bootstrap; port from ConfigService; pino logger; Sentry init）
- Create: `apps/api/src/app.module.ts`（imports: ConfigModule.forRoot global + PrismaModule + LoggerModule）
- Create: `apps/api/src/config/config.module.ts`（ValidationSchema via joi 或 class-validator）
- Create: `apps/api/src/health/health.controller.ts`（GET /health → { status: 'ok', timestamp, version }）
- Create: `apps/api/src/health/health.module.ts`

**Approach:**

- `ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.local' })`
- pino 日志格式：`{ level, time, pid, hostname, msg, ...context }`；dev 环境用 pino-pretty
- Sentry SDK 用 `@sentry/nestjs`，`SentryModule.forRoot()` 接入；DSN 从 ConfigService 读取
- `/health` 不做数据库检查（W1 阶段）；W2 后可升级为 `@nestjs/terminus`

**Patterns to follow:**

- NestJS 官方 ConfigModule 文档模式
- `apps/api/.env.local.example` 中的环境变量命名

**Test scenarios:**

- Happy path: `GET /health` 返回 `{ status: 'ok' }`，HTTP 200
- Happy path: `pnpm dev:api` 启动，控制台输出 pino JSON 格式日志
- Error path: 缺少必填环境变量（如 DATABASE_URL），应用拒绝启动并输出清晰错误
- Integration: Sentry 接到首条 trace（可手动 `Sentry.captureException(new Error('test'))` 触发）

**Verification:**

- `curl http://localhost:4000/health` 返回 200
- Sentry dashboard 中可见首条 trace

---

- [x] U5. **Prisma 初始化 + Docker Compose**

**Goal:** Prisma 接入 Neon，User/Brand 占位表 migration 成功；Docker Compose 一键本地启动

**Requirements:** R-W1d, R-W1e

**Dependencies:** U4

**Files:**

- Create: `apps/api/prisma/schema.prisma`（datasource db + generator client + User + Brand 模型）
- Create: `apps/api/prisma/prisma.config.ts`（Prisma 7+ config，DIRECT_URL 用于 migrate）
- Create: `apps/api/src/database/prisma.service.ts`（继承 PrismaClient，OnModuleInit/Destroy）
- Create: `apps/api/src/database/database.module.ts`（Global module，export PrismaService）
- Create: `docker-compose.yml`（services: postgres:16 + redis:7-alpine + api + web）
- Create: `docker-compose.override.yml`（dev 本地覆盖：DATABASE_URL 指向本地 postgres）

**Approach:**

- W1 schema 仅 User + Brand 两个占位模型（public schema）；W2 建完整运营域 ERD
- `PrismaService` extends PrismaClient；W2 再改造为 `PrismaClientManager`（多租户版）
- Docker Compose 中 api 的 `DATABASE_URL` 指向本地 postgres（无需 Neon 账号也能跑）；个人开发用 `.env.local` 指向 Neon
- `docker-compose.override.yml` 包含 volume mounts 和 dev-only 配置，不提交 secrets

**Technical design:**

```prisma
// 方向性结构（非实现规格）
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  brandId   String
  role      String   @default("operator")
  createdAt DateTime @default(now())
  @@schema("public")
}

model Brand {
  id   String @id
  name String
  slug String @unique
}
```

**Patterns to follow:**

- `docs/solutions/backend-patterns/nestjs-prisma-neon-multitenant-2026-04-30.md` §1 prisma.config.ts 格式

**Test scenarios:**

- Happy path: `npx prisma migrate dev --name init` 成功，User + Brand 表在本地 postgres 创建
- Happy path: `docker-compose up` 启动，api 容器健康检查通过
- Error path: DATABASE_URL 不可达，NestJS 启动时抛出有意义的错误（而非超时无响应）
- Edge case: `npx prisma migrate deploy`（CI 中用）vs `migrate dev`（本地用）行为区别已在 CONTRIBUTING.md 记录

**Verification:**

- `docker-compose up` 后 `docker-compose ps` 显示所有服务健康
- `npx prisma studio`（本地）可看到 User 和 Brand 表

---

- [x] U6. **前端整合：Storybook + next-intl + Sentry**

**Goal:** 在现有 Next.js 原型上补装 Storybook、next-intl 路由预埋、Sentry 前端 SDK

**Requirements:** R-W1f

**Dependencies:** U1

**Files:**

- Create: `apps/web/.storybook/main.ts`（framework: @storybook/nextjs）
- Create: `apps/web/.storybook/preview.ts`（globals CSS import）
- Create: `apps/web/stories/Button.stories.tsx`（复用 shadcn/ui Button 的基础 story）
- Create: `apps/web/stories/Card.stories.tsx`
- Create: `apps/web/messages/en.json`（基础 key-value，如 `{ "common": { "save": "Save", "cancel": "Cancel" } }`）
- Create: `apps/web/messages/es.json`（空 `{}`，占位）
- Create: `apps/web/i18n.ts`（next-intl config）
- Create: `apps/web/middleware.ts`（next-intl 中间件，locale 前缀路由）
- Modify: `apps/web/app/layout.tsx`（包裹 NextIntlClientProvider）
- Modify: `apps/web/package.json`（添加 next-intl、@storybook/nextjs、@sentry/nextjs、vitest、@testing-library/react）

**Approach:**

- Storybook 8 + `@storybook/nextjs`；story 只演示 Button 和 Card，验证设计 token CSS 变量在 Storybook 中渲染正确（amber color 可见）
- next-intl：`/en/...` 路由；W1 只有 EN 翻译，中间件对根路径 `/` 自动重定向到 `/en`
- Sentry：`@sentry/nextjs` 的 `withSentryConfig` wrapper；dev 环境 sampleRate 1.0，生产 0.1
- **不重构**现有原型组件（`components/listing/`、`components/dev/`）——它们在 W4 shell 时统一迁入新路由结构

**Patterns to follow:**

- `apps/web/providers/brand-provider.tsx` 的 Context 模式供 next-intl Provider 参考

**Test scenarios:**

- Happy path: `pnpm --filter @yaemartos/web storybook` 启动，Button story 展示 4 种品牌色主题
- Happy path: `http://localhost:3000/` 自动重定向到 `/en`
- Happy path: `http://localhost:3000/en/listing/prd-001` 正常渲染 Listing Editor
- Edge case: Storybook 中 CSS Custom Properties 正确渲染（`--brand-primary: amber-600`）

**Verification:**

- `pnpm storybook` 启动，浏览器可见 Button/Card stories
- `/en` 路由无 404

---

- [x] U7. **设计 Token 完整性验证**

**Goal:** 确认 4 品牌 CSS 变量 + Tailwind 主题配置覆盖 `docs/ui/A-design-system.md` 全部 token，Storybook 可见

**Requirements:** R-W1g

**Dependencies:** U6

**Files:**

- Modify: `apps/web/app/globals.css`（对照 A-design-system.md，补齐缺失的 `--brand-*` 变量）
- Modify: `apps/web/tailwind.config.ts`（对照 A-design-system.md，补齐 fontSize / spacing / borderRadius token）
- Create: `apps/web/stories/BrandTokens.stories.tsx`（色板展示 story，4 品牌并排）

**Approach:**

- 逐行对照 `docs/ui/A-design-system.md` §1-§4，确认 `globals.css` 中每个 `[data-brand="*"]` selector 都有对应变量
- Tailwind extend 中需有：`colors.brand.*`（primary/light/dark/accent/bg/surface）、`fontFamily.sans`、`borderRadius`、`boxShadow`
- BrandTokens story 用 `data-brand` 切换展示 4 套色板

**Patterns to follow:**

- `apps/web/app/globals.css` 现有 `:root` + `[data-brand="*"]` 结构

**Test scenarios:**

- Happy path: BrandTokens story 展示 4 品牌色板，amber/emerald/zinc/blue 一目了然
- Edge case: 切换 `data-brand` 属性，无需刷新，颜色立即变化

**Verification:**

- `docs/ui/A-design-system.md` 中每个 CSS Variable 在 `globals.css` 中均有对应定义（人工 diff 检查）

---

- [x] U8. **AI Services 抽象层**

**Goal:** 3 个 service interface 定义 + Gemini 2.5 Pro/Flash provider + `helloWorld()` 单元测试通过

**Requirements:** R-W1h

**Dependencies:** U4, U5

**Files:**

- Create: `apps/api/src/ai/interfaces/listing-generation.interface.ts`（IListingGenerationService）
- Create: `apps/api/src/ai/interfaces/mcp-tool-call.interface.ts`（IMcpToolCallService）
- Create: `apps/api/src/ai/interfaces/structured-extraction.interface.ts`（IStructuredExtractionService）
- Create: `apps/api/src/ai/providers/gemini-listing-generation.service.ts`（实现 IListingGenerationService；`helloWorld(): Promise<string>`）
- Create: `apps/api/src/ai/ai.module.ts`（DI token: LISTING_GENERATION_SERVICE → GeminiListingGenerationService）
- Create: `apps/api/src/ai/providers/gemini-listing-generation.service.spec.ts`（单元测试）
- Modify: `apps/api/src/app.module.ts`（import AiModule）

**Approach:**

- `IListingGenerationService` 包含：`helloWorld(): Promise<string>`（W1）、`generateListing(input: GenerateListingInput): Promise<ListingContent>`（接口定义，W9 实现）
- Vercel AI SDK：`import { generateText } from 'ai'; import { google } from '@ai-sdk/google'`
- `helloWorld()` 调 `gemini-2.5-flash`，prompt `"Say: Hello yaemartOS"`，返回模型回复
- DI token 使用 symbol：`export const LISTING_GENERATION_SERVICE = Symbol('LISTING_GENERATION_SERVICE')`
- 单元测试 mock Vercel AI SDK，不发真实 HTTP 请求

**Technical design:**

```typescript
// 方向性接口结构（非实现规格）
interface IListingGenerationService {
  helloWorld(): Promise<string>;
  generateListing(input: GenerateListingInput): Promise<ListingContent>; // W9 实现
}

// GenerateListingInput 在 packages/shared-types 中定义
// W1 只需 helloWorld() 有实现，generateListing() 可 throw NotImplementedException
```

**Patterns to follow:**

- NestJS DI token 模式（symbol token + useClass）
- Vercel AI SDK `generateText` API

**Test scenarios:**

- Happy path: `helloWorld()` mock 返回 `"Hello yaemartOS"`，断言返回字符串包含 "yaemartOS"
- Error path: Gemini API Key 无效，`generateText` 抛出错误，service 应将其包装为 `AiServiceException` 再 rethrow
- Edge case: `generateListing()` 在 W1 抛出 `NotImplementedException`，单元测试验证该行为

**Verification:**

- `pnpm --filter @yaemartos/api test` 绿
- `IListingGenerationService` 接口 TypeScript 编译无错误

---

- [x] U9. **Cloudinary 集成**

**Goal:** 后端上传 API + 前端展示组件；上传 1 张图成功，CDN URL 可访问

**Requirements:** R-W1i

**Dependencies:** U4

**Files:**

- Create: `apps/api/src/cloudinary/cloudinary.module.ts`
- Create: `apps/api/src/cloudinary/cloudinary.service.ts`（upload 方法：接受 buffer/stream，返回 secure_url）
- Create: `apps/api/src/cloudinary/upload.controller.ts`（POST /upload，multipart/form-data）
- Create: `apps/web/components/common/cloud-image.tsx`（包装 next/image，src 接受 Cloudinary URL）
- Modify: `apps/api/src/app.module.ts`（import CloudinaryModule）

**Approach:**

- 后端用 `cloudinary` npm package（v2）；`CloudinaryService.upload(file)` 上传到 `yaemartos/{brand}/` 文件夹
- 文件夹命名：`brand` 从请求 header 或 body 读取，W1 先固定 `homtone`
- 前端 `CloudImage` 组件：Cloudinary URL → next/image（自动 CDN 优化）
- 文件大小限制：10MB；允许格式：jpg/png/webp/gif

**Test scenarios:**

- Happy path: 通过 `curl -F file=@test.jpg http://localhost:4000/upload`，返回 `{ url: 'https://res.cloudinary.com/...' }`，URL 可访问
- Error path: 上传超过 10MB 文件，返回 400 + 清晰错误信息
- Error path: 上传非图片文件（.txt），返回 400

**Verification:**

- 上传 1 张测试图片，CDN URL 在浏览器中打开，图片可见

---

- [x] U10. **指标基础设施**

**Goal:** Postgres `metrics` 表 DDL 入库；k6 hello-world 脚本跑通；Sentry dashboard 首条 trace 确认

**Requirements:** R-W1j

**Dependencies:** U4, U5

**Files:**

- Create: `apps/api/prisma/migrations/[timestamp]_add_metrics_table/migration.sql`（metrics 表 DDL）
- Modify: `apps/api/prisma/schema.prisma`（添加 Metric 模型）
- Create: `scripts/k6/health-smoke.js`（k6 脚本：50 VU × 30s，GET /health，threshold: p99 < 800ms, error_rate < 0.001）
- Create: `scripts/k6/README.md`（如何本地运行 k6）

**Approach:**

- `metrics` 表字段：`id`, `name`（指标名如 M-02）, `value`（numeric）, `unit`, `brand_id`, `recorded_at`
- k6 脚本 W1 只做 `/health` 压测骨架，M-01 baseline 数值在 D5 实测后填入 CONTRIBUTING.md
- Sentry trace 通过 `nestjs-pino` + Sentry performance 自动捕获（无需手动 instrumentation）

**Test scenarios:**

- Happy path: `npx prisma migrate dev` 后，`metrics` 表可在 prisma studio 中看到
- Happy path: `k6 run scripts/k6/health-smoke.js`，输出 p99 < 800ms，脚本返回 exit 0
- Edge case: k6 threshold 失败（p99 > 800ms），脚本返回 exit 1（CI 可用）

**Verification:**

- `metrics` 表存在于本地 postgres
- k6 脚本跑通并输出 summary
- Sentry dashboard 可见 `/health` 的 performance trace

---

- [x] U11. **Playwright E2E 框架 + 冒烟用例**

**Goal:** Playwright 初始化；1 条端到端冒烟用例（前端 → 后端 /health）在 CI 中通过

**Requirements:** R-W1k

**Dependencies:** U3, U4, U6

**Files:**

- Create: `playwright.config.ts`（根目录；baseURL: http://localhost:3000；webServer: 启动 web + api）
- Create: `tests/e2e/health-smoke.spec.ts`（导航到 /en，页面标题不为空；调 /api/health 返回 200）
- Modify: `.github/workflows/ci.yml`（添加 `e2e` job：在 test job 后运行，需要本地 postgres + api + web 环境）

**Approach:**

- Playwright 配置 `webServer` 数组：先启动 api（等 /health 返回 200），再启动 web
- E2E job 在 CI 中用 `services: postgres:16`（本地，不用 Neon）
- W1 只有 1 条冒烟用例，不写完整功能测试（W9+ Listing Editor 有完整 E2E）

**Test scenarios:**

- Happy path: `npx playwright test tests/e2e/health-smoke.spec.ts` 通过
- Happy path: CI e2e job 绿
- Error path: api 未启动时 Playwright webServer 等待超时（60s），测试失败并输出原因

**Verification:**

- CI 中 e2e job 绿色通过
- `npx playwright show-report` 截图无报错

---

- [x] U12. **ADR-002 + README + CONTRIBUTING + W1 复盘模板**

**Goal:** ADR-002（分支策略）入库；README 可指导新人 5 分钟上手；CONTRIBUTING 覆盖 commit 规范 + 测试覆盖率门槛

**Requirements:** R-W1l

**Dependencies:** U1, U2, U3

**Files:**

- Create: `docs/adr/ADR-002-branching-strategy.md`（trunk-based development + feature flags；分支命名 feat/fix/chore/release）
- Modify: `README.md`（架构概述 + 本地启动步骤 + 开发规范链接）
- Create: `CONTRIBUTING.md`（commit 规范；PR 规范；测试覆盖率：unit ≥ 70%，E2E 覆盖核心路径）
- Create: `docs/retrospectives/W1-retro-template.md`（D5 PM-1 复盘文档模板）

**Approach:**

- ADR-002 分支策略：main 为保护分支，feature 分支 `feat/[issue-num]-[short-desc]`，PR 至少 1 人 review
- CONTRIBUTING 测试覆盖率门槛：unit test ≥ 70%（Vitest）；E2E 覆盖：登录、创建产品、生成 Listing、保存版本 4 条核心路径（S1 末前补齐）
- W1 复盘模板包含：完成了什么、卡在哪里（超过 4h 的项）、W2 风险、W2 排期调整

**Test scenarios:**

- Test expectation: none — 文档单元，无逻辑可自动测试
- 人工验收：新开一个空目录，按 README 步骤操作，15 分钟内完成 `docker-compose up` + 首次 `pnpm dev`

**Verification:**

- `docs/adr/ADR-002-branching-strategy.md` 入库
- CONTRIBUTING.md 中有明确的测试覆盖率数字

---

## System-Wide Impact

- **Interaction graph:** CI job 依赖 pnpm workspace 构建；E2E 依赖 api + web 同时运行；Sentry 依赖 DSN 环境变量
- **Error propagation:** NestJS 全局异常过滤器（W1 用默认）；所有未捕获异常通过 Sentry 上报
- **State lifecycle risks:** Docker Compose postgres volume 重建会清空数据；`.env.local` 中 Neon 直连 URL 不得提交 git
- **API surface parity:** `/health` 接口在 CI E2E、k6、Playwright 三处引用，返回格式需稳定
- **Integration coverage:** D5 冒烟测试需前端 + 后端 + Cloudinary + AI 全链路；仅 unit test 无法覆盖
- **Unchanged invariants:** 现有 `apps/web` 原型组件不被修改；`docs/` 所有文档不被修改（只新增）

---

## Risks & Dependencies

| 风险                                           | 缓解措施                                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Gemini API Key 未到位                          | helloWorld() 先 mock；真实 key 到位后改为实际调用。U8 单元测试用 mock，不阻塞 CI              |
| Neon 账号未创建（R5 未完成）                   | Docker Compose postgres 作为本地 fallback；`DATABASE_URL` 指向本地容器，开发不受阻            |
| Storybook 8 + Next.js 14 兼容问题              | 优先尝试 `@storybook/nextjs` 8.x；如有 peer dep 冲突，fallback 到 `@storybook/react-webpack5` |
| pnpm workspace 与 NestJS reflect-metadata 冲突 | `.npmrc` 添加 `shamefully-hoist=true`；这是 NestJS monorepo 的已知解法                        |
| D5 冒烟无法全链路通（某 service 未完成）       | D5 AM-1 优先 debug 阻塞项；PM-2 记录未完成项入 W2 backlog                                     |
| Husky / lint-staged 在 Windows 环境报错        | team 全为 macOS，暂不处理；若 CI Linux 环境出问题，使用 `npx --no -- commitlint` 替代         |

---

## Documentation / Operational Notes

- `docs/adr/ADR-001-tech-stack.md` 决策日期在 D1 PM-1 后填写（当前为空白）
- `.env.local.example` 中所有占位符必须在 CONTRIBUTING.md 中有说明（哪里获取 key）
- Neon 数据库 branching CI（每 PR 独立 DB）推迟到 W2——见 `docs/solutions/backend-patterns/nestjs-prisma-neon-multitenant-2026-04-30.md` §6.2，W2 补入 `.github/workflows/preview.yml`

---

## Sources & References

- **Origin document:** [docs/brainstorms/pre-implementation-readiness-requirements.md](docs/brainstorms/pre-implementation-readiness-requirements.md)
- **Implementation plan:** [docs/yaemartOS-implementation-plan.md](docs/yaemartOS-implementation-plan.md) §6 W1
- **Multi-tenant backend guide:** [docs/solutions/backend-patterns/nestjs-prisma-neon-multitenant-2026-04-30.md](docs/solutions/backend-patterns/nestjs-prisma-neon-multitenant-2026-04-30.md)
- **Design system:** [docs/ui/A-design-system.md](docs/ui/A-design-system.md)
- **ADR-001:** [docs/adr/ADR-001-tech-stack.md](docs/adr/ADR-001-tech-stack.md)
- **ERD:** [docs/erd/domain-model.md](docs/erd/domain-model.md)
