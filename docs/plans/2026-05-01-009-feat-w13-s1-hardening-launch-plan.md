---
title: 'feat: W13 S1 硬化与上线'
type: feat
status: active
date: 2026-05-01
origin:
  - docs/yaemartOS-implementation-plan.md
---

# W13：S1 硬化与上线

## Overview

S1 最后一公里：在所有功能模块（W1–W12）落地后，交付四件收尾事项——**按品牌灰度的 Feature Flag 基础设施**、**DB 备份 + 密钥轮转 Runbook**、**M-01 并发压测达标**、以及 **5 人 alpha 试用启动核查清单**。目标是 S1 末切片可上线、5 名运营可端到端完成 Homtone × 美国 × Amazon 的完整链路。

---

## Problem Frame

- 当前 feature flag 仅有 `FEATURE_LISTING_AI` 单变量，缺乏按品牌维度的灰度控制能力；S1 alpha 上线需要确保只有指定 5 人可以访问，避免所有运营直接进入。
- k6 现有脚本（`scripts/k6/health-smoke.js`）使用 P95 < 800ms + 2 个虚拟用户，与 M-01「50 并发，P99 < 800ms，错误率 < 0.1%」规格不符；W13 要补齐这一差距并形成可存档报告。
- 生产发布前无 DB 备份脚本和密钥轮转流程，上线操作缺乏安全网。
- `/health` 端点是单一聚合；K8s Liveness / Readiness 探针需要拆分——Liveness 不应查 DB（否则 DB 短暂抖动会导致 Pod 重启风暴）。
- 没有一份完整的上线 + alpha 启动核查清单，运营验收缺乏标准化流程。

---

## Requirements Trace

- R1. Feature flag 按品牌灰度：`FEATURE_*` 环境变量补全进 `.env.local.example`；服务端 `FeatureFlagService` 支持按 `brandId` 查询开关状态
- R2. M-01 达标：50 并发用户，P99 < 800ms，错误率 < 0.1%（k6 压测通过并存档报告）
- R3. DB 备份 Runbook：可执行脚本 + 恢复演练记录
- R4. 密钥轮转 Runbook：JWT Secret + DB password 轮转步骤文档
- R5. 健康检查拆分：`/health/live`（无状态）+ `/health/ready`（含 DB/ES），兼容 K8s 探针
- R6. S1 Alpha 上线核查清单：全流程零阻塞，5 人 alpha 录屏存档 + 运营反馈表

（see origin: `docs/yaemartOS-implementation-plan.md` §W13）

---

## Scope Boundaries

- 不包含 K8s manifest 的生产部署（清单在 Harness/外部仓库，本计划只交付应用侧 readiness）
- 不包含 S2 的多品牌切换 UI（W14–W15 负责）
- 不包含 GLM-5 引入或 Cost Tracking（S2 起）
- 不包含完整 Sentry 告警配置（运维 owner 负责，本计划只在 .env.example 中保留占位）

### Deferred to Follow-Up Work

- M-01 完整的 38 人并发基准（S1 仅 5 人 alpha，50 并发可验证架构容量，真实 38 人场景在 S5 全员推广时重测）
- 生产 K8s manifests（Harness / 外部 manifest 仓库，部署侧 owner 负责）

---

## Context & Research

### Relevant Code and Patterns

- Feature flag 现状：`apps/api/src/listing/listing.controller.ts` — `ConfigService.get('FEATURE_LISTING_AI')` 单变量模式
- 前端 flag：`apps/web/components/listing/listing-editor-shell.tsx` — `process.env.NEXT_PUBLIC_FEATURE_LISTING_AI`
- 健康端点：`apps/api/src/health/health.controller.ts` — 单一聚合 `GET /health`（含 DB + ES）
- 现有 k6：`scripts/k6/health-smoke.js`（P95 < 800ms, 2 VUs）
- 现有 k6：`scripts/k6-listing-generate.js`（M-02，P95 < 15s）
- CI：`.github/workflows/ci.yml`，包含 lint / typecheck / test / e2e；`.harness/ci-pipeline.yaml` 含 staging/production kubernetes-rolling-deploy
- .env 模板：`apps/api/.env.local.example` / `apps/web/.env.local.example`（未含 `FEATURE_*` 变量）

