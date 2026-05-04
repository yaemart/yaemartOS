---
title: 'feat(w49-d2): yaemartOS staging 环境从 0 到 1 部署（E 方案 = Vercel 前端 + VPS Docker Compose API + Neon DB）'
type: feat
status: active
date: 2026-05-04
related:
  [
    'docs/plans/2026-05-04-005-chore-w43-w49-stack-pr-merge-plan.md',
    'docs/W46-W52-checklist.md',
    'docs/runbooks/w49-staging-smoke-chat-tool.md',
    'docs/yaemartOS-implementation-plan.md',
  ]
---

# W49 D2 → D4：staging 环境从 0 到 1 部署 + cron 真正解锁

## Overview

W49 D1 push 的 staging-smoke.yml + smoke-chat-tool.ts 是"工具先就位、等 staging 部署完跑得通"的设计。W49 D2 22:30+ 完成两轮 hotfix（F-8 + F-19）把 silent-failure 通道清干净后，第 3 次 manual trigger 暴露：**仓库里没有任何 staging 部署的物理痕迹**——`https://staging-api.yaemartos.com` / `https://staging.yaemartos.com` 这些 URL 目前不存在。

本 plan 记录采纳的 **E 方案**（Vercel 前端 + VPS Docker Compose API + Neon DB + 渐进式后端演进）的完整起手计划，覆盖从今晚（D2 22:55+）到 D3 / D4 的执行节奏，目标是 D4 末完成 staging 部署 + 第 4 次 manual trigger ✅，cron 真正解锁。

E 方案的核心是 **18 个月不重写代码的渐进式演进路径**：

| 阶段             | 时间窗      | 前端           | API                          | DB          | 月成本预估 |
| ---------------- | ----------- | -------------- | ---------------------------- | ----------- | ---------- |
| **W49-W52**      | 4 周        | Vercel Preview | Hetzner CX22 docker-compose  | Neon free   | ~€10       |
| **S2 末（W26）** | prod 上线   | Vercel Prod    | Hetzner CPX31 docker-compose | Neon Launch | ~€60       |
| **S3-S4**        | prod 增强期 | Vercel Prod    | multi-VPS docker-compose     | Neon Launch | ~€100      |
| **S5+ W53+**     | prod 终态   | Vercel Prod    | Managed K8s（GKE/DOKS）      | Neon Scale  | ~€200      |

E 方案的成立依赖三个硬约束（见 §Context & Research）：① W48-W49 chat tool calling 的 SSE / streamText 长连接（30-90s）→ 否决任何 serverless API；② plan L504 Lingxing API IP 白名单 5 IP → API 出口必须固定；③ plan §3 v1.4 "避免 day 1 over-engineer" → 不上 K8s。

本 plan 是**双日跨度**（D3-D4）执行 plan，medium depth。**今晚 D2 22:55+ 不动代码、不改基础设施**，仅记录计划与决策，明天 D3 起开始执行 U1-U7。

---

## Problem Frame

### 当前状态（W49 D2 23:00 UTC+9 截止）

✅ **已完成的**：

- `.github/workflows/staging-smoke.yml` 在 main，cron schedule 0 1 \* \* 1 + workflow_dispatch 都已生效
- `scripts/staging/smoke-chat-tool.ts` 在 main，F-19 hotfix 后 config-missing 路径写正常 JSON 报告
- W49 D2 manual trigger #1 / #2 / #3 全部完成，hotfix 链路验证：
  - #1（hotfix 前）：25s ✅ false success（F-8 silent failure，已修于 commit `e3cb609`）
  - #2（F-8 hotfix 后）：24s ❌ true failure，artifact 0 字节（F-19 暴露，已修于 commit `5264fee`）
  - #3（F-19 hotfix 后）：~25s ❌ true failure，artifact JSON 含 2 条 `Missing required env: STAGING_*` ✅
- F-8 + F-19 + dead-test vitest config 三处 silent-failure 通道全清

❌ **仓库现状证据（缺失）**：

| 检查项                                                         | 结果                                    |
| -------------------------------------------------------------- | --------------------------------------- |
| `docker-compose.staging.yml`                                   | ❌ 不存在                               |
| `.env.staging` / `.env.production`                             | ❌ 只有 `.env.local.example`            |
| `k8s/` / `helm/` / `kubernetes/`                               | ❌ 整个目录不存在                       |
| `Dockerfile.staging` / `Dockerfile.prod`                       | ❌ 只有 `Dockerfile.dev`                |
| `vercel.json` / `fly.toml` / `render.yaml` / `railway.json`    | ❌ 任何 PaaS 配置都没有                 |
| `.github/workflows/preview.yml`                                | ⚠️ 存在但 disabled（NEON_API_KEY 未配） |
| `.github/workflows/deploy.yml` / `staging-deploy.yml`          | ❌ 不存在                               |
| `staging-api.yaemartos.com` / `staging.yaemartos.com` DNS 记录 | ❌ 域名暂无 staging 子域名（待确认）    |
| Hetzner / DigitalOcean / 阿里云 / Vercel staging 项目          | ❌ 暂无可证明已部署的资源（待用户确认） |

⏳ **W49 D2 hotfix 解锁但 staging 缺失阻塞的事项**：

- W49 P1-B-mod-v2 cron 自动跑（设计目标：周一 09:00 PRC 起每周一次）
- W49 D5 7 天观测窗口（依赖 cron 至少 1 次成功 trigger 累积数据）
- W50 spoonlemon 上线判定（依赖 homtone smoke 周观测数据）
- ADR-013（Cookie → Service Token 决策草稿）依赖 staging 环境验证

### 为什么这是 W49 D2 而不是 W1 D1 解决的

W1 D1 ready check（plan §13 L385）确实写了 "dev/staging Docker Compose"，但 W1-W42 期间 staging 部署任务被隐性延期了 42 周。可能的原因：

1. dev 环境（docker-compose 本地）能跑通绝大部分功能，staging 缺失的痛感不强
2. W43-W48 都聚焦 W43-W45 ad suggestion gate / W46-W47 SSE realtime / W48 chat tool calling 三个业务带，CI 跑通就当作"够用"
3. staging-smoke 工具的设计（W48 末/W49 D1）让团队产生"工具搭好等 staging 自然来"的错觉
4. plan §13 L385 的 staging Docker Compose 是"按团队运维能力选择"的可选项，没排实际工时

W49 D2 hotfix 流程意外把这个 plan 对账缺口逼出来。**这不是 W49 D2 的失败，是把 staging 部署从隐性 backlog 变成显性优先级的契机**。

### 替代方案被否决的理由

| 候选           | 否决理由                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------- |
| 不部署 staging | cron 永远跑不通，W49 P1-B-mod-v2 设计的 7 天观测门禁失效；W50 上线判定盲飞                          |
| 假填 secrets   | 每周一 cron ❌ + Slack 告警噪音，伤害团队对告警的敏感度（W49 D2 cron 解锁的 trust 资产）            |
| 直接上 K8s     | 反 plan §3 v1.4，D2 当晚学习成本不可承受；S5 才是 K8s 合适窗口                                      |
| Vercel 整体    | API SSE / streamText 长响应（30-90s）超 Vercel function 60s 上限，致命阻碍                          |
| Railway 整体   | Lingxing IP 白名单 5 IP 约束（plan L504）—— Railway 出口 IP 漂移，需 dedicated proxy 解决，加复杂度 |

