# yaemartOS — S1 W1 D1 启动 Checklist

> 单页执行清单。打印或加书签，开发期间逐项勾选。  
> 来源：`docs/yaemartOS-implementation-plan.md` §17.3 / §6 W1。  
> 适用：v2.0-RC 6 方签字完成后。

---

## 0. 进入 W1 的前置条件（必读）

- [ ] `docs/yaemartOS-implementation-plan.md` 文件首行版本号已从 `v2.0-RC` 改为 `v2.0 GA`
- [ ] §17.6 签字行 6 个角色全部签字日期已填
- [ ] 下方 D-1 全部完成，否则**禁止启动 W1 D1**

---

## 1. D-1 行政准备（W1 之前一周完成）

> 没有这些密钥/账号，W1 D1 第一行代码都写不了。

### 仓库与权限

- [ ] GitHub Organization 创建（或确认现有 org 可复用）
- [ ] 私有仓库 `yaemartOS` 创建
- [ ] 2 名开发者获得 Owner / Admin 权限
- [ ] 仓库默认分支 `main`，分支保护：必须 PR + 至少 1 review + CI 绿
- [ ] `.gitignore` 模板（Node / Next.js / IDE）

### 第三方账号

- [ ] **Google Cloud 项目** + Gemini API key
  - [ ] 项目创建：`yaemart-prod` 与 `yaemart-dev` 两个
  - [ ] 启用 `generativelanguage.googleapis.com`
  - [ ] 测试 key 调通 `gemini-2.5-flash`：
    ```bash
    curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$KEY" \
      -H "Content-Type: application/json" \
      -d '{"contents":[{"parts":[{"text":"hello"}]}]}'
    ```
  - [ ] 配额监控告警 80% 阈值
- [ ] **Sentry**（free tier OK）
  - [ ] Org 创建：`yaemartos`
  - [ ] Project 创建：`web` / `api` 两个
  - [ ] DSN 各自记录入 1Password
- [ ] **Cloudinary**（free 25 credit/月）
  - [ ] account 创建
  - [ ] cloud_name / api_key / api_secret 入 1Password
  - [ ] folder 结构预设：`brand/{homtone,spoonlemon,davivy,tysun}/...`
- [ ] **PostgreSQL 托管**（择一）
  - [ ] Neon free tier 0.5GB / 或 Supabase free 500MB / 或 自托管
  - [ ] dev DB + staging DB 各创建一份
  - [ ] 连接 URL 入 1Password
- [ ] **Redis 托管**（择一）
  - [ ] Upstash free 10K req/day / 或 Redis Cloud free 30MB
  - [ ] URL 入 1Password
- [ ] **领星 OpenAPI 凭证**（公司行政流程）
  - [ ] 提交申请单
  - [ ] 收到 app_id / app_secret 入 1Password
  - [ ] 测试账号可调 `/v1/auth` 拿到 token

### 密钥管理

- [ ] 1Password 团队 vault 名称：`yaemartOS-secrets`
- [ ] 双开发者 + tech lead 加入 vault
- [ ] 密钥分组：`gcp/`, `sentry/`, `cloudinary/`, `db/`, `redis/`, `lingxing/`
- [ ] `.env.local.example` 模板提交到仓库（含变量名，无值）

### 本地开发环境

- [ ] Node.js 20 LTS 安装（推荐 fnm/nvm）
- [ ] pnpm 9.x 安装
- [ ] Docker Desktop（用于 docker-compose）
- [ ] VS Code / Cursor 安装；扩展：ESLint / Prettier / Prisma / Tailwind CSS IntelliSense
- [ ] Git 配置：用户名 / 邮箱 / SSH key 加到 GitHub

---

## 2. W1 D1（周一）—— 仓库与 ADR

### AM-1（08:30-10:00）pnpm workspace 初始化

- [ ] `pnpm init` 创建根 `package.json`
- [ ] `pnpm-workspace.yaml`：
  ```yaml
  packages:
    - 'apps/*'
    - 'packages/*'
  ```
- [ ] 创建目录：`apps/web` / `apps/api` / `packages/shared-types` / `packages/eslint-config` / `packages/db`
- [ ] 各 sub-package 的 `package.json` 骨架
- [ ] `pnpm install` 跑通