### Institutional Learnings

- 环境变量 feature flag 模式已在 Listing AI 中验证，但尚未有品牌维度；W13 扩展为「flag 名 + brand scope」
- `ConfigService.get()` 是 NestJS 的标准读取方式，新 `FeatureFlagService` 应委托给它，避免直接读 `process.env`

### External References

- k6 选项文档：`duration`, `stages`, `thresholds` — `p(99)<800` 语法与 `p(95)<800` 一致
- K8s Liveness vs Readiness 探针设计：Liveness 失败 → Pod 重启；Readiness 失败 → 从 Service 下线但不重启；两者触发后果不同，Liveness 必须只做最轻量检查

---

## Key Technical Decisions

- **FeatureFlagService 方案：环境变量 + 品牌维度**：用 `FEATURE_{FLAG_NAME}_{BRAND_ID}=true/false` 格式（如 `FEATURE_LISTING_AI_HOMTONE=true`）；fallback 到无品牌维度的 `FEATURE_{FLAG_NAME}`；S2 可平滑迁移到数据库 flag 而不改调用方。不引入第三方 feature flag 服务（S1 复杂度不值得），下一次评审点是 S3。
- **K8s 探针拆分**：`GET /health/live` 返回 `{ status: 'ok' }` 无 IO；`GET /health/ready` 复用现有 `SearchService.health()` + DB ping 逻辑，仅对外重定向现有聚合逻辑。
- **M-01 k6 场景**：覆盖「登录 + 获取 listing 列表」两步链，用 stages 模拟 5 → 50 并发爬坡；P99 阈值严格于现有 P95 版本。

---

## Open Questions

### Resolved During Planning

- **Q: feature flag 是否需要实时热更新？** 否，S1 只有 5 人 alpha，重启 API pod 可接受；热更新推到 S3 引入配置中心时。
- **Q: DB 备份存储目标？** 本地脚本 + 手动上传 S3/GCS 即可（S1 阶段）；Runbook 说明步骤，自动化 cronjob 推迟到 S4 基础设施完善期。
- **Q: alpha 5 人是否通过 IAM 控制还是 feature flag？** 两者结合：IAM 已控制用户账号访问，feature flag 用于按品牌灰度管理功能可见性（不用于人员访问控制）。

### Deferred to Implementation

- 实际 Postgres `pg_dump` 命令参数（取决于最终生产 DB 连接配置）
- K8s Liveness/Readiness 探针参数（`periodSeconds`, `failureThreshold` 等）由基础设施 owner 在 manifest 中配置，本计划只交付端点

---

## High-Level Technical Design

> _以下说明设计方向，供评审验证，不是实现规范。_

### Feature Flag 查询优先级

```
FeatureFlagService.isEnabled(flagName, brandId?)
  1. FEATURE_{FLAG_NAME}_{BRAND_ID}   ← 品牌维度（最高优先级）
  2. FEATURE_{FLAG_NAME}              ← 全局维度（fallback）
  3. false                            ← 默认关闭
```

### 健康端点拆分

```
GET /health/live   → { status: 'ok' }                          # 无 IO，仅 alive
GET /health/ready  → { status: 'ok'|'degraded', db, search }   # 含 DB ping + ES health
GET /health        → 保留（向后兼容，委托给 /health/ready 逻辑）
```

### M-01 k6 stages

```
stages: [ { duration: '30s', target: 10 },   # 爬坡
           { duration: '60s', target: 50 },   # 稳定高负载
           { duration: '30s', target: 0  } ]  # 降压
thresholds: { http_req_duration: ['p(99)<800'], http_req_failed: ['rate<0.001'] }
```

---

## Implementation Units

- [ ] U1. **FeatureFlagService + .env.example 补全**

**Goal:** 建立可按品牌维度查询 flag 的服务端工具，并补全 `.env.local.example` 中所有 `FEATURE_*` 条目。