E 方案是 **同时满足 SSE + IP 白名单 + 反 over-engineer + plan 契合 + 低成本** 的唯一解。

---

## Requirements Trace

- **R1**：staging 前端（apps/web + apps/portal）通过 Vercel 部署，每个 app 一个独立 Vercel project，`staging` 分支或 PR preview 自动 deploy；域名 `staging.yaemartos.com` / `staging-portal.yaemartos.com`（具体子域名 D3 决定）。
- **R2**：staging API（apps/api NestJS）通过 Hetzner CX22（首选）或 DigitalOcean Singapore Basic Droplet（备选）跑 docker-compose，Caddy 反代 + Let's Encrypt SSL，域名 `staging-api.yaemartos.com`。
- **R3**：staging 数据库使用 Neon Postgres staging branch（独立于 prod main branch，可随时 reset）；`pnpm db:migrate:all-tenants` 跑通 4 品牌 schema。
- **R4**：API 出口 IPv4 提交到 Lingxing 白名单（5 IP 限额内，staging + prod 起步共占 2 IP，预留 3 个给 prod 扩容）。
- **R5**：6 个 GitHub repository secrets 配齐（STAGING_API_BASE / STAGING_ADMIN_TOKEN / STAGING_CUSTOMER_TOKEN / STAGING_DASHBOARD_URL / STAGING_DASHBOARD_COOKIE / SLACK_WEBHOOK_URL），manual trigger #4 全绿（exitCode=0 + metricDeltas['chat.session.with_tools_count'] ≥ 1）。
- **R6**：GitHub Actions `deploy.yml` workflow，监听 `main` push，SSH 到 staging VPS 执行 `git pull && docker compose pull && docker compose up -d`；deploy 成功后自动跑 health check + 失败时 Slack 通知。
- **R7**：W49 leadership-sync.md / W46-W52-checklist.md / staging-smoke-runbook.md 同步反映 staging 已就绪 + cron 真正解锁状态；institutional learning 沉淀到 `docs/solutions/infrastructure/2026-05-W49-staging-bootstrap.md`。

---

## Scope Boundaries

### In Scope（D3-D4 完成）

- Vercel 前端 staging 部署（web + portal）
- Hetzner / DO VPS 选型 + 创建 + DNS + Caddy + docker-compose.staging.yml
- Neon staging branch 创建 + migrate + seed
- Lingxing IP 白名单提交（如需走运营审批，至少今天发起）
- 6 个 GitHub secrets 配置
- staging-smoke manual trigger #4 验证全绿
- GitHub Actions deploy.yml（最小可用）
- 文档同步（leadership-sync / W46-W52-checklist / runbook）

### Out of Scope（不在本 plan 内）

- prod 环境部署（S2 末 W26 起手，独立 plan）
- multi-VPS 拆分（S3-S4 起手）
- K8s 迁移（S5+ 起手）
- staging Elasticsearch 单独 cluster（W49 暂用 docker-compose 单节点 ES，prod 起再考虑 ES Cloud）
- staging 完整 CI/CD（preview.yml 重启、Neon API key、ArgoCD-style GitOps）—— 仅做最小 deploy.yml
- staging 监控（Prometheus / Grafana / Sentry）—— W50/S2 起再加
- 备份策略（pg_dump cron + rclone 推 Storage Box）—— D4 末仅做手工备份脚本，自动化推到 W50

### Deferred to Follow-Up Work

- **prod 环境**：W26 上线时基于本 staging 经验扩到 CPX31，独立 plan
- **Vercel 4 品牌独立部署**：W26 起按 brand 拆 Vercel project，4 个 production target
- **Lingxing 白名单全队同步**：D4 末由用户负责把 staging IP 加入运营审批流程（外部依赖，本 plan 仅起头）

---

## Context & Research

### 仓库证据（hard facts）

完整证据链见 §Problem Frame 表，关键引用：

- `implementation-plan.md` L129：`部署 = Docker Compose（dev）→ K8s 或托管 PaaS（staging/prod），按团队运维能力选择`
- `implementation-plan.md` L385：`dev/staging Docker Compose；结构化日志 + /health` 作为 W1 D1 ready check
- `implementation-plan.md` L504：`领星 API 凭证（IP 白名单 5 IP）` 作为 W2 末验收点
- `runbook docs/runbooks/w49-staging-smoke-chat-tool.md` L30-49：5 个 staging secrets 的命名约定 + `gh secret set` 命令模板
- `.github/workflows/preview.yml` L3-7：自我描述 "Disabled until NEON_API_KEY and NEON_PROJECT_ID are configured" → 即 Neon 集成已设计但未启用

### 三个硬约束（决策 forcing function）

#### 约束 A: SSE / streamText 长连接

W48-W49 客服 chat tool calling 调用 Gemini 2.5 Pro，单次响应 30-90s（worst case），且必须保持 SSE 连接到客户端流式输出。

- ❌ Vercel function：Free tier 10s / Pro 60s 超时硬上限
- ❌ Cloudflare Workers：CPU time 30s 上限
- ❌ AWS Lambda + API Gateway：30s 上限
- ✅ long-running container（VPS Docker / Railway / Fly / K8s）：无超时

#### 约束 B: Lingxing API IP 白名单 5 IP（plan L504）

领星开放平台的反爬限制：单租户最多 5 个出口 IP 加入白名单，超出请求会 403。yaemartOS 调用频次（多 brand × 多 shop × 库存/订单/listing 多接口）必须固定出口 IP。

- ❌ Railway / Render / Fly.io：默认出口 IP 漂移（除非 paid dedicated IPv4）
- ❌ Vercel function：IP 漂移，无 dedicated 选项（除非 Enterprise）
- ✅ VPS：每台 1 个固定 IPv4
- ✅ K8s + Cloud NAT：单 NAT IP，多节点共享
- ⚠️ 5 IP 分配建议：staging 1 + prod 起步 1 + S3-S4 multi-VPS 2 + S5 K8s NAT 1 = 5 IP 紧贴上限，需要节约使用

#### 约束 C: plan §3 v1.4 "避免 day 1 over-engineer"

- 否决 day 1 K8s（学习成本 5-10 人日 + 运维成本月 $50-150）
- 否决 day 1 复杂可观测性栈（Prom/Grafana/Loki）—— 先用 docker logs + Caddy access log
- 否决 day 1 多 region 部署 —— 单 region 起步

### 关键技术栈契合

- **plan AI SDK 是 Vercel AI SDK**：前端在 Vercel 是一等公民，streaming 体验最顺
- **plan DB 候选 Neon**：preview.yml 已预设 Neon 集成，复用最自然
- **plan Cloudinary**：图片在 Cloudinary 不占 VPS 磁盘，简化备份
- **plan Casbin**：纯 NestJS 内嵌，无外部依赖

### 仓库 git 状态（D2 23:00）

```
On branch main
Your branch is up to date with 'origin/main' at 5264fee
Working tree clean
```

D2 hotfix 全部 push 完成，本 plan 文档是当前唯一 working tree 改动（不立即 commit，等待用户审阅）。

---

## Key Technical Decisions

### D1: 选 Hetzner CX22（FSN1 德国）作为 staging VPS

**Why**：

- 价格 €5.83/月，4 vCPU + 8GB RAM + 80GB SSD，比 DO Basic ($12) / Linode Nanode ($5 但只 1 vCPU + 1GB) 性价比好 2-3x
- FSN1 德国到 PRC 直连尚可（200-300ms RTT，传统中欧线路），运营团队 SSH/dashboard 可接受
- Hetzner Storage Box €3.81/月 配套用 rclone 推备份，与 VPS 同账户简化运维
- 固定 IPv4，符合 Lingxing 白名单
- 月底费用 ~€10，最低预算

