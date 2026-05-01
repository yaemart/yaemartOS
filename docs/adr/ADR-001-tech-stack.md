# ADR-001：技术选型决策

| 字段     | 取值                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------ |
| 状态     | Accepted                                                                                         |
| 提议日期 | 2026-04-30                                                                                       |
| 决策日期 | _W1 D1 评审通过后填写_                                                                           |
| 决策人   | tech lead + dev #2                                                                               |
| 关联文档 | `docs/yaemartOS-implementation-plan.md` §3 / §3.1 / §3.2；`docs/erd/domain-model.md`（ERD v1.0） |
| 取代     | 无                                                                                               |
| 被取代于 | _v2.x 重大架构变更时新建 ADR-XXX 引用本条_                                                       |

---

## 1. 上下文

yaemartOS 是公司自用（非 SaaS）跨境电商运营系统，服务 38 名运营人员，涵盖 4 品牌 × 多市场 × 多平台。团队规模为 2 名全栈开发者，计划 18 个月（78 周）分 6 切片交付。

需要在 W1 D1 锁定一份完整的技术选型清单，作为后续 78 周不可频繁变更的基础。频繁更换底座对 2 人团队是致命的（参考 §16 风险登记册）。

## 2. 决策

### 2.1 前端

| 选型   | 版本/说明                                        |
| ------ | ------------------------------------------------ |
| 框架   | **Next.js 14**（App Router）                     |
| 语言   | TypeScript（strict 模式）                        |
| UI 库  | **Tailwind CSS** + **shadcn/ui**                 |
| 国际化 | **next-intl**                                    |
| 表单   | react-hook-form + zod                            |
| 状态   | Server Components 优先；客户端 zustand（必要时） |
| 测试   | Vitest（单元）+ Playwright（E2E）                |
| 文档   | Storybook                                        |

### 2.2 后端

| 选型     | 版本/说明                           |
| -------- | ----------------------------------- |
| 框架     | **NestJS**（Node 20 LTS）           |
| 语言     | TypeScript（strict 模式）           |
| ORM      | Prisma                              |
| API 风格 | REST 主体 + GraphQL（运营查询场景） |
| 验证     | class-validator + zod 双轨          |
| 任务队列 | **BullMQ**（Redis backed）          |
| 测试     | Vitest + Supertest                  |

### 2.3 数据层

| 选型          | 版本/说明                                                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 主库          | **PostgreSQL 16**（托管：**Neon**，serverless branching 支持 dev/staging 分支隔离）；运营域 `public` schema + 客户域 4 个 tenant schema（`homtone`/`spoonlemon`/`davivy`/`tysun`，详见 §3 ERD） |
| 缓存          | **Redis 7**（托管：**Upstash**，按请求计费，dev 阶段成本接近零）                                                                                                                                |
| 全文/语义搜索 | **Elasticsearch 8**（含 dense vector 字段）                                                                                                                                                     |
| 向量化        | **Gemini text-embedding-004**                                                                                                                                                                   |

### 2.4 AI

| 选型           | 版本/说明                                                                           |
| -------------- | ----------------------------------------------------------------------------------- |
| 抽象层         | **Vercel AI SDK**（统一 provider 接口、streaming、tool calling、structured output） |
| 国际/多模态    | **Google Gemini 2.5 Pro / 2.5 Flash**（S1 起）                                      |
| 中文/运营      | **智谱 GLM-5 / GLM-4V**（S2 引入）                                                  |
| 图像生成       | Gemini Imagen 3（v2.x 设计图）/ CogView-4（中文场景，v2.x）                         |
| Agent 调用领星 | **MCP**（Model Context Protocol）                                                   |
| Fallback       | S3 引入装饰器（Pro 故障 → Flash）                                                   |
| Cost Tracking  | S2 引入中间件                                                                       |
| Rate Limiting  | S4 引入中间件                                                                       |

> S1 仅 Gemini，**不做** router / fallback / rate limit / cost tracking 任一复杂特性，避免 day-1 over-engineer。

### 2.5 IAM

| 选型    | 版本/说明                                                                          |
| ------- | ---------------------------------------------------------------------------------- |
| 引擎    | **Casbin**（RBAC + ABAC 混合）                                                     |
| 维度    | `userId` / `brand` / `market` / `platform` / `shop` / `category` / `field`（7 维） |
| 登录    | Email + Google OAuth + Facebook OAuth                                              |
| Session | JWT（短期）+ refresh token（长期）                                                 |