**Requirements:** R1

**Dependencies:** 无

**Files:**

- Create: `apps/api/src/common/feature-flag/feature-flag.service.ts`
- Create: `apps/api/src/common/feature-flag/feature-flag.module.ts`
- Create: `apps/api/src/common/feature-flag/feature-flag.service.spec.ts`
- Modify: `apps/api/.env.local.example`（补 `FEATURE_LISTING_AI=false`, `FEATURE_LISTING_AI_HOMTONE=true` 示例）
- Modify: `apps/web/.env.local.example`（补 `NEXT_PUBLIC_FEATURE_LISTING_AI=false` 等）
- Modify: `apps/api/src/listing/listing.controller.ts`（替换裸 `ConfigService.get` 为 `FeatureFlagService.isEnabled`）

**Approach:**

- `FeatureFlagService.isEnabled(flag: string, brandId?: string): boolean` 按优先级查 ConfigService
- 将 `FeatureFlagModule` 导出，供 ListingModule 和将来其它模块引用
- `.env.local.example` 新增注释块「Feature Flags」，列出 S1 存在的所有 flag

**Patterns to follow:**

- `apps/api/src/common/audit/audit.service.ts` — Common 服务的模块结构
- `apps/api/src/listing/listing.controller.ts` — 现有 `ConfigService.get('FEATURE_LISTING_AI')` 替换点

**Test scenarios:**

- Happy path: `isEnabled('LISTING_AI', 'homtone')` → 读到 `FEATURE_LISTING_AI_HOMTONE=true` 返回 `true`
- Happy path: 无品牌 flag 时 fallback 到 `FEATURE_LISTING_AI=true` 全局变量
- Edge case: 未设置任何相关变量 → 返回 `false`（默认关闭）
- Edge case: 品牌维度 `false` 覆盖全局 `true`（`FEATURE_LISTING_AI_HOMTONE=false` + `FEATURE_LISTING_AI=true` → `false`）
- Edge case: `brandId` 为 `undefined` 时只查全局维度

**Verification:**

- `FeatureFlagService` 单元测试全通过
- `GET /listings/:id/generate` 被 `FeatureFlagService.isEnabled` 控制（controller 不再直接调 `ConfigService`）

---

- [ ] U2. **健康检查端点拆分（Liveness / Readiness）**

**Goal:** 将单一 `/health` 拆为 `/health/live`（无状态）和 `/health/ready`（含 IO），保留 `/health` 向后兼容。

**Requirements:** R5

**Dependencies:** 无

**Files:**

- Modify: `apps/api/src/health/health.controller.ts`
- Modify: `apps/api/src/health/health.controller.spec.ts`

**Approach:**

- `GET /health/live`：仅返回 `{ status: 'ok', timestamp }` 无任何 IO；不需要 JWT guard
- `GET /health/ready`：现有 `health()` 逻辑移入此端点（DB ping + ES health）；返回 `200` 或 `503`（status: degraded 时）
- `GET /health`：保留，委托给 ready 逻辑，保持向后兼容

**Patterns to follow:**

- 现有 `apps/api/src/health/health.controller.ts` 的聚合逻辑

**Test scenarios:**

- Happy path: `GET /health/live` 始终返回 200 `{ status: 'ok' }`，即使 DB/ES 未连接
- Happy path: `GET /health/ready` 在 DB 可达时返回 200
- Error path: `GET /health/ready` 在 DB 不可达时返回 503 `{ status: 'degraded' }`
- Integration: `GET /health`（向后兼容）与 `GET /health/ready` 返回相同结构
- Edge case: `/health/live` 响应时间应 < 10ms（无 IO）

**Verification:**

- 4 个端点测试通过（live 200、ready 200、ready 503-degraded、/health 向后兼容）
- `/health/live` 响应不包含 `db` / `search` 字段

---

- [ ] U3. **M-01 k6 并发压测场景**

**Goal:** 新建 M-01 规格的 k6 脚本（50 并发 / P99 < 800ms / 错误率 < 0.1%），覆盖「登录 → 列出 Listing」两步链，可在本地或 staging 执行并产出存档报告。