**备选**：DO Singapore Basic ($12/月) — 如 PRC 团队对 FSN1 延迟敏感，Singapore 更近（80-120ms RTT），但贵 2x。**D3 U2 由用户决定（默认 Hetzner）**。

### D2: 选 Vercel 作为前端 staging 部署平台

**Why**：

- Next.js 14 App Router + Vercel AI SDK 是 Vercel 一等公民
- Free tier（Hobby）单人 / 小团队够用；如需要团队共享，升 Pro $20/seat
- preview deployment 自动给每个 PR 一个 URL，DX 顶级
- staging.yaemartos.com 子域名一行 DNS 配置即可
- 与 plan §3 AI SDK 决策天然契合

**备选**：Cloudflare Pages — 价格更激进（pages 无限免费），但 Next.js SSR 在 CF Pages 仍有兼容性边角问题（middleware 限制、Node.js API 限制）；W49 不冒险。

### D3: API 同时部署到 staging VPS（不只是数据库迁移）

**Why**：

- 即使 staging 流量极小，也要让 staging-api.yaemartos.com 能真正接受 chat 请求 + 跑 streamText
- W49 staging-smoke-chat-tool.ts 是 end-to-end smoke，需要真实 API + 真实 DB + 真实 LLM 调用
- 如果只迁数据库（Neon）不部署 API，smoke 还是 fail（fetch ENOTFOUND）

### D4: Neon Postgres staging branch（不自建 Postgres）

**Why**：

- preview.yml 已经预留 Neon 集成
- Neon branch 的 copy-on-write 能 5 秒钟克隆 prod schema 到 staging，重置成本极低
- Free tier 0.5 GB 存储 + 100 小时计算时间 staging 够用
- 18 月演进路径：staging Free → S2 prod Launch ($19) → S5 prod Scale ($69)，无需迁移

**反对理由**：Neon 出 region（默认 us-west-2），到 staging VPS（FSN1 德国）跨大西洋延迟 100ms+ — 但 staging 流量小，可接受；prod 起手时考虑 Neon eu-west region。

### D5: deploy 走 GitHub Actions SSH，不走 Watchtower / Portainer 等自动化工具

**Why**：

- 最简单 = 最少错误面
- staging 单 VPS，SSH 部署 1 行命令搞定
- 与团队现有 GitHub Actions 工作流一致（CI / staging-smoke 都在那里）
- W50 后再看是否升级到 Watchtower / Portainer

### D6: 不在 staging 复刻 prod 的 ES 3 节点集群

**Why**：

- plan §10 明确写 "ES（dev 单节点，staging 3 节点）" — 这是 prod 才需要的
- staging 流量小，1 节点够，节省 RAM
- W49 chat tool calling 不依赖 ES 重度查询（更多依赖 Postgres FTS）
- prod 起手时再决定是否上 3 节点（基于实际流量 P95 latency）

**风险**：staging 与 prod 行为可能在 ES 边角不一致 → 验收时显式标记 "ES 行为差异是已知 staging-prod gap"

### D7: 不在 staging 部署 monitoring stack（Prometheus/Grafana/Loki）

**Why**：

- 反 over-engineer
- W49 alpha 流量极小，Caddy access log + docker logs 足够
- W50 决定是否加 Sentry 免费层（前端错误追踪即可）

---

## Open Questions

### Resolved During Planning

- **Vercel staging 域名是 `staging.yaemartos.com` 还是 PR preview URL？** → 取 `staging.yaemartos.com` 作为稳定 staging 入口（绑到 main 分支的 Vercel deployment），PR preview URL 作为 ephemeral 用于 review
- **API 域名是 `staging-api.yaemartos.com` 还是 `api.staging.yaemartos.com`？** → 用前者（短，与 prod `api.yaemartos.com` 对称）
- **Caddy 还是 Nginx？** → Caddy（自动 SSL、配置文件简洁、JSON API 可热重载）
- **是否在 docker-compose 里跑 Postgres？** → 否，DB 走 Neon。docker-compose 只跑 NestJS API + Redis + ES + Caddy
- **Storage Box 备份频率？** → D4 不自动化，先建脚手架；W50 加 cron daily

### Deferred to Implementation

- **Hetzner vs DO Singapore**：D3 U2 用户决定，默认 Hetzner FSN1
- **Vercel team plan vs Hobby**：当前 W49 单人开发足够 Hobby；如团队 W50 加人，升 Pro，本 plan 不强求
- **Lingxing 白名单提交流程**：用户对接领星运营，本 plan 不规定具体 ticket 格式；预期 1-3 工作日审批
- **staging admin / customer JWT 怎么 mint**：U6 时如果项目没现成 mint 脚本，临时在 staging 后台 UI 登录抓 cookie，W50 再加 `scripts/admin/mint-staging-jwt.ts`
- **NextAuth session cookie 提取**：U6 时手动从 Chrome DevTools 抓，与 F-9（cookie 30 天过期）合并到 W50 P2-D 长期方案

---

## Implementation Units

> **执行节奏建议**：D3 上午 U1-U3（Vercel + VPS + compose），D3 下午 U4-U5（Neon + Lingxing），D4 上午 U6（secrets + manual trigger #4），D4 下午 U7（deploy.yml + 文档）+ U8（验收）。

### U1. Vercel 前端 staging 部署（apps/web + apps/portal）

**Goal**：在 Vercel 创建 2 个 project，分别 link 到 `apps/web` 和 `apps/portal`，绑定 staging.yaemartos.com / staging-portal.yaemartos.com 子域名。

**Requirements**：R1（Vercel staging 部署）

**Dependencies**：无（Vercel 不依赖 VPS）

**Files**：

- `apps/web/vercel.json`（新建，配 buildCommand / outputDirectory / framework）
- `apps/portal/vercel.json`（新建）
- `.vercel/project.json` × 2（Vercel CLI 自动生成）
- 不改其他文件

**Approach**：

1. 注册或登录 Vercel 账号（用户已有账号则跳过）
2. `npx vercel login` 在本地 link 账号
3. `cd apps/web && npx vercel --confirm`
   - Vercel 会自动检测 Next.js 14 App Router
   - 选择 import existing GitHub repo `yaemart/yaemartOS`
   - **Root Directory** 设 `apps/web`
   - **Build Command** 留默认（`pnpm build` 在 monorepo root 跑 turbo build / next build）
   - **Output Directory** 留默认（`.next`）
   - **Install Command** 设 `pnpm install --frozen-lockfile`
   - Environment Variables 暂时只配 `NEXT_PUBLIC_API_BASE=https://staging-api.yaemartos.com`（其他 env 在 U6 配齐）
4. `cd apps/portal && npx vercel --confirm`（同上，Root Directory 改 `apps/portal`）
5. 在 Vercel Dashboard → Project → Settings → Domains，分别绑定：
   - apps/web project → `staging.yaemartos.com`（CNAME `cname.vercel-dns.com`）
   - apps/portal project → `staging-portal.yaemartos.com`
6. 去 DNS 服务商（按用户实际，可能是 Cloudflare / Namesilo / 阿里云）加 2 条 CNAME 记录
7. 等 DNS 生效（5-30 分钟）+ Vercel 自动签发 SSL 证书