### 2.6 基础设施

| 选型     | 版本/说明                                                               |
| -------- | ----------------------------------------------------------------------- |
| 文件存储 | **Cloudinary**（CDN + 图像转换）                                        |
| 监控 S1  | **Sentry**（错误 + 性能 trace）                                         |
| 监控 S2+ | + **PostHog**（产品分析）                                               |
| 监控 S3+ | + **Metabase**（业务指标 dashboard）                                    |
| 监控 S4+ | + 对账 cron（领星数据一致性）                                           |
| 容器     | Docker + docker-compose（dev）                                          |
| 部署目标 | **PaaS — Railway / Fly.io**（staging + prod；S5+ 规模增长时评估迁 K8s） |
| CI       | GitHub Actions（lint + test + build 三 job 并行）                       |
| 密钥     | 1Password 团队 vault；本地 `.env.local`（gitignored）                   |

### 2.7 第三方集成

| 选型   | 版本/说明                                                                       |
| ------ | ------------------------------------------------------------------------------- |
| ERP    | **领星 ERP**（OpenAPI 批量 + MCP Agent 调用）                                   |
| 国内仓 | **NetSuite**（经领星）                                                          |
| 平台   | Amazon SP-API、Walmart Marketplace API（v2.x：Wayfair / Shopify / TikTok Shop） |
| 邮件   | **Resend**（API 简洁，免费额度 100 封/天，React Email 原生支持）                |

## 3. 替代方案与拒绝理由

| 方案                                 | 拒绝理由                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| Remix / Nuxt 替代 Next.js            | 团队 Next.js 经验最深；shadcn/ui 生态围绕 Next.js                               |
| Express / Fastify 替代 NestJS        | 缺企业模式（modules / DI / interceptor），2 人团队难维持纪律                    |
| Drizzle ORM 替代 Prisma              | Prisma 生态成熟；migrate 工具链对 2 人团队更友好                                |
| Anthropic Claude 替代 Gemini         | 已 brainstorm 决定（v1.2 ADR）：海外多模态 Gemini 性价比、长上下文、多语言更优  |
| 自建 RBAC 替代 Casbin                | 7 维 ABAC 复杂，自建坑深                                                        |
| AWS S3 替代 Cloudinary               | Cloudinary 内置图像转换，省去 imgproxy/thumbor 自维护                           |
| Datadog 替代 Sentry+PostHog+Metabase | 月成本 5x；2 人团队预算紧                                                       |
| 完整 Prometheus+Grafana+Loki         | 自托管运维成本太高                                                              |
| Supabase 替代 Neon                   | 内置 Auth/Storage 与自建层重叠；绑定性强，branching 能力弱于 Neon               |
| AWS SES 替代 Resend                  | 需维护 AWS IAM + 域名资质，管理开销高；Resend 开箱即用                          |
| Redis Cloud 替代 Upstash             | 500MB 固定配额；Upstash 按请求计费，dev 阶段几乎免费                            |
| K8s（EKS/GKE）替代 PaaS              | 初期配置成本高（VPC/node pool/ingress）；2 人团队应聚焦产品交付；S5+ 再评估迁移 |

## 4. 后果

### 正面

- 全栈 TypeScript 单语言，降低 context switch
- 大量决策通过托管服务外包（Sentry / Cloudinary / Neon / Upstash / 1Password），运维成本可控
- AI 抽象层延迟到必要切片才上，避免 over-engineer
- 4 schema tenant 架构在合规与开发成本之间取得平衡

### 负面 / 待管理风险

- 多个 SaaS 依赖 → 任一中断会停工（Sentry / Cloudinary / Gemini API / 领星）
- Vercel AI SDK 仍在快速演进 → S2 升级路径需提前评估
- Casbin 7 维策略调试困难 → S1 必须配套策略测试用例

### 一致性约束（不可妥协）

- 所有 LLM 调用必须走 AI Services 层；禁止直连 SDK
- 所有领星调用必须走 `LingxingClient` 中间层（详见 ADR-XXX 待写）
- 所有客户域查询必须强制 tenant schema 过滤
- 所有写操作必须有审计日志（M-10 = 100%）

## 5. 验收

- [ ] 团队 2 人评审通过
- [ ] §3 / §3.1 / §3.2 与本 ADR 内容 1:1 对齐
- [ ] PR 合入 main
- [ ] 锁定 18 个月内除非有 ADR-XXX 显式取代，本表不变