**Requirements:** R2

**Dependencies:** U1（flag 服务稳定）

**Files:**

- Create: `scripts/k6/m01-concurrent-sessions.js`
- Modify: `scripts/k6/health-smoke.js`（将阈值从 `p(95)<800` 升为 `p(99)<800`，VU 从 2 升为 10，作为轻量回归）
- Create: `docs/reports/m01-template.md`（压测报告填写模板）

**Approach:**

- 脚本 stages：30s 爬坡到 10 VU → 60s 稳定 50 VU → 30s 降压；总时长 2 min
- 场景步骤：`POST /auth/login`（用预置测试账号）→ `GET /listings?brandId=homtone`
- 阈值：`http_req_duration: ['p(99)<800']`，`http_req_failed: ['rate<0.001']`
- `BASE_URL`、`TEST_USER`、`TEST_PASS` 从 `__ENV` 读取，不硬编码
- 报告模板包含：测试时间、环境、VU 峰值、P50/P95/P99、错误率、是否 PASS

**Patterns to follow:**

- `scripts/k6/health-smoke.js` — 现有 k6 结构和 `__ENV.BASE_URL` 模式
- `scripts/k6-listing-generate.js` — M-02 阈值写法

**Test scenarios:**

- Test expectation: none — 这是负载测试脚本，验证在外部环境执行

**Verification:**

- `k6 run scripts/k6/m01-concurrent-sessions.js --env BASE_URL=http://localhost:4000` 可执行无语法报错
- 脚本注释标明「M-01」指标来源（`docs/yaemartOS-implementation-plan.md §5`）
- `docs/reports/m01-template.md` 存在，含必填字段

---

- [ ] U4. **DB 备份脚本 + 密钥轮转 Runbook**

**Goal:** 提供可一键执行的 Postgres 备份脚本（`pg_dump` 到本地目录）和密钥轮转操作手册，在 S1 alpha 上线前完成至少一次备份演练。

**Requirements:** R3, R4

**Dependencies:** 无

**Files:**

- Create: `scripts/backup-pg.sh`
- Create: `docs/runbooks/w13-secret-rotation.md`
- Create: `docs/runbooks/w13-db-backup.md`

**Approach:**

- `backup-pg.sh`：读 `DATABASE_URL` 环境变量；调用 `pg_dump` 输出到 `backups/yaemartos_$(date +%Y%m%d_%H%M%S).sql.gz`；打印文件路径和 SHA256 校验和；添加注释说明如何上传到 S3/GCS
- `w13-db-backup.md`：本地运行步骤、备份文件存储规范、恢复演练命令（`psql < backup.sql`）、演练签字记录格式
- `w13-secret-rotation.md`：JWT Secret（`openssl rand -base64 32`）轮转步骤 + 零停机双 secret 滚动方案说明；DB password 轮转步骤；Cloudinary / Gemini / 领星 key 轮转链接参考；格式：分步骤操作 + 验收确认项

**Patterns to follow:**

- `scripts/test-e2e-local.sh` — shell 脚本头部 `set -euo pipefail` 约定

**Test scenarios:**

- Test expectation: none — 运维脚本和文档，无自动化测试；演练验收由运维签字

**Verification:**

- `bash scripts/backup-pg.sh` 在本地 dev DB 可执行，输出 `.sql.gz` 文件
- `docs/runbooks/w13-db-backup.md` 和 `w13-secret-rotation.md` 各包含「演练签字记录」格式章节
- Runbook 经 1 名开发者 review，确认步骤可执行

---

- [ ] U5. **S1 Alpha 上线核查清单**

**Goal:** 整合所有 S1 上线前置条件（R1–R5 + 功能验收）为一份可签字的核查清单；提供 alpha 运营反馈表模板；保证 5 人 alpha 试用可结构化启动。

**Requirements:** R6

**Dependencies:** U1, U2, U3, U4

**Files:**

- Create: `docs/runbooks/w13-s1-alpha-launch-checklist.md`
- Create: `docs/runbooks/w13-alpha-feedback-template.md`