**Patterns to follow**：

- 不在 vercel.json 里写死 monorepo 配置（让 Vercel 自动检测 + Settings UI 配）
- 不启用 Vercel Cron（用 GitHub Actions cron 即可，与 staging-smoke.yml 保持一致）
- 不开 Vercel Analytics（W50 再考虑）

**Test scenarios**：

- Happy：访问 https://staging.yaemartos.com 看到 yaemartOS Web 首页（前端走通）
- Edge：DNS 未生效 → Vercel 显示 "Pending"，等 30 min；过 30 min 仍未生效，检查 DNS 服务商记录拼写
- Error：build 失败（最可能 monorepo workspace 依赖未完整安装）→ 回 Vercel Settings 设 `pnpm install --frozen-lockfile` 而非 `npm install`

**Verification**：

- `curl -I https://staging.yaemartos.com` → 200，`server: Vercel`
- 浏览器打开 https://staging.yaemartos.com → 渲染 admin 登录页（即使 backend 还没起，前端 SSR 应该 fallback 显示骨架）
- Vercel Dashboard 显示 Production deployment 为 main branch latest commit

**Effort**：~0.3 人日（首次配 Vercel + DNS 等待）

---

### U2. Hetzner VPS 创建 + DNS + SSH 加固

**Goal**：在 Hetzner Cloud 创建 1 台 CX22 in FSN1（德国法兰克福），配置 SSH 访问、防火墙、DNS 子域名。

**Requirements**：R2（VPS 起手）+ R4（固定 IP）

**Dependencies**：无

**Files**：

- 本地 `~/.ssh/yaemartos_staging_ed25519`（生成 SSH key，不入仓库）
- DNS 服务商：1 条 A 记录 `staging-api.yaemartos.com → <hetzner-ipv4>`

**Approach**：

1. 注册或登录 Hetzner Cloud Console（https://console.hetzner.cloud/）
2. 创建项目 `yaemartOS-staging`
3. SSH Keys 标签 → Add SSH key：
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/yaemartos_staging_ed25519 -C 'yaemartos staging'
   cat ~/.ssh/yaemartos_staging_ed25519.pub
   # 复制 public key 内容到 Hetzner
   ```
4. Servers 标签 → Create Server：
   - Location: **FSN1**（默认）
   - Image: **Ubuntu 24.04**
   - Type: **CX22**（4 vCPU / 8GB RAM / 80GB SSD / €5.83）
   - Networking: 默认 IPv4 + IPv6
   - SSH Keys: 选刚才加的 key
   - Cloud config（可选，可贴 cloud-init 自动加固）：
     ```yaml
     #cloud-config
     package_update: true
     package_upgrade: true
     packages:
       - docker.io
       - docker-compose-v2
       - ufw
       - fail2ban
     runcmd:
       - ufw allow OpenSSH
       - ufw allow 80/tcp
       - ufw allow 443/tcp
       - ufw --force enable
       - systemctl enable docker
       - systemctl start docker
       - usermod -aG docker root
     ```
   - Hostname: `staging-api.yaemartos.com`
   - Name: `yaemartos-staging-api-1`
5. 等 30s 创建完成，记录 IPv4 地址
6. SSH 测试：`ssh -i ~/.ssh/yaemartos_staging_ed25519 root@<ipv4>`
7. 进 VPS 验证 docker：`docker version && docker compose version`
8. 关闭 root SSH 密码登录（如 cloud-init 没做）：
   ```bash
   sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
   sed -i 's/^PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
   systemctl restart ssh
   ```
9. 创建 deploy 用户（让 GitHub Actions 用）：
   ```bash
   adduser --disabled-password --gecos '' deploy
   usermod -aG docker deploy
   mkdir -p /home/deploy/.ssh
   chmod 700 /home/deploy/.ssh
   # 生成第二把 key 给 deploy：本地 ssh-keygen -t ed25519 -f ~/.ssh/yaemartos_deploy_ed25519
   echo '<deploy public key>' >> /home/deploy/.ssh/authorized_keys
   chmod 600 /home/deploy/.ssh/authorized_keys
   chown -R deploy:deploy /home/deploy/.ssh
   ```
10. DNS：去 DNS 服务商加 A 记录 `staging-api.yaemartos.com → <hetzner-ipv4>`，TTL 300
11. 等 DNS 生效后测试：`dig staging-api.yaemartos.com +short`

**Patterns to follow**：

- 永远不用 root 跑 deploy（用 deploy 用户）
- SSH key 本地存 ~/.ssh，不上 git
- Hetzner IPv4 视为 sensitive（写到 plan 用 `<hetzner-ipv4>` 占位，实际用户私下记录）

**Test scenarios**：

- Happy：SSH 通 + docker version 通 + DNS 解析通
- Edge：cloud-init 没跑完 → SSH 进去手动 `apt install docker.io docker-compose-v2`
- Error：DNS 服务商配置错（A 记录指错 IP）→ `dig` 不到，去 DNS 控制台修

**Verification**：

- `dig staging-api.yaemartos.com +short` 返回 hetzner ipv4
- `ssh -i ~/.ssh/yaemartos_deploy_ed25519 deploy@staging-api.yaemartos.com 'docker version'` 通
- `ufw status` 显示 22 / 80 / 443 allow，其他 deny

**Effort**：~0.3 人日（首次配 VPS）

---

### U3. docker-compose.staging.yml + Caddy + 启动验证

**Goal**：在 staging VPS 上用 docker-compose 跑起 NestJS API + Redis + ES（单节点）+ Caddy 反代，Caddy 自动签 Let's Encrypt SSL 证书。

**Requirements**：R2（API 服务起来）

**Dependencies**：U2（VPS + DNS 已就绪）

**Files**：

- `docker-compose.staging.yml`（新建，仓库根）
- `infra/staging/Caddyfile`（新建）
- `infra/staging/.env.staging.example`（新建，作为模板，不含敏感值）
- `apps/api/Dockerfile`（新建生产镜像，区别于现有 `Dockerfile.dev`）

**Approach**：

1. 写 `apps/api/Dockerfile`（multi-stage build）：

   ```dockerfile
   FROM node:24-alpine AS base
   RUN corepack enable
   WORKDIR /app
   COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
   COPY packages/lingxing-client/package.json ./packages/lingxing-client/
   COPY apps/api/package.json ./apps/api/
   RUN pnpm install --frozen-lockfile

   FROM base AS build
   COPY . .
   RUN pnpm --filter @yaemartos/lingxing-client build
   RUN pnpm --filter @yaemartos/api exec prisma generate
   RUN pnpm --filter @yaemartos/api build

   FROM node:24-alpine AS runtime
   WORKDIR /app
   COPY --from=build /app/node_modules ./node_modules
   COPY --from=build /app/apps/api/dist ./apps/api/dist
   COPY --from=build /app/apps/api/prisma ./apps/api/prisma
   COPY --from=build /app/apps/api/package.json ./apps/api/
   COPY --from=build /app/packages ./packages
   EXPOSE 3000
   CMD ["node", "apps/api/dist/main.js"]
   ```

2. 写 `docker-compose.staging.yml`：

   ```yaml
   version: '3.9'
   services:
     api:
       build:
         context: .
         dockerfile: apps/api/Dockerfile
       restart: unless-stopped
       env_file: .env.staging
       depends_on:
         redis: { condition: service_started }
         elasticsearch: { condition: service_healthy }
       healthcheck:
         test: ['CMD', 'wget', '-qO-', 'http://localhost:3000/health']
         interval: 30s
         timeout: 5s
         retries: 3
       networks: [edge, internal]

     redis:
       image: redis:7-alpine
       restart: unless-stopped
       volumes: [redis-data:/data]
       networks: [internal]

     elasticsearch:
       image: docker.elastic.co/elasticsearch/elasticsearch:8.13.0
       restart: unless-stopped
       environment:
         - discovery.type=single-node
         - xpack.security.enabled=false
         - ES_JAVA_OPTS=-Xms512m -Xmx512m
       volumes: [es-data:/usr/share/elasticsearch/data]
       healthcheck:
         test: ['CMD', 'curl', '-f', 'http://localhost:9200/_cluster/health']
         interval: 30s
         timeout: 5s
         retries: 5
       networks: [internal]

     caddy:
       image: caddy:2-alpine
       restart: unless-stopped
       ports: ['80:80', '443:443']
       volumes:
         - ./infra/staging/Caddyfile:/etc/caddy/Caddyfile:ro
         - caddy-data:/data
         - caddy-config:/config
       networks: [edge]
       depends_on: [api]

   networks:
     edge:
     internal:

   volumes:
     redis-data:
     es-data:
     caddy-data:
     caddy-config:
   ```

3. 写 `infra/staging/Caddyfile`：
   ```caddy
   staging-api.yaemartos.com {
       encode gzip
       reverse_proxy api:3000
       log {
           output file /var/log/caddy/access.log
           format json
       }
   }
   ```
4. 写 `.env.staging.example`（仅占位，不含敏感值）：
   ```bash
   # Database
   DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
   DIRECT_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
   # JWT
   JWT_SECRET=__set_in_real_env_staging__
   JWT_EXPIRES_IN=15m
   # AI
   GEMINI_API_KEY=__set_in_real_env_staging__
   # Lingxing
   LINGXING_APP_ID=__set_in_real_env_staging__
   LINGXING_APP_SECRET=__set_in_real_env_staging__
   # Slack
   SLACK_WEBHOOK_URL=__set_in_real_env_staging__
   # Brand
   VALID_TENANTS=homtone,spoonlemon,davivy,tysun
   # Redis (in compose network)
   REDIS_HOST=redis
   REDIS_PORT=6379
   # ES (in compose network)
   ELASTICSEARCH_URL=http://elasticsearch:9200
   ```
5. 在 VPS 上：
   ```bash
   ssh deploy@staging-api.yaemartos.com
   git clone https://github.com/yaemart/yaemartOS.git
   cd yaemartOS
   cp infra/staging/.env.staging.example .env.staging
   nano .env.staging  # 填入真实值
   docker compose -f docker-compose.staging.yml up -d --build
   docker compose -f docker-compose.staging.yml logs -f api  # 实时看日志
   ```
6. 等 ES 健康（30-60s）+ API 启动（10s），Caddy 自动签 SSL（可能 30s-2min）
7. 健康检查：
   ```bash
   curl -I https://staging-api.yaemartos.com/health
   # 期待 200 OK
   ```

**Patterns to follow**：

- 不在 docker-compose.staging.yml 里硬编码任何 secret，全部 .env.staging
- API healthcheck 指向 `/health`（NestJS 应已实现，plan §13 W1 D1 ready check 提过）
- Caddy 用 file storage（默认）签 SSL，不用 ACME DNS challenge

**Test scenarios**：

- Happy：`curl https://staging-api.yaemartos.com/health` 返回 `{"status":"ok"}` 之类
- Edge：ES 健康检查超时 → 增 ES_JAVA_OPTS heap，或重启 docker compose restart elasticsearch
- Error：Caddy SSL 签发失败（80 端口被防火墙挡）→ ufw allow 80/tcp + 重启 caddy

