# yaemartOS

跨境电商运营系统 monorepo：**Next.js 14（App Router）** + **NestJS** + **PostgreSQL（Neon / 本地 Docker）** + **pnpm workspaces**。

## 快速开始

```bash
pnpm install
cp apps/api/.env.local.example apps/api/.env.local   # 填入 Neon DATABASE_URL / DIRECT_URL + JWT/OAuth 等
```

本地数据库 + Elasticsearch（Docker）：

```bash
docker compose up -d postgres redis elasticsearch
# apps/api/.env.local 中 DATABASE_URL / DIRECT_URL 指向 postgres://postgres:postgres@localhost:5432/yaemartos_dev
cd apps/api && DIRECT_URL=postgresql://postgres:postgres@localhost:5432/yaemartos_dev pnpm exec prisma migrate deploy && pnpm exec prisma generate
cd apps/api && DIRECT_URL=postgresql://postgres:postgres@localhost:5432/yaemartos_dev pnpm run db:migrate:all-tenants
```

并行启动前后端：

```bash
pnpm dev
```

- 前端：<http://localhost:3000>（默认重定向至 `/en`，后台 `/en/dashboard`）
- API：<http://localhost:4000/health>（含 db + search 状态）

### 主要 API 端点

| 端点                     | 说明                           |
| ------------------------ | ------------------------------ |
| `POST /auth/login`       | 邮箱密码登录                   |
| `POST /auth/refresh`     | 刷新 token                     |
| `GET /auth/me`           | 当前用户信息（需 JWT）         |
| `GET /iam/capabilities`  | 当前用户可见能力列表（需 JWT） |
| `GET /search/health`     | ES 健康检查                    |
| `POST /search/bootstrap` | ES index 初始化（需 JWT）      |

### W4 本地联调

1. 确保 `.env.local` 包含 `JWT_SECRET`、`ELASTICSEARCH_URL=http://localhost:9200`
2. 登录：`POST /auth/login`，拿到 accessToken
3. 验证守卫：`GET /auth/me`（带 Bearer token + `x-yaemart-brand` header）
4. 验证权限：`GET /iam/capabilities`
5. 验证搜索底座：`GET /search/health`、`POST /search/bootstrap`

## 脚本

| 命令                                                      | 说明                                             |
| --------------------------------------------------------- | ------------------------------------------------ |
| `pnpm dev`                                                | 并行 `apps/web` + `apps/api`                     |
| `pnpm build`                                              | 构建全部 app                                     |
| `pnpm lint`                                               | ESLint（flat config，仓库根）                    |
| `pnpm typecheck`                                          | TypeScript                                       |
| `pnpm test`                                               | Vitest（api + web）                              |
| `pnpm test:e2e`                                           | Playwright 冒烟（根目录 `playwright.config.ts`） |
| `pnpm storybook`                                          | Storybook（web）                                 |
| `pnpm --filter @yaemartos/api run db:migrate:all-tenants` | 初始化/迁移 4 个 tenant schema                   |

## CI / Preview Secrets

- CI 单测与 E2E 需要 `JWT_SECRET`（OAuth 可用 dummy 值）。
- E2E 会自动拉起 Elasticsearch service container。
- PR Preview（Neon 分支）需配置：
  - GitHub Vars: `NEON_PROJECT_ID`, `GOOGLE_CALLBACK_URL`, `FACEBOOK_CALLBACK_URL`
  - GitHub Secrets: `NEON_API_KEY`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`

## 仓库结构

- `apps/web` — `@yaemartos/web`
- `apps/api` — `@yaemartos/api`（Prisma schema / migrations 在 `apps/api/prisma/`）
- `packages/db` — 多租户数据库工具（tenant 常量、连接串 search_path 构造）
- `packages/shared-types` — 共享类型
- `packages/eslint-config` — ESLint 基础规则
- `docs/` — ADR、实施方案、UI 规范、solutions

详见 `AGENTS.md` 与 `docs/yaemartOS-implementation-plan.md`。