**Approach:**

- `w13-s1-alpha-launch-checklist.md` 包含三个阶段：
  - **Pre-launch（T-48h）**：备份演练签字、密钥轮转签字、M-01 压测 PASS 存档、feature flag 配置核查、所有 CI checks 绿、/health/ready 可达
  - **Launch（T-0）**：DB 快照、部署版本标签记录、5 名运营账号权限核查（IAM）、alpha flag 开启（`FEATURE_*_HOMTONE=true`）
  - **Post-launch（T+24h）**：Sentry 无新 Error、运营完成全流程录屏、收集反馈表
- `w13-alpha-feedback-template.md`：5 个评分维度（Listing 生成速度 / 准确度 / 界面易用 / 数据完整度 / 整体满意度，1-5 分）+ 开放问题 + 已知问题说明

**Patterns to follow:**

- `docs/runbooks/w12-homtone-migration-runbook.md` — Runbook 格式参考

**Test scenarios:**

- Test expectation: none — 文档交付物，无自动化测试

**Verification:**

- Checklist 包含 3 个阶段所有必填项（pre / launch / post）
- 每个检查项均有「负责人」和「签字/日期」字段
- Alpha 反馈模板经 1 名运营预审确认格式合理

---

## System-Wide Impact

- **Feature Flag 修改**：`listing.controller.ts` 中 `ConfigService.get('FEATURE_LISTING_AI')` 替换为 `FeatureFlagService.isEnabled()`，行为等同但支持品牌维度；其他模块不受影响
- **健康端点**：`/health/live` 新增（无影响）；`/health/ready` 语义等同于原 `/health`；`/health` 保留向后兼容——已集成到 `scripts/k6/health-smoke.js` 的调用无需修改
- **错误传播**：`/health/live` 绝不传播 DB/ES 错误；`/health/ready` 返回 503 但不抛出异常（K8s readiness 探针识别 5xx）
- **API 表面奇偶性**：无新公开业务端点；仅添加 infra 端点
- **不变量**：现有 `GET /health` 端点的返回结构保持不变（委托到 ready 逻辑）

---

## Risks & Dependencies

| 风险                                                         | 缓解                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| M-01 压测在 dev 机上达标但在 staging 硬件较弱时不达标        | 压测应在 staging 执行；dev 本地作为冒烟；报告应注明执行环境                             |
| 健康端点拆分导致 `/health` 旧版调用方混淆                    | 保留 `/health`，向下兼容；在注释中说明 `/health/live` 和 `/health/ready` 是推荐用法     |
| Feature flag 品牌维度配置错误导致功能对所有品牌开放          | 默认 `false`；未设置任何变量 = 关闭；部署前 checklist 核查                              |
| 备份脚本在生产 Neon 连接失败（非 direct URL 不支持 pg_dump） | 脚本说明应使用 `DIRECT_URL`（非 pooled）；runbook 中说明 Neon 的 direct connection 要求 |
| alpha 运营无法完成全流程（数据不足 / UI 阻塞）               | 准备「已知问题清单」放入反馈模板；pre-launch 阶段 dev 先自测一遍                        |

---

## Documentation / Operational Notes

- 所有 Runbook 文件进版本控制，随代码 PR 一同 review
- `.env.local.example` 补全是上线前必须完成的文档同步；新开发者 onboarding 从这里开始
- S1 alpha 启动后，每日 standby 一名开发者响应 alpha 反馈（T+1 到 T+7 天）

---

## Sources & References

- **Origin document:** [docs/yaemartOS-implementation-plan.md §W13](docs/yaemartOS-implementation-plan.md)
- 现有 k6：`scripts/k6/health-smoke.js`, `scripts/k6-listing-generate.js`
- 现有健康端点：`apps/api/src/health/health.controller.ts`
- 现有 feature flag 使用点：`apps/api/src/listing/listing.controller.ts`
- 指标定义：`docs/yaemartOS-implementation-plan.md §5`（M-01 ~ M-10 表格）
- 参考 Runbook：`docs/runbooks/w12-homtone-migration-runbook.md`