**Verification**：

- `curl -I https://staging-api.yaemartos.com/health` → 200
- `curl https://staging-api.yaemartos.com/customer-portal/chat/sessions -X POST -H 'x-yaemart-brand: homtone' -d '{}'` → 期待 401 / 400 等真实业务响应（不再是 ENOTFOUND）
- VPS `docker compose -f docker-compose.staging.yml ps` 全部 healthy

**Effort**：~0.5 人日（首次构建镜像 + Caddy 签 SSL）

---

### U4. Neon Postgres staging branch + migrate + seed

**Goal**：在 Neon 创建 staging branch，run prisma migrate + 4 brand schema migrate，seed 出 admin / customer 测试账户 + AGENT_NATIVE_TOOL_CALLING.homtone feature flag 打开。

**Requirements**：R3（DB ready）

**Dependencies**：U3（API 容器需要 DATABASE_URL，否则 NestJS 起不来；本 unit 与 U3 可并行做 Neon 部分，最终汇合到 .env.staging）

**Files**：

- 不改仓库文件，全部走 Neon Console + prisma 命令

**Approach**：

1. 注册或登录 Neon Console（https://console.neon.tech/）
2. 创建项目 `yaemartos`（或复用现有 main project）
3. region 选 **AWS eu-central-1**（与 Hetzner FSN1 同区，跨大西洋延迟最低）
4. 默认 main branch 即作为 prod 预留（W26 起用）
5. 创建 branch `staging` from main
6. 复制 staging branch 的 connection string（pooled + direct 两种）
7. 把 connection string 填到 staging VPS 的 `.env.staging`：
   ```bash
   DATABASE_URL=postgresql://...neon.tech/...?sslmode=require&pgbouncer=true
   DIRECT_URL=postgresql://...neon.tech/...?sslmode=require
   ```
8. 在 VPS 跑 prisma migrate：
   ```bash
   ssh deploy@staging-api.yaemartos.com
   cd yaemartOS
   docker compose -f docker-compose.staging.yml exec api sh -c \
     'cd apps/api && pnpm exec prisma migrate deploy'
   ```
9. 跑 tenant schema migrations（4 brand schemas）：
   ```bash
   docker compose -f docker-compose.staging.yml exec api sh -c \
     'cd apps/api && pnpm run db:migrate:all-tenants'
   ```
10. 跑 seed（feature flag + admin/customer 测试账户）：
    ```bash
    docker compose -f docker-compose.staging.yml exec api sh -c \
      'cd apps/api && pnpm exec prisma db seed'
    ```
11. 在 Neon Console SQL editor 验证：
    ```sql
    -- 4 brand schemas exist
    SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('homtone', 'spoonlemon', 'davivy', 'tysun');
    -- AGENT_NATIVE_TOOL_CALLING.homtone = true
    SELECT * FROM public.feature_flag WHERE name = 'AGENT_NATIVE_TOOL_CALLING';
    -- staging 测试账户
    SELECT id, email FROM public.user WHERE email LIKE '%staging%';
    ```

**Patterns to follow**：

- 不让 staging admin token 过期（W50 P2-D F-9 长期方案）
- Neon staging branch 数据可以随时 reset（branch → reset to main），不当 prod 用
- pooled connection 给 NestJS，direct connection 给 prisma migrate

**Test scenarios**：

- Happy：所有 migration 跑通，feature_flag.AGENT_NATIVE_TOOL_CALLING.homtone = true
- Edge：tenant migrations 顺序错（spoonlemon 先于 homtone）→ 修 migration 顺序，重 reset Neon branch 重跑
- Error：seed 含 hash 密码与 W43-W45 ad seed 冲突 → 看 console 报错 + 改 seed 数据

**Verification**：

