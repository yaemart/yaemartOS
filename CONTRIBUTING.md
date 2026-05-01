# Contributing

## 前置条件

- Node.js ≥ 20
- pnpm ≥ 10（见根目录 `packageManager`）

## 提交约定

使用 [Conventional Commits](https://www.conventionalcommits.org/)，例如 `feat(api): add upload endpoint`。根目录已配置 **Husky + commitlint**，不合规的提交信息会被拒绝。

## 数据库迁移

- **本地开发**：在 `apps/api` 下使用 `pnpm exec prisma migrate dev`（需配置 `DIRECT_URL`）。
- **CI / 部署**：使用 `pnpm exec prisma migrate deploy`。
- Prisma 7 使用仓库根相对路径的 `apps/api/prisma.config.ts`，CLI 通过 **`DIRECT_URL`**（直连）执行 migrate；应用运行时通常使用 Neon **`DATABASE_URL`**（pooler）。
- W2 多租户客户域迁移：`pnpm --filter @yaemartos/api run db:migrate:all-tenants`（按 `homtone/spoonlemon/davivy/tysun` 循环建表）。
- W3 IAM 基础依赖：请在 `.env.local` 配置 `JWT_SECRET` 与 Google/Facebook OAuth 回调参数（见 `apps/api/.env.local.example`）。

## Preview Workflow 变量

- 必填 GitHub **Variables**：`NEON_PROJECT_ID`, `GOOGLE_CALLBACK_URL`, `FACEBOOK_CALLBACK_URL`
- 必填 GitHub **Secrets**：`NEON_API_KEY`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`

## W4 E2E 必跑项

W4 引入的 e2e 测试在 `tests/e2e/w4-*.spec.ts`，覆盖：

- `w4-auth-admin`：未认证 401、登录失败、admin 页面加载、403 页面
- `w4-permission-guard`：IAM capabilities 鉴权
- `w4-brand-switch`：非法 brand 400、品牌切换正确性
- `w4-es-health`：ES 健康状态接入

失败排查入口：

1. 确认 `apps/api/.env.local` 包含 `JWT_SECRET` 和 `ELASTICSEARCH_URL`
2. 确认 `docker compose up -d postgres redis elasticsearch` 全部 healthy
3. 确认 `prisma migrate deploy` 和 `db:migrate:all-tenants` 已执行

## PR 前自检

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e   # 需要本地 API + Web + Postgres + ES 可用
```

涉及 UI 或路由时建议补充/更新 Playwright 冒烟或手动验证 `pnpm dev` 全链路。

## 代码风格

- ESLint 扁平配置：`eslint.config.mjs`（继承 `@yaemartos/eslint-config` + `typescript-eslint`）。
- Prettier：`.prettierrc`。
- 大型前端原型迭代可在后续切片统一收紧 `@typescript-eslint/no-unused-vars` 等规则。