### AM-2（10:00-12:00）代码规范工具

- [ ] ESLint 9 安装 + `packages/eslint-config` 共享规则
- [ ] Prettier 配置（root + ignore）
- [ ] Husky + lint-staged：pre-commit 跑 lint + prettier + typecheck
- [ ] commitlint：约定式提交（feat/fix/chore/docs/...）
- [ ] 实测：`git commit -m "test"` 被拒绝；`git commit -m "chore: init"` 通过

### PM-1（13:30-15:00）ADR-001 技术选型

- [ ] 创建 `docs/adr/` 目录
- [ ] 写 `docs/adr/ADR-001-tech-stack.md`，锁定 §3 全部决策：
  - 前端：Next.js 14 + Tailwind + shadcn/ui + next-intl
  - 后端：NestJS + Prisma + REST + GraphQL
  - DB：PostgreSQL + Redis + Elasticsearch（v2.0 含）
  - AI：Vercel AI SDK + Gemini Pro/Flash（S1）；S2+ 加 GLM-5
  - IAM：Casbin（7 维度）
  - 文件：Cloudinary
  - 监控：Sentry（S1）+ PostHog（S2）+ Metabase（S3）
  - 队列：BullMQ
- [ ] PR 评审 + 合入 main

### PM-2（15:00-16:00）ADR-002 分支策略

- [ ] 写 `docs/adr/ADR-002-branching.md`：
  - Trunk-based（main 即 trunk）
  - feature/[scope]-[short-desc] 分支
  - feature flag（`unleash` 或自建 DB 表 + `useFlag()` hook）
  - 24h 内可回滚（M-09 基础）
  - PR 至少 1 review + CI 绿才可合并
- [ ] PR 合入

### PM-3（16:00-18:00）README + 第一个 PR

- [ ] `README.md` 骨架：项目简介、快速启动、目录结构、贡献指南
- [ ] `CONTRIBUTING.md`：分支命名、PR 流程、commit 规范、code review 标准
- [ ] **第一个真实 PR 走通完整 CI**（即便只是改 README typo）
- [ ] CI 状态徽章贴到 README

### 16:00 站会（5 分钟）

- [ ] 今日完成项确认
- [ ] 卡点同步
- [ ] 明日 D2 顺序确认

---

## 3. W1 D2-D5

> 详见 `docs/yaemartOS-implementation-plan.md` §6 W1 对应日。

- [ ] D2：GitHub Actions CI + NestJS + Prisma + Sentry + Docker Compose
- [ ] D3：Next.js + Tailwind + shadcn/ui + 设计 token + Storybook + next-intl
- [ ] D4：AI Services 层 + Vercel AI SDK + Gemini + Cloudinary + metrics + k6
- [ ] D5：E2E 冒烟 + Playwright + 复盘 + demo 录屏

---

## 4. 节奏纪律（W1 全周）

- [ ] 每天 16:00 站会 5 分钟（不超过）
- [ ] 任意单项卡 > 4 小时立即 pair（拒绝单干 8 小时撞墙）
- [ ] 周五 PM 录屏 demo 给运营 PM
- [ ] D-1 任一项未完成 → 推迟 W1 启动（禁止凑合开始）

---

## 5. W1 末验收

完成下面全部，W1 通过：

- [ ] 主干 CI 绿（lint + typecheck + test + build）
- [ ] `docker-compose up` 一键启动 dev 全链路
- [ ] Sentry 见到至少 1 条 trace
- [ ] Storybook 至少 2 个 story 可访问
- [ ] `listingGenerationService.helloWorld()` 返回真实 Gemini 响应
- [ ] Cloudinary 上传图片成功 + CDN URL 返回
- [ ] Postgres `metrics` 表 DDL 入库
- [ ] k6 hello-world 跑通
- [ ] Playwright 1 条 E2E 用例 CI 跑通
- [ ] W1 复盘文档入库 `docs/retros/W1.md`
- [ ] 运营 PM 看完 demo 录屏，期望对齐

---

_最后更新：2026-04-30 | 关联文档：`yaemartOS-implementation-plan.md` v2.0-RC_