- `curl https://staging-api.yaemartos.com/admin/feature-flags?name=AGENT_NATIVE_TOOL_CALLING -H 'Authorization: Bearer <admin-token>'` 返回 `{ "value": true, "brand": "homtone" }`（admin token 在 U6 配齐后才能跑这条；本 unit 仅跑到 SQL 验证为止）

**Effort**：~0.2 人日

---

### U5. Lingxing IP 白名单提交 + Slack webhook

**Goal**：把 staging VPS 的 IPv4 提交到领星开放平台白名单（5 IP 中占 1 个）；在 Slack 创建 #yaemartos-incident channel webhook。

**Requirements**：R4（API 出口 IP 白名单）+ R5（SLACK_WEBHOOK_URL）

**Dependencies**：U2（VPS IPv4 已知）

**Files**：无（外部系统操作）

**Approach**：

1. 登录领星开放平台（https://openapi.lingxing.com/）
2. 应用管理 → yaemartOS 应用 → IP 白名单
3. 添加 IP：staging VPS IPv4
4. **此操作需要领星运营人员审批**（默认 1-3 个工作日）；审批前 staging API 调 Lingxing 会 403
5. 同时（不阻塞）：在 Slack 创建 #yaemartos-incident channel
6. Slack workspace → Manage apps → Incoming Webhooks → Add Configuration
7. 选择 #yaemartos-incident channel → Add → 复制 Webhook URL
8. 测试 webhook：
   ```bash
   curl -X POST -H 'Content-Type: application/json' \
     --data '{"text":"yaemartos staging webhook test"}' \
     '<SLACK_WEBHOOK_URL>'
   ```
   → Slack channel 应该立刻收到 "yaemartos staging webhook test" 消息

**Patterns to follow**：

- 白名单审批走运营，不走开发
- Slack webhook 视为 sensitive，仅写 GitHub secret，不写仓库

**Test scenarios**：

- Happy：领星审批通过 + Slack 收到测试消息
- Edge：领星审批超时 3 天 → 用户对接领星运营催进度
- Error：Slack webhook URL 失效（404）→ 重新创建

**Verification**：

- 领星 → 应用详情 → IP 白名单列表显示 staging IPv4 + 状态 "已生效"
- Slack #yaemartos-incident 收到 manual curl 测试消息

**Effort**：~0.1 人日（user 自身操作 + 等审批）

---

### U6. 6 个 GitHub repository secrets 配置 + manual trigger #4 验证

**Goal**：把 6 个 staging-smoke 依赖的 secrets 配齐到 GitHub repo Settings → Secrets and variables → Actions，跑 manual trigger #4 验证 staging 链路全绿。

**Requirements**：R5（secrets 全配齐）

**Dependencies**：U1 + U3 + U4 + U5（全部前置 unit 完成）

**Files**：无（GitHub UI 操作）

**Approach**：

1. 浏览器打开 https://github.com/yaemart/yaemartOS/settings/secrets/actions
2. 按下表逐个 New repository secret：

| Name                     | Source                                            | 值示例                                             |
| ------------------------ | ------------------------------------------------- | -------------------------------------------------- |
| STAGING_API_BASE         | U3 staging API 域名                               | `https://staging-api.yaemartos.com`                |
| STAGING_ADMIN_TOKEN      | U4 seed 出的 admin 用户登录后取的 JWT             | `eyJhbGciOiJIUzI1NiIs...`                          |
| STAGING_CUSTOMER_TOKEN   | U4 seed 出的 customer 用户登录后取的 JWT          | `eyJhbGciOiJIUzI1NiIs...`                          |
| STAGING_DASHBOARD_URL    | U1 Vercel 域名 + /zh-CN/dashboard                 | `https://staging.yaemartos.com/zh-CN/dashboard`    |
| STAGING_DASHBOARD_COOKIE | 在 staging Vercel 上登录后从 Chrome DevTools 复制 | `next-auth.session-token=eyJhbGciOiJIUzI1NiIs...`  |
| SLACK_WEBHOOK_URL        | U5 Slack incoming webhook                         | `https://hooks.slack.com/services/T0XXX/B0YYY/ZZZ` |

3. 全部填完后，浏览器打开 https://github.com/yaemart/yaemartOS/actions/workflows/staging-smoke.yml
4. Run workflow → brand=homtone → Run
5. 等 1-3 分钟看结果

**Patterns to follow**：

- secrets 名严格按 runbook 约定（大小写敏感）
- Customer token 即使 optional 也建议配（不配则 chat.session.with_tools_count 会因 anonymous chat path 不动）
- Cookie 提取从 Chrome DevTools 而非 Firefox（Vercel 经常仅在 Chrome 测试）

**Test scenarios**：

- Happy：#4 run 1-3 min ✅，artifact smoke-output.json 含 `metricDeltas['chat.session.with_tools_count']: 1+`
- Edge：#4 run 1-3 min ❌ + hard failure `chat.session.with_tools_count did not bump`
  → 检查 feature_flag.AGENT_NATIVE_TOOL_CALLING.homtone 是否真的 true（U4 验证通过应不会出现）
  → 或 customer token 不对，customerToken=undefined 让 smoke 走 anonymous path，session 不带 tool
  → 修正后重跑
- Error：#4 run < 30s ❌ + hard failure `baseline KPI fetch failed: HTTP 500`
  → API 在 staging 启动失败，去 VPS 看 docker logs

**Verification**：

- workflow status ✅
- artifact smoke-output.json 含 3 条非零 metricDeltas
- Slack #yaemartos-incident **不发** alert（success 不通知；如果 SLACK_WEBHOOK_URL 配错也不发，需要看 workflow log 验证 "skipping notification"）

**Effort**：~0.3 人日（首次取 token + 配 secret + 1-3 次 trigger 调试）

---

### U7. GitHub Actions deploy.yml + 文档同步

**Goal**：写最小可用的 `.github/workflows/deploy.yml`，监听 main push，SSH 到 staging VPS 跑 `git pull && docker compose pull && docker compose up -d`；同步文档反映 staging 真正解锁。

**Requirements**：R6（CI/CD）+ R7（文档同步）

**Dependencies**：U6 全部 ok

**Files**：

- `.github/workflows/deploy.yml`（新建）
- `docs/W46-W52-checklist.md`（更新 W49 D2 解锁动作行）
- `docs/briefs/2026-05-W49-leadership-sync.md`（追加 D3-D4 staging 部署 ops 段）
- `docs/runbooks/w49-staging-smoke-chat-tool.md`（更新 secrets 配齐时间 + 第 1 次 cron 自动跑预期日期）
- `docs/solutions/infrastructure/2026-05-W49-staging-bootstrap.md`（institutional learning，新建）

**Approach**：

1. 写 `.github/workflows/deploy.yml`：

   ```yaml
   name: Deploy to staging API

   on:
     push:
       branches: [main]
       paths:
         - 'apps/api/**'
         - 'packages/**'
         - 'docker-compose.staging.yml'
         - 'apps/api/Dockerfile'
         - '.github/workflows/deploy.yml'
     workflow_dispatch:

   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4

         - name: Set up SSH
           run: |
             mkdir -p ~/.ssh
             echo "${{ secrets.STAGING_DEPLOY_SSH_KEY }}" > ~/.ssh/deploy_key
             chmod 600 ~/.ssh/deploy_key
             ssh-keyscan -H staging-api.yaemartos.com >> ~/.ssh/known_hosts

         - name: Deploy
           run: |
             ssh -i ~/.ssh/deploy_key deploy@staging-api.yaemartos.com '
               set -e
               cd yaemartOS
               git fetch origin main
               git reset --hard origin/main
               docker compose -f docker-compose.staging.yml build api
               docker compose -f docker-compose.staging.yml up -d --no-deps api
               docker compose -f docker-compose.staging.yml ps
             '

         - name: Health check
           run: |
             for i in 1 2 3 4 5; do
               sleep 10
               if curl -sfI https://staging-api.yaemartos.com/health | grep '200 OK'; then
                 echo "Health check OK"
                 exit 0
               fi
             done
             echo "::error::Health check failed after 5 attempts"
             exit 1

         - name: Notify Slack on failure
           if: failure()
           run: |
             curl -X POST -H 'Content-Type: application/json' \
               --data "{\"text\":\":rotating_light: yaemartos staging deploy FAILED — ${{ github.run_id }}\"}" \
               '${{ secrets.SLACK_WEBHOOK_URL }}'
   ```

2. 加新 secret `STAGING_DEPLOY_SSH_KEY`（U2 的 deploy 用户私钥，PEM 格式）到 repo Settings → Secrets
3. 同步 `docs/W46-W52-checklist.md` 的 W49 D2 解锁动作行：
   ```diff
   - [ ] cron 解锁
   + [x] cron 解锁（D4 manual trigger #4 ✅，commit `<hash>`）
   ```
4. 追加 `docs/briefs/2026-05-W49-leadership-sync.md` D3-D4 段：
   ```markdown
   > **W49 D3-D4 staging 起步 wrap-up** — E 方案落地：Vercel 前端（staging.yaemartos.com / staging-portal.yaemartos.com）+ Hetzner CX22 API（staging-api.yaemartos.com）+ Neon staging branch（eu-central-1）+ Caddy 自动 SSL。Lingxing IP 白名单 staging VPS 已加（5 IP 中第 1 个）。6 个 GitHub secrets 配齐后 manual trigger #4 ✅ + metricDeltas['chat.session.with_tools_count']=1+。cron 真正解锁，周一（May 11）09:00 PRC 起每周一次自动跑。详见 [docs/plans/2026-05-04-006-feat-w49-staging-deployment-plan.md](../plans/2026-05-04-006-feat-w49-staging-deployment-plan.md)。
   ```
5. 写 `docs/solutions/infrastructure/2026-05-W49-staging-bootstrap.md`（institutional learning）：
   - Vercel monorepo Root Directory 配法
   - Hetzner cloud-init 加固模板
   - Caddy + docker compose 反代 + 自动 SSL 一键模板
   - Neon staging branch 操作流
   - Lingxing IP 白名单提交流程
   - 6 个 secret 命名 + 来源对应表
   - 5 个常见坑（DNS 没生效、ES heap 太小、prisma migrate 顺序错、cookie 提取错域名、Vercel pnpm 安装失败）

**Patterns to follow**：

- deploy.yml 仅 deploy API（前端走 Vercel 自动）
- deploy.yml paths 过滤避免文档/前端改动也触发 deploy
- 失败时 Slack 通知 + workflow exit 1（与 staging-smoke.yml 相同模式）

**Test scenarios**：

- Happy：D4 末本 plan 文档 commit + push → deploy.yml 不触发（paths 过滤）；下次真正 push apps/api/\*\* 时触发，VPS 收到新 image，health check 通
- Edge：API 镜像 build 失败（依赖问题）→ deploy.yml 不会到 health check，docker build 阶段 fail
- Error：health check 5 次失败 → workflow ❌ + Slack 通知 + 用户 SSH 上 VPS docker logs 排查

**Verification**：

- 本 plan commit 不触发 deploy.yml（验证 paths 过滤）
- 手动 trigger workflow_dispatch deploy.yml 一次，看健康检查通过
- W46-W52-checklist.md 显示 cron 解锁

**Effort**：~0.3 人日

---

### U8. 验收 + smoke #5 周一自动跑预演 + 文档收尾

**Goal**：D4 末做完整端到端验收，确认 staging 稳定 24h，准备 D5（May 6 周三）→ M+5（May 11 周一）首次 cron 自动跑。

**Requirements**：R5 + R6 + R7（端到端绿灯）

**Dependencies**：U1-U7 全部 ok

**Files**：无新增

**Approach**：

1. 端到端 smoke：
   - 浏览器开 https://staging.yaemartos.com → 登录 admin → 看 dashboard 渲染正常
   - 浏览器开 https://staging-portal.yaemartos.com/homtone/zh-CN → 客户门户首页
   - 客户门户登录 → 发起 chat → 发送 "我想看保修记录" → 期待 streamText + tool call 工作
   - admin dashboard → 看 "客服 Chat Tool 活动" widget → 期待显示 1 次调用
2. workflow_dispatch staging-smoke.yml 第 5 次 → 应仍 ✅
3. 24h 稳定性观察（D4 22:00 → D5 22:00）：
   - 每 4 小时 SSH 看 `docker compose ps`，全 healthy
   - 每 4 小时 `curl -I https://staging-api.yaemartos.com/health`，200
   - 看 Caddy access log 没有大量 5xx
4. 文档收尾：
   - W46-W52-checklist.md：D2 解锁动作 → D4 完成
   - leadership-sync.md：D5 段补 24h 稳定性数据
   - staging-bootstrap solution doc：补"D4 末验收实测耗时"vs 计划耗时
5. 给团队同步：D5 leadership-sync 公开 + Slack #yaemartos-eng 推一条简报"staging 起步完成，周一首次 cron 跑"

**Patterns to follow**：

- 24h 稳定性观察不阻塞下一 sprint（W50 P2-D 可并行起步），仅作为 staging trust 资产
- 24h 期间发现的小 bug 记入 W50 backlog，不当晚强行修

**Test scenarios**：

- Happy：24h 稳定 + smoke #5 ✅ + 周一 cron #1 ✅
- Edge：24h 内某次 health check 间断（VPS 偶发 hiccup）→ 记 W50 backlog 加 monitoring（不当 P0）
- Error：24h 稳定但 #5 manual smoke ❌ → 回 U6 排查 secret，可能 token 过期

**Verification**：

- W46-W52-checklist.md 全部 D2 解锁动作打钩
- leadership-sync.md 含 D3-D5 完整段
- W49 cron schedule `0 1 * * 1` 周一自动跑（无需人工）
- Slack #yaemartos-incident 周一上午静默（success 不通知）

**Effort**：~0.2 人日

---

## Verification Plan

整体 plan 验收标准：

| 验收项                                                | 通过标志                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------ |
| Vercel 前端可访问                                     | `curl -I https://staging.yaemartos.com` 200                              |
| Vercel portal 可访问                                  | `curl -I https://staging-portal.yaemartos.com` 200                       |
| Hetzner VPS API 可访问                                | `curl -I https://staging-api.yaemartos.com/health` 200                   |
| Neon staging branch 4 brand schema 存在               | SQL 查询返回 4 行                                                        |
| feature_flag.AGENT_NATIVE_TOOL_CALLING.homtone = true | SQL 查询返回 true                                                        |
| Lingxing IP 白名单 staging IPv4 已生效                | 领星 console 显示 "已生效"                                               |
| 6 个 GitHub secrets 已配                              | repo Settings 显示 6 条                                                  |
| staging-smoke #4 ✅                                   | workflow ✅ + artifact metricDeltas['chat.session.with_tools_count'] ≥ 1 |
| deploy.yml 自动部署通                                 | manual trigger workflow_dispatch ✅ + health check 通                    |
| 24h 稳定性                                            | docker compose ps 全 healthy 24h                                         |
| W46-W52-checklist.md 同步                             | "cron 解锁" 已打勾                                                       |
| leadership-sync.md 同步                               | 含 D3-D5 段                                                              |
| solution doc 沉淀                                     | docs/solutions/infrastructure/2026-05-W49-staging-bootstrap.md 存在      |
| 周一 cron #1 ✅（D5 验收，本 plan 外）                | Actions UI 显示 main scheduled run ✅                                    |

---

## Rollback Plan

如果 D3-D4 期间发现 E 方案某个组件不可行，rollback 路径：

| 失败场景                            | rollback 行动                                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| Vercel 前端 build 持续失败          | 临时回退到 staging API only，前端先用 dev `pnpm dev` 本地访问 staging API；W50 重审 Vercel 配置    |
| Hetzner VPS region 不通             | 切到 DO Singapore Basic Droplet，配置文件不变，仅换 IP                                             |
| Neon eu-central-1 不可用            | 切 us-west-2 默认 region（接受跨大西洋延迟）                                                       |
| Caddy SSL 签发失败                  | 临时换 Cloudflare proxy ON（Cloudflare 自带 SSL），Caddy 仅做反代                                  |
| Lingxing 白名单审批 > 5 天          | 在 W50 plan 里把 staging-smoke 改为 mock Lingxing API（不真实调用），仅验证 chat.tool.\* KPI 链路  |
| docker compose API 不稳定（OOM 等） | 升 CX22 → CPX21（€11.10/月，更多 RAM），不重写部署                                                 |
| smoke #4 持续 ❌ 找不到原因         | 把 cron schedule 注释掉（仅留 workflow_dispatch），把"cron 解锁"延期到 W50                         |
| 整体 E 方案被发现致命阻碍           | 回退到 V3 备选 ADR：仅记录决策，先把 staging-smoke.yml schedule 注释掉避免周一假警报，下周重选方案 |

---

## Risk Register

| 风险                                              | 概率 | 影响                                                 | 缓解                                                                               |
| ------------------------------------------------- | ---- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Hetzner FSN1 → PRC 延迟 > 500ms 影响运营 SSH 体验 | M    | 运营 dashboard 加载慢                                | 备选 DO Singapore Basic / 阿里云 HK ECS                                            |
| Lingxing 白名单审批超 3 天                        | M    | smoke 真实调用 fail；但 chat.tool.\* KPI 仍 bump     | mock Lingxing API 临时方案（W50 plan 内）                                          |
| Vercel monorepo build 偶发失败（pnpm 缓存）       | M    | 前端部署慢                                           | 配置 Vercel cache invalidation；最坏情况手动 redeploy                              |
| Neon free tier 100h compute 用尽                  | L    | DB 连接 throttle                                     | 升 Launch $19 — 在 W50 budget 内可承受                                             |
| staging VPS 被滥用（爆破 SSH）                    | L    | VPS 失联                                             | fail2ban + ufw + Hetzner snapshot 5min 恢复                                        |
| 24h 稳定性观察期发现 ES OOM                       | M    | API 启动失败                                         | ES_JAVA_OPTS 调小到 -Xms256m -Xmx512m / 暂时停 ES（chat tool calling 不强依赖 ES） |
| GitHub Actions deploy.yml 偶发 SSH timeout        | L    | deploy ❌                                            | retry 1 次 / 手动 SSH deploy                                                       |
| F-9 staging dashboard cookie 30 天后过期          | H    | 第 5 周后 dashboard SSR smoke fail                   | 已在 W50 P2-D backlog；本 plan 接受 30 天内有效                                    |
| 跨平台 secrets 同步漂移（GitHub vs Vercel）       | M    | 前端 NEXT_PUBLIC_API_BASE 与 STAGING_API_BASE 不一致 | 在 staging-bootstrap solution doc 里写 single source of truth checklist            |
| W50 P2-D 优先级被 staging 部署挤占                | M    | F-4/F-5/F-9 延期                                     | 本 plan 严格 1.6 人日不超，挤占范围已计入 leadership-sync                          |

---

## Effort Estimate

| Unit | 描述                                 | 工时 | 累计 |
| ---- | ------------------------------------ | ---- | ---- |
| U1   | Vercel 前端 staging 部署             | 0.3d | 0.3d |
| U2   | Hetzner VPS 创建 + DNS               | 0.3d | 0.6d |
| U3   | docker-compose.staging.yml + Caddy   | 0.5d | 1.1d |
| U4   | Neon staging branch + migrate + seed | 0.2d | 1.3d |
| U5   | Lingxing 白名单 + Slack webhook      | 0.1d | 1.4d |
| U6   | 6 个 secrets + manual trigger #4     | 0.3d | 1.7d |
| U7   | deploy.yml + 文档同步                | 0.3d | 2.0d |
| U8   | 验收 + 24h 稳定性                    | 0.2d | 2.2d |

**总计：~2.2 人日**（D3-D4 跨度，不含 Lingxing 审批等待时间）

**对 W49 leadership-sync 的影响**：W49 净增 +2.2 人日，挤占 W50 backlog 部分；W50 P2-D（F-4/F-5/F-9）仍可执行但需要 W51 早期接续。**用户决策点**：是否接受 W50 净增 2.2d → 见 §Decision Log。

---

## Decision Log

### W49 D2 22:55 决策快照

| 决策                            | 选择                                                         | Owner              |
| ------------------------------- | ------------------------------------------------------------ | ------------------ |
| staging 部署方案                | E（Vercel 前端 + VPS Compose API + Neon DB）                 | 用户 + 本 plan     |
| VPS 提供商                      | Hetzner CX22 FSN1（默认）；备选 DO Singapore                 | D3 U2 用户 confirm |
| 前端部署平台                    | Vercel（默认）                                               | 用户 + 本 plan     |
| 数据库                          | Neon staging branch eu-central-1                             | 本 plan            |
| ES 集群规模                     | staging 单节点 docker-compose（不复刻 prod 3 节点）          | 本 plan            |
| Monitoring 范围                 | docker logs + Caddy access log only（W50 加 Sentry）         | 本 plan            |
| K8s 时机                        | S5+ W53+，不在 W49-S4 范围                                   | 本 plan + plan §3  |
| Lingxing 白名单 staging IP 占用 | 1 个（5 IP 中第 1 个；prod 起手再占 1，预留 3 给 prod 扩容） | 本 plan            |
| W50 工时调整                    | +2.2d staging deploy；F-4/F-5/F-9 W50 末-W51 早接续          | 用户决策           |
| 今晚 D2 22:55 是否动代码        | 否，仅 commit 本 plan 文档                                   | 用户 + 本 plan     |

### 决策原则（写给 W50 / S2 重审本 plan 时的参考）

- 任何 E 方案的演进（VPS → multi-VPS → K8s）都不应导致代码重写
- 任何"为了 prod 提前优化 staging"的提议都需要先回到 plan §3 v1.4 "避免 day 1 over-engineer"
- 任何换平台（迁出 Vercel / 迁出 Hetzner / 迁出 Neon）的决策都需要独立 ADR
- staging 是 prod 的彩排，不是 prod 的副本：staging 与 prod 的可观测/HA 配置可以不一致，但代码与数据形态必须一致
