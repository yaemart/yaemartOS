# yaemartOS 跨境电商运营系统 — 实施方案 v2.0-RC（切片驱动版 / 待签字）

> 更新日期：2026-04-30  
> 状态：**v2.0-RC**（Release Candidate；2026-04-30 决定以 RC 状态启动开发，签字并行推进，详见 §17.1a；签字矩阵见 §17.2）  
> 版本说明：**v2.0 经 brainstorm 重写**为切片驱动 18 个月计划，对应 2 人全栈团队真实产能。  
> 团队：2 名全栈开发者 × 18 个月（78 周）= 156 人周净产出（v1.4 估算工作量 88-114 人周 + 35% 余量）。  
> 节奏：6 个切片（S1–S6），**每 3 个月一个可上线增量**，避免长周期空等。  
> 范围：v1.4 全部范围 **减去** 社媒投流、客服语音、日本市场、Wayfair / Shopify / TikTok Shop 平台（这些放 v2.x 后续迭代）。  
> 决策依据：v1.4 brainstorm 路径 2「完整功能延期」+ 选项 A「2 人 18 个月 S1-S6」。所有早期产品决策（4 品牌客户库独立、A+ 客户中心 MVP、IAM shop 维度、Cloudinary、多 listing+主 listing 部分唯一）继承不变。  
> **AI 抽象层策略**：方案 3+4（**单模型起步 + Vercel AI SDK**）。S1 仅 Gemini，FAQ/菜谱人工填；S2 引入 GLM-5 + cost tracking；S3 加 fallback；S4 加 rate limiting。避免 day 1 over-engineer AI gateway。

---

## 目录

1. [系统概述](#1-系统概述)
2. [指导原则](#2-指导原则)
3. [核心技术选型](#3-核心技术选型)
   - [3.1 AI 模型使用策略](#31-ai-模型使用策略)
   - [3.2 领星 ERP 依赖架构（M3 半镜像策略）](#32-领星-erp-依赖架构m3-半镜像策略)
4. [v2.0 全局里程碑（6 切片）](#4-v20-全局里程碑6-切片)
5. [量化验收基线](#5-量化验收基线)
   - [5.1 指标采集策略（分阶段渐进）](#51-指标采集策略分阶段渐进)
6. [S1（月 1–3）：单品牌闭环](#6-s1月-13单品牌闭环)
7. [S2（月 4–6）：第二品牌 + Walmart](#7-s2月-46第二品牌--walmart)
8. [S3（月 7–9）：北美多语言 + 客户中心 V1](#8-s3月-79北美多语言--客户中心-v1)
9. [S4（月 10–12）：广告闸门 + 供应链 + NetSuite](#9-s4月-1012广告闸门--供应链--netsuite)
10. [S5（月 13–15）：4 品牌全量 + 欧洲市场](#10-s5月-13154-品牌全量--欧洲市场)
11. [S6（月 16–18）：Manual/包装 + 培训考试](#11-s6月-1618manual包装--培训考试)
12. [跨切片日常例行](#12-跨切片日常例行)
13. [关键需求显式验收](#13-关键需求显式验收)
14. [SLA 与 On-Call 规范](#14-sla-与-on-call-规范)
15. [v2.x 后续迭代（v2.0 不含）](#15-v2x-后续迭代v20-不含)
16. [风险登记册](#16-风险登记册)
17. [v2.0-RC 文档冻结与签字](#17-v20-rc-文档冻结与签字)

---

## 1. 系统概述

**yaemartOS** 是公司自用（非 SaaS）跨境电商运营平台，服务 38 名运营人员。

### v2.0 范围（18 个月内交付）

| 模块                         | 简述                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| ① Listing 撰写 & 图片        | Amazon + Walmart，多语言内容生成与审核                                                                                      |
| ② 品牌客服门户 + 客户中心 V1 | 4 品牌独立域名 + **独立客户库**；注册/登录、AI 多语言聊天、工单、多语言手册下载、保修注册、客户中心首页、非登录订单状态查询 |
| ③ Manual & 包装生成          | 多语言用户手册、包装文案 PDF/Word                                                                                           |
| ④ 广告架构创建 & 优化        | Amazon SP/SD/SB、Walmart，人工确认闸门 + 24h 回滚                                                                           |
| ⑤ 培训考试系统               | 课程/题库/考试/权限联动                                                                                                     |
| ⑥ 供应链管理                 | 采购/库存/FBA 入仓/成本追踪 + NetSuite 国内仓 + 在途                                                                        |

### v2.0 维度覆盖

- **品牌**：Homtone / Spoonlemon / Davivy / Tysun（4 品牌全部覆盖）
- **市场**：北美（EN/ES/FR）+ 欧洲（EN/DE/ES/FR/IT）+ 英国（EN）— **不含日本**
- **平台**：Amazon + Walmart — **不含 Wayfair / Shopify / TikTok Shop**
- **数据桥梁**：领星 ERP（对接 Amazon/Walmart + NetSuite）

### 不在 v2.0（延后到 v2.x，见 §15）

- 社媒投流管理（TikTok / Google / Facebook / YouTube 广告）
- 客服语音通话
- 日本市场（JA 语言）
- Wayfair / Shopify / TikTok Shop 平台
- 客户中心 V1.5（订单聚合查询）/ V2（跨平台退换货闭环）

### 团队与节奏

- **团队**：2 名全栈开发者全职
- **总时长**：78 周（约 18 个月）
- **节奏**：6 个切片，每切片 13 周（3 个月），切片末必须有可上线增量
- **试用人数曲线**：S1 末 5 人 alpha → S2 末 12 人 → S3 末 20 人 → S4 末 30 人 → S5 起 38 人全员

---

## 2. 指导原则

### 2.1 Harness Engineering

| 要求                                          | 验证方式               |
| --------------------------------------------- | ---------------------- |
| 功能开关（Feature Flag），支持按品牌/市场灰度 | 每个模块上线前开关测试 |
| 全链路可观测性（结构化日志 + 指标 + 追踪）    | Grafana/ELK 看板       |
| CI/CD 流水线，主干永远可构建                  | CI 绿标强制合并        |
| 生产变更审计（Who/When/What）                 | 审计日志覆盖所有写操作 |
| 回滚预案文档 + 演练记录                       | 每阶段上线前演练一次   |

### 2.2 AI Agent Native

| 要求                                              | 验证方式                           |
| ------------------------------------------------- | ---------------------------------- |
| 能力即工具：MCP / REST 工具与 UI 操作路径一一对应 | Agent 可调通每个 UI 操作对应的 API |
| 自然语言调用路径可审计（调用日志 + 结果快照）     | Agent 调用链日志                   |
| 关键执行必须人工确认闸门（广告写入、批量同步）    | UI 确认弹窗 + 审批记录             |
| AI 生成内容可溯源（source 字段）                  | product_content.source 非空约束    |

### 2.3 领星双通道原则

```
MCP   → AI Agent 触发场景（自然语言查询库存、广告、关键词）
API   → 系统级定时任务（每日凌晨批量同步）
两者共享同一 allowed_shop_ids 配置（店铺范围可配置，非全量）
```

---

## 3. 核心技术选型

> 技术选型在 W1 D1 确认并写入 ADR（Architecture Decision Record），后续变更须评审。

| 层                                | 选型                                                                     | 说明                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **前端**                          | Next.js 14 (App Router) + TypeScript                                     | 管理后台 + 客服门户复用同框架                                                                        |
| **UI 组件**                       | Tailwind CSS + shadcn/ui                                                 | 品牌主题通过 CSS 变量注入                                                                            |
| **国际化**                        | next-intl                                                                | 绑定 Market × Language 组合                                                                          |
| **后端**                          | NestJS (Node.js) + TypeScript                                            | 模块化，契合 IAM/MCP 扩展                                                                            |
| **API 风格**                      | REST（主）+ GraphQL（产品内容复杂查询）                                  | —                                                                                                    |
| **AI SDK 统一层**                 | Vercel AI SDK                                                            | 统一 provider 接口、streaming、tool calling、structured output、cost tracking hooks；2026 年事实标准 |
| **AI 调用（国际/多模态，S1 起）** | Google Gemini 2.5 Pro / 2.5 Flash（经 Vercel AI SDK）                    | 多语言生成、多模态、超长上下文、实时回复；见 §3.1                                                    |
| **AI 调用（中文/运营，S2 起）**   | 智谱 GLM-5（OpenAI 兼容 endpoint，经 Vercel AI SDK）                     | S2 起加入；中文运营场景、广告建议单、培训内容；见 §3.1                                               |
| **文本向量化**                    | Gemini text-embedding-004                                                | ES 语义搜索向量                                                                                      |
| **数据库**                        | PostgreSQL（主业务）+ Redis（缓存/会话）+ Elasticsearch（全文/语义搜索） | —                                                                                                    |
| **任务队列**                      | BullMQ (Redis-backed)                                                    | 异步 AI 生成、领星同步任务                                                                           |
| **IAM**                           | Casbin（RBAC + ABAC 混合）                                               | Policy 维度：userId / brand / market / platform / **shop** / category / field                        |
| **文件存储**                      | Cloudinary                                                               | Manual PDF、包装文件、图片素材；内置 CDN + 图像转换（压缩/裁剪/格式转换），统一资产管理              |
| **监控**                          | OpenTelemetry → Grafana / ELK                                            | 结构化日志 + 链路追踪                                                                                |
| **部署**                          | Docker Compose（dev）→ K8s 或托管 PaaS（staging/prod）                   | 按团队运维能力选择                                                                                   |

---

### 3.1 AI 模型使用策略

> **设计原则**：Gemini 负责「面向市场的多语言内容生成与多模态理解」；GLM-5 负责「面向运营团队的中文场景与国内电商知识」。两者通过 **Vercel AI SDK** 统一封装。  
> **v2.0 渐进引入节奏（关键）**：
>
> - **S1**：仅 Gemini Pro + Flash + Embedding；FAQ/菜谱**人工填**（推迟 AI 生成到 S2）
> - **S2**：加入 GLM-5（OpenAI 兼容 endpoint）+ cost tracking 中间件
> - **S3**：加 Fallback（Gemini Pro 失败 → Flash；客户中心 chat 可靠性）
> - **S4**：加 Rate limiting（广告建议高峰期分模型独立桶）
>
> 这样避免 1-2 人小团队 day 1 over-engineering AI gateway，每次抽象升级都由真实业务场景驱动。

#### 模型特点速览

| 模型                          | 核心优势                                                                                       | 局限                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Gemini 2.5 Pro**            | 超长上下文（100 万 token）、多模态（图片/文档）、欧洲多语言（DE/FR/ES/IT）+ 日语最强、推理深度 | 成本相对较高；实时场景建议用 Flash |
| **Gemini 2.5 Flash**          | 超低延迟（< 1s）、成本最优、工具调用能力强                                                     | 复杂推理/长文档不如 Pro            |
| **Gemini text-embedding-004** | 与 Gemini 生态统一的高质量语义向量                                                             | —                                  |
| **GLM-5**                     | 中文理解/生成最优、国内电商运营术语（ACOS/SKU/FBA）原生理解、国内合规                          | 欧洲语言和日语能力弱于 Gemini      |
| **GLM-4V**                    | 支持图像输入的中文多模态                                                                       | —                                  |
| **CogView-4**                 | 中文提示词文生图，适合国内审美偏好场景                                                         | 英文市场图片建议用 Gemini Imagen   |

#### 场景分配总表

| 业务场景                                     | 使用模型                  | 理由                                                            |
| -------------------------------------------- | ------------------------- | --------------------------------------------------------------- |
| **Listing 生成（EN/DE/FR/ES/IT）**           | Gemini 2.5 Pro            | 欧洲多语言原生生成质量最高；长上下文容纳完整品类词库 + 竞品数据 |
| **Listing 生成（JA 日语）**                  | Gemini 2.5 Pro            | 日语在 Gemini 体系内质量显著优于其他中文模型                    |
| **竞品链接/图片解析**                        | Gemini 2.5 Pro（Vision）  | 多模态读取竞品页面截图 + 长文档理解竞品详情页                   |
| **路径 A：领星 Listing 字段结构化提取**      | Gemini 2.5 Flash          | 快速结构化提取英文 listing 字段，低延迟、成本优                 |
| **Manual 多语言生成（各市场版本）**          | Gemini 2.5 Pro            | 长文档（用户手册可达数万字）+ 多语言 + 安全法规段落生成         |
| **包装文案（英文 / 欧洲语言版本）**          | Gemini 2.5 Pro            | 多语言合规文案，与 Manual 同源数据                              |
| **AI 客服实时文字回复**                      | Gemini 2.5 Flash          | P95 延迟 < 1s，满足实时聊天体验                                 |
| **ES 知识库向量化（文本嵌入）**              | Gemini text-embedding-004 | 与 Gemini 生态统一，避免跨平台向量不兼容                        |
| **图片需求单辅助文生图（英文市场）**         | Gemini Imagen 3           | 英文 prompt 生成效果好；与 Gemini 统一调用入口                  |
| **FAQ / 菜谱生成（运营配置界面，中文输入）** | GLM-5                     | 品类 FAQ 和菜谱由中文运营人员输入关键词后扩写，GLM 中文质量更高 |
| **广告优化建议单（中文输出）**               | GLM-5                     | ACOS/竞价/关键词等国内电商运营术语原生理解；建议单需中文可读    |
| **培训课程内容生成（中文）**                 | GLM-5                     | 38 名运营人员的培训内容全部中文，GLM 中文表达更地道             |
| **题库自动生成（中文题目）**                 | GLM-5                     | 中文单选/多选/简答题出题质量优                                  |
| **供应链分析报告（内部中文报告）**           | GLM-5                     | 库存预警、采购建议等内部报告均为中文                            |
| **包装文案（中文说明书/中文警示语）**        | GLM-5                     | 中文包装及出口产品中文说明                                      |
| ~~社媒投流报告摘要~~                         | ~~GLM-5~~                 | v2.0 不含社媒投流，延后至 v2.x                                  |
| **MCP Agent 自然语言工具调用**               | Gemini 2.5 Flash          | 工具调用（Function Calling）响应快，领星数据查询实时性要求高    |
| **图片需求单辅助文生图（中文概念图）**       | CogView-4                 | 中文 prompt 生成场景图概念稿，适合向国内设计团队传达            |

#### AI 抽象层架构（渐进式，v2.0 修订）

```
┌─────────────────────────────────────────────────┐
│         AI Services 层（NestJS Service）          │
│  - listingGenerationService(input, locale)        │
│  - chatReplyService(message, context)             │
│  - mcpToolCallService(tool, args)                 │
│  - structuredExtractionService(text, schema)      │
│  - faqGenerationService(category, product)  [S2+] │
│  - adAdviceService(report)                  [S2+] │
│                                                   │
│  增强能力（按切片渐进添加）：                     │
│  S2: cost tracking 中间件                        │
│  S3: fallback（装饰器模式）                      │
│  S4: rate limiting（分模型独立桶）               │
└──────────────┬──────────────────────────────────┘
               │
        Vercel AI SDK
               │
    ┌──────────┴──────────┐
    │                     │
 Gemini Provider       GLM-5 Provider
 (S1 起)              (S2 起，OpenAI 兼容)
```

**S1 W1 D1 ADR 内容**（最小化）：

- 选型：Vercel AI SDK + Google Provider
- AI Services 层封装策略（每场景一个 service function，输入输出 typed）
- 不实现 router / fallback / rate limit / cost tracking（推迟到 S2-S4）
- FAQ/菜谱生成场景在 S1 不实现 AI（人工填，alpha 5 人接受）

#### API Key 与环境管理（按切片引入）

**S1 起需要**：

| 环境变量             | 说明                                                             |
| -------------------- | ---------------------------------------------------------------- |
| `GEMINI_API_KEY`     | Google AI Studio key（dev/staging）或 Vertex AI 服务账号（prod） |
| `GEMINI_MODEL_PRO`   | `gemini-2.5-pro`（可版本锁定）                                   |
| `GEMINI_MODEL_FLASH` | `gemini-2.5-flash`                                               |
| `GEMINI_EMBED_MODEL` | `text-embedding-004`                                             |

**S2 起新增**：

| 环境变量       | 说明                                                   |
| -------------- | ------------------------------------------------------ |
| `GLM_API_KEY`  | 智谱 BigModel API key（OpenAI 兼容 endpoint）          |
| `GLM_BASE_URL` | `https://open.bigmodel.cn/api/paas/v4/`（OpenAI 兼容） |
| `GLM_MODEL`    | `glm-4-plus` 或 `glm-4-long`                           |

**v2.x 后续**（不在 v2.0 内）：

| 环境变量        | 说明                                       |
| --------------- | ------------------------------------------ |
| `COGVIEW_MODEL` | `cogview-4`（中文文生图，v2.x 设计图场景） |

> 所有 key 存储在 Secret Manager（不得写入代码仓库），本地开发通过 `.env.local`（已加入 `.gitignore`）。

### 3.2 领星 ERP 依赖架构（M3 半镜像策略）

**总体定位**：领星是 source of truth，yaemartOS 按数据使用场景采用差异化镜像/缓存/透传策略，不做全镜像也不做纯透传。

#### 数据分类与策略

| 数据类别                 | 使用场景                           | 策略                                    | 频率/TTL            | 落地切片 |
| ------------------------ | ---------------------------------- | --------------------------------------- | ------------------- | -------- |
| 客户中心订单查询         | 非登录用户用订单号+邮箱查状态      | 透传 + Redis cache                      | 5 min               | S3       |
| Listing 元数据           | 运营编辑时引用 ASIN 标题/类目/属性 | 半镜像（webhook 增量 + 兜底每小时拉取） | 1h                  | S2       |
| 库存（实时操作页面）     | 运营编辑/调拨实时查询              | 透传 + 短 cache                         | 1 min               | S4       |
| 库存（看板/报表）        | 历史趋势、滞销分析                 | 快照同步                                | 1h                  | S4       |
| 广告数据（30/60/90 天）  | 广告优化建议、ROI 分析             | **全镜像**                              | 每日凌晨拉昨日      | S4       |
| NetSuite 国内仓库存/在途 | 跨平台分配决策                     | **全镜像**                              | 每日 + 关键变更触发 | S4       |
| AI Agent 单次工具调用    | Agent 即时操作（创建广告、改价等） | MCP 直接透传                            | 无 cache            | S1+      |

#### 降级状态机（SLO 分级）

| 等级   | 触发条件（领星 API 错误率） | 系统行为                                                                                      | 告警    |
| ------ | --------------------------- | --------------------------------------------------------------------------------------------- | ------- |
| 正常态 | < 1%                        | 正常运行                                                                                      | 无      |
| 降级 1 | 1-5%                        | 缓存 TTL 自动延长 4x                                                                          | P3 通知 |
| 降级 2 | 5-20%                       | 关键写操作进 BullMQ 队列；UI 显示"数据更新中"                                                 | P2      |
| 降级 3 | > 20%                       | 客户中心订单查询禁用；显示"数据源暂时不可用，最近同步 XX:XX"；广告/库存看板切换为本地镜像数据 | P1      |
| 中断   | API 完全不可达              | 镜像数据持续可用 + 24h Stale Cache fallback；新写入入队等恢复                                 | P0      |

#### 关键约束

- **任何调用领星 API 的代码必须走统一的 `LingxingClient` 中间层**，禁止绕过（lint 规则 + code review 强制）
- 中间层内置：限流（1 req/s 令牌桶）、重试（指数退避，max 3 次）、错误率埋点（用于状态机判定）、cache 装饰器、降级旁路
- 所有镜像表带 `synced_at` / `source_version` 字段；UI 显示"数据时间"提示用户新鲜度
- 每个使用领星数据的功能模块必须明确声明其策略类别（在 ADR 里）

#### 落地里程碑

| 切片 | 领星集成增量                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------- |
| S1   | LingxingClient 中间层骨架（透传 + cache + 限流 + 错误埋点）；Listing 元数据半镜像（路径 A 用） |
| S2   | 错误率埋点接入告警；客户中心订单查询透传 + cache（提前预热下切片）                             |
| S3   | 客户中心订单查询正式上线；降级 UI 提示文案                                                     |
| S4   | 广告数据 + NetSuite 全镜像同步任务；库存双策略（实时 vs 看板）；完整降级状态机 + P0/P1 告警    |
| S5+  | 镜像表数据治理（清理、压缩、归档）                                                             |

---

## 4. v2.0 全局里程碑（6 切片）

> **核心节奏原则**：每个切片末（S1/S2/.../S6 结束周）必须交付一个**可上线、可被运营试用**的增量。不允许某切片"为下一个切片打基础但本身不上线"。

| 切片                            | 周次    | 月份     | 核心交付                                                                                                                          | 上线后试用       |
| ------------------------------- | ------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **S1 单品牌闭环**               | W1–W13  | 月 1-3   | IAM 基础 + 数据模型 + 前端 shell + 品类库 + 产品中心（路径 B）+ 领星只读 + ES + Listing MVP（**Homtone × 美国 × Amazon × 英文**） | 5 人 alpha       |
| **S2 第二品牌 + Walmart**       | W14–W26 | 月 4-6   | 多品牌切换 + Walmart 适配 + 多平台字段规则 + 路径 A（领星 → 产品档案）+ 存量数据迁移（**+ Spoonlemon、+ Walmart**）               | 12 人 beta       |
| **S3 北美多语言 + 客户中心 V1** | W27–W39 | 月 7-9   | Locale 模型 + 多语言 Listing（EN/ES/FR）+ 术语库 + 客户中心 V1 全套（注册/chat/工单/手册/保修/首页/非登录订单查询）               | 20 人            |
| **S4 广告闸门 + 供应链**        | W40–W52 | 月 10-12 | 广告报告同步 + 看板 + AI 优化建议 + 执行闸门 + 24h 回滚 + 供应链多仓视图 + NetSuite + FBA 入仓计划 + 采购单                       | 30 人            |
| **S5 4 品牌 + 欧洲市场**        | W53–W65 | 月 13-15 | 4 品牌完整配置（Davivy + Tysun 加入）+ 欧洲市场（DE/IT 加入，EN/FR/ES 复用）+ 英国市场 + IAM 全权限矩阵回归                       | 38 人全员        |
| **S6 Manual/包装 + 培训**       | W66–W78 | 月 16-18 | 多语言 Manual 生成（Gemini Pro）+ 包装文案 + 法规模板（CE/FCC/UL）+ 培训课程 + 题库 + 在线考试 + 权限联动                         | 38 人 + 完整培训 |

### 切片间依赖关系

```
S1 → S2: 多品牌 IAM 必须在 S2 开始前 ready
S1 → S3: ES 集群、Locale 数据模型在 S1 已建好（即使只用 EN）
S3 → S4: 客户中心运行稳定后再做广告执行闸门（避免同期复杂度）
S4 → S5: 4 品牌扩展前广告/供应链运行稳定（避免数据迁移复杂度）
S5 → S6: 全市场配置稳定后做 Manual/培训（这两项不阻塞业务运营）
```

---

## 5. 量化验收基线

> 所有"完成标准"引用此表中的指标编号。

| 编号 | 指标                        | 基线值                                                                    |
| ---- | --------------------------- | ------------------------------------------------------------------------- |
| M-01 | 并发登录（38 人场景）       | 50 并发，P99 < 800ms，错误率 < 0.1%                                       |
| M-02 | Listing 生成端到端延迟      | P95 < 15s（含 LLM 调用）                                                  |
| M-03 | AI 客服命中率（无需转人工） | ≥ 65%（100 条测试问题）                                                   |
| M-04 | 领星库存同步误差            | 数量误差 = 0                                                              |
| M-05 | 领星广告花费同步误差        | ≤ 0.1%                                                                    |
| M-06 | Listing 盲审评分（5 分制）  | 平均 ≥ 3.5 分                                                             |
| M-07 | 产品信息导入准确率          | ≥ 95%（运营逐条确认）                                                     |
| M-08 | ES 语义搜索召回率           | Top-3 覆盖 ≥ 70%（测试问题集）                                            |
| M-09 | 广告变更可回滚窗口          | 24h 内单次操作可回滚                                                      |
| M-10 | 审计日志覆盖率              | 关键写操作 100%                                                           |
| M-11 | 客户中心保修注册成功率      | ≥ 95%（表单提交 → 邮件确认到达）                                          |
| M-12 | 非登录订单查询防爆破        | 同 IP 10 次/h 限流；3 次失败触发 CAPTCHA                                  |
| M-13 | 4 品牌客户库隔离            | 跨品牌 0 数据泄漏（同邮箱可在 4 品牌各注册一个独立账户）                  |
| M-14 | 切片末上线达成率            | 每个切片末（S1-S6）必须有可上线增量；延期 ≤ 1 周可接受，> 1 周触发 review |
| M-15 | 试用人数曲线达成            | S1=5 / S2=12 / S3=20 / S4=30 / S5=38 / S6=38（误差 ≤ 20%）                |
| M-16 | Bus factor 应对             | 任一开发者 2 周连续不在岗，另一人可独立交付当前切片                       |

### 5.1 指标采集策略（分阶段渐进）

**总体方针**：与切片节奏对齐，每个切片只引入当前必要的采集工具，避免 day 1 over-engineer。预计月成本 $30 起步、$80 收口。

#### 工具栈引入节奏

| 切片 | 新增工具                                                         | 启用指标                         | 月增成本 |
| ---- | ---------------------------------------------------------------- | -------------------------------- | -------- |
| S1   | **Sentry**（错误+性能 trace）+ **Postgres SQL 视图**（业务查询） | M-01 / M-02 / M-06 / M-07 / M-10 | ~$30     |
| S2   | **PostHog 自托管**（产品分析）+ **cron 对账框架**（占位）        | M-08 / M-15；M-16 演练启动       | ~$15     |
| S3   | **Metabase**（业务指标可视化）+ 客户中心专项埋点                 | M-03 / M-11 / M-12 / M-13        | ~$15     |
| S4   | 完成广告/库存对账 cron + 完整业务 dashboard                      | M-04 / M-05 / M-09               | ~$10     |

#### 每指标采集明细

| 指标                  | 数据来源                                  | 采集工具                                 | 计算频率                  | 引入切片 |
| --------------------- | ----------------------------------------- | ---------------------------------------- | ------------------------- | -------- |
| M-01 并发登录         | 应用 trace + k6 负载测试                  | Sentry Performance + k6                  | 上线前 / 大版本           | S1       |
| M-02 Listing 生成延迟 | AI 调用 wrapper 计时埋点                  | Sentry Performance + Postgres metrics 表 | 实时 dashboard + 每日 P95 | S1       |
| M-03 AI 客服命中率    | 离线评测集（100 题）+ 真实会话采样        | 评测脚本 + 人工标注表                    | 每周                      | S3       |
| M-04 库存同步误差     | 领星 API vs 本地镜像对账                  | cron 每日凌晨                            | 每日                      | S4       |
| M-05 广告花费同步误差 | 领星广告数据 vs 平台原始                  | cron 每日                                | 每日                      | S4       |
| M-06 Listing 盲审评分 | 运营 5 人盲审打分                         | 表单 + Postgres                          | 每切片末                  | S1       |
| M-07 产品导入准确率   | 路径 A 抽样核对                           | 运营签字表 + Postgres                    | 每个新品类                | S1       |
| M-08 ES 召回率        | 测试问题集 Top-3 命中率                   | 评测脚本                                 | 每月                      | S2       |
| M-09 广告回滚窗口     | reverse 接口 E2E 测试                     | E2E 自动化                               | 每发布                    | S4       |
| M-10 审计日志覆盖率   | 代码扫描 + 关键写接口清单对比             | CI lint + 抽测                           | 每发布                    | S1       |
| M-11 保修注册成功率   | warranty_registration 状态 + 邮件 webhook | Postgres 视图                            | 每周                      | S3       |
| M-12 防爆破           | 非登录查询接口限流日志                    | 应用 metrics                             | 实时告警                  | S3       |
| M-13 客户库隔离       | schema 隔离测试 + 跨 tenant 查询审计      | 自动化测试                               | 每发布                    | S3       |
| M-14 切片末上线达成   | 切片末 review 会议记录                    | 人工填表                                 | 每切片                    | 全程     |
| M-15 试用人数曲线     | PostHog 月活                              | PostHog                                  | 每月                      | S2       |
| M-16 Bus factor       | 模拟演练（一人请假 2 周）                 | 演练记录                                 | 每切片 1 次               | S2+      |

> 详细落地工作项见各切片周次任务表（S1 W1 / S2 W14 / S3 W31 / S4 W43 起新增"指标采集"行）。

---

## 6. S1（月 1–3）：单品牌闭环

> **切片目标**：Homtone × 美国 × Amazon × 英文，端到端跑通：登录 → 建品类 → 建产品 → 拉领星 listing 摘要 → 生成 Listing → 审核 → 主 listing 标记。  
> **切片末交付（W13 末）**：5 名运营 alpha 试用，可在系统里完成上述完整链路。

### W1：项目初始化（前后端并行）

> **W1 五天拆解**详见下方 D-1 / D1-D5 子清单；下表为 W1 末验收标准汇总。

| 实施内容                                                                                                                                   | 完成标准                                                   | 校验办法                   |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------- |
| Monorepo + ESLint/Prettier/Husky + CI（lint/test/build）                                                                                   | 主干可构建                                                 | CI 绿                      |
| 技术选型 ADR（含 §3 全部决策、Cloudinary、**AI Services 层 + Vercel AI SDK**，**不实现** router/fallback/rate limit/cost tracking）        | 团队评审通过                                               | ADR 入库                   |
| AI Services 层骨架：`listingGenerationService` / `mcpToolCallService` / `structuredExtractionService`（仅接口定义 + Gemini Provider 配置） | TypeScript 接口定义 + 1 个 service 跑通 hello world        | 单元测试                   |
| 前端：Next.js 14 App Router + Storybook + 设计 token                                                                                       | Storybook 可跑基础组件                                     | 浏览器无报错               |
| dev/staging Docker Compose；结构化日志 + `/health`                                                                                         | 一键启动                                                   | curl 验证                  |
| **指标采集 S1 启用**：Sentry SDK 接入（前后端）+ Postgres `metrics` 表 schema（M-02 / M-06 / M-07 用）+ k6 脚本骨架（M-01）                | Sentry 可见首条 trace；metrics 表 DDL 入库；k6 hello-world | Sentry dashboard + DB 验证 |

#### D-1（W1 之前一周）行政准备清单

| 项                                                | 责任人     | 完成定义                                |
| ------------------------------------------------- | ---------- | --------------------------------------- |
| GitHub Organization + 私有 repo `yaemartOS` 创建  | tech lead  | 2 人 admin 权限                         |
| Google Cloud 项目 + Gemini API key 申请           | tech lead  | 测试 key 调通 `gemini-2.5-flash`        |
| Sentry 账号（free tier）+ project 创建            | dev #2     | DSN 拿到手                              |
| Cloudinary 账号（free 25 credit/月）              | dev #2     | API key + cloud_name 入库               |
| PostgreSQL 托管选型（Neon / Supabase / 自托管）   | 双人讨论   | 1 个 dev DB + 1 个 staging DB 可连      |
| Redis 托管选型（Upstash free / Redis Cloud free） | dev #2     | URL 可连                                |
| 1Password 团队 vault（密钥共享）                  | tech lead  | 全部上述密钥入库；`.env.local` 模板共享 |
| 领星 OpenAPI 凭证申请（公司行政流程）             | 运营对接人 | dev 收到测试账号                        |

> **风险检查点**：D-1 没完成前不启动 W1 D1，否则 dev 因等密钥停工。

#### D1（周一）—— 仓库 & ADR

| 时段 | 任务                                                                                                              | 完成定义                              |
| ---- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| AM-1 | pnpm workspace 初始化（`apps/web`, `apps/api`, `packages/shared-types`, `packages/eslint-config`, `packages/db`） | `pnpm install` 跑通                   |
| AM-2 | ESLint + Prettier + Husky pre-commit + commitlint                                                                 | `git commit` 走完 hook                |
| PM-1 | ADR-001：技术选型决策（§3 全部锁定）                                                                              | `docs/adr/ADR-001-tech-stack.md` 入库 |
| PM-2 | ADR-002：分支策略（trunk-based + feature flag）+ 命名约定                                                         | 入库                                  |
| PM-3 | README 骨架 + CONTRIBUTING.md + 第一个 PR 走通                                                                    | PR 合入 main                          |

#### D2（周二）—— CI + 后端骨架

| 时段 | 任务                                                             | 完成定义                     |
| ---- | ---------------------------------------------------------------- | ---------------------------- |
| AM-1 | GitHub Actions CI（lint + typecheck + test + build；3 job 并行） | CI 绿                        |
| AM-2 | NestJS init + ConfigService + dotenv + 结构化日志（pino）        | `pnpm dev:api` 启动          |
| PM-1 | Prisma 初始化 + DB schema 第一版（User / Brand 占位）            | `prisma migrate dev` 成功    |
| PM-2 | `/health` 接口 + Sentry SDK 接入（后端）                         | Sentry 见到首条 trace        |
| PM-3 | Docker Compose（postgres + redis + api + web）                   | `docker-compose up` 一键启动 |

#### D3（周三）—— 前端骨架

| 时段 | 任务                                                                 | 完成定义            |
| ---- | -------------------------------------------------------------------- | ------------------- |
| AM-1 | Next.js 14 App Router + TypeScript strict                            | `pnpm dev:web` 启动 |
| AM-2 | Tailwind CSS + shadcn/ui 初始化（Button/Input/Card/Dialog 4 组件）   | 浏览器可见          |
| PM-1 | 设计 token：色板 / spacing / typography（CSS 变量 + Tailwind theme） | Storybook 可见      |
| PM-2 | Storybook + 2 个 story（Button/Card）                                | Storybook 启动      |
| PM-3 | next-intl 初始化（即便 S1 仅 EN，预埋 locale 切换）                  | `/en` 路由可访问    |

#### D4（周四）—— AI Services 层 + Cloudinary

| 时段 | 任务                                                                                                                               | 完成定义                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| AM-1 | AI Services 层骨架：3 个 service 类（`listingGenerationService` / `mcpToolCallService` / `structuredExtractionService`）的接口定义 | TypeScript 类型导出          |
| AM-2 | Vercel AI SDK 安装 + Gemini Provider（仅 Pro + Flash）                                                                             | `pnpm add ai @ai-sdk/google` |
| PM-1 | `listingGenerationService.helloWorld()`：调 Gemini Flash 返回 "Hello yaemartOS"                                                    | 单元测试通过                 |
| PM-2 | Cloudinary SDK 接入（后端上传 + 前端展示）                                                                                         | 上传 1 张图成功 + CDN 访问   |
| PM-3 | Postgres `metrics` 表 schema（M-02 / M-06 / M-07 用）+ k6 hello-world 脚本                                                         | DDL 入库 + k6 跑通           |

#### D5（周五）—— 集成 & 复盘

| 时段 | 任务                                                          | 完成定义       |
| ---- | ------------------------------------------------------------- | -------------- |
| AM-1 | 端到端冒烟：前端调后端 `/health`、调 `helloWorld()`、上传图片 | 浏览器全链路通 |
| AM-2 | E2E 测试框架（Playwright）+ 1 条冒烟用例                      | CI 跑通        |
| PM-1 | W1 sprint 回顾 + W2 排期对齐                                  | 复盘文档入库   |
| PM-2 | Sentry 错误/trace 验证 + dashboard 配置                       | 各类错误可定位 |
| PM-3 | W1 demo 录屏给运营 PM 看，对齐期望                            | 录屏入云盘     |

> **节奏纪律**：每天 16:00 站会 5 分钟；任意单项卡住 > 4 小时立即 pair；周五前完不成 D-1 行政事项就推迟 W1 启动。

### W2：领域模型 + 数据库

| 实施内容                                                                                                                                                                                                                                                                                                                                                                     | 完成标准                                                                       | 校验办法                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------- |
| ERD：(运营域 `public` schema) Category / CategoryContentTemplate / Product / Brand / Market / Article / **Listing**(`platform_listing_id`, `is_primary`, `traffic_strategy`) / **ListingVersion**(版本快照子表) / Platform / Shop / ShopBinding；(客户域 4 个 tenant schema：`homtone`/`spoonlemon`/`davivy`/`tysun`) Customer / WarrantyRegistration / OrderLookup / Ticket | ERD 评审通过；TypeScript 类型与 DB schema 一致；运营域与客户域 schema 边界清晰 | 评审 checklist + schema 隔离测试 |
| `product_content.source` 枚举 + 状态机文档                                                                                                                                                                                                                                                                                                                                   | 类型定义一致                                                                   | 单元测试                         |
| **Listing 双重唯一约束**：(1) `(platform_id, shop_id, platform_listing_id)` 全局唯一（平台真实 ID 不重复）；(2) `(product_id, brand_id, market_id, platform_id, shop_id, language) WHERE is_primary = true` 部分唯一（每个组合最多一条主 listing）                                                                                                                           | DB 约束生效；约束违反测试通过                                                  | 约束违反测试 + 多条并存验证      |
| `traffic_strategy` 枚举：`primary` / `variant` / `bundle` / `keyword_grab` / `seasonal` / `cohort_test` —— 运营按"战术意图"标注每条 listing                                                                                                                                                                                                                                  | 枚举完整；UI 下拉可选                                                          | 单元测试                         |
| `Listing.status` 枚举：`draft` / `review` / `approved` / `published` / `paused` / `archived`                                                                                                                                                                                                                                                                                 | 状态流明确                                                                     | 单元测试                         |
| `ListingVersion` 子表：`listing_id`, `version_number`, `content_snapshot`(Title/Bullets/Desc/A+/Backend Keywords), `status`(draft/active/archived), `created_by`, `created_at`, `published_at` —— 同一 listing 多版本管理（草稿协作、历史回退）                                                                                                                              | 一个 listing 可有多 version，仅一个 active                                     | 集成测试                         |

### W3：IAM 基础（Casbin）

| 实施内容                                                                           | 完成标准                           | 校验办法                       |
| ---------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------ |
| Email + Google OAuth + Facebook OAuth；管理员邀请制                                | 三种登录可用；邀请链路端到端       | 安全审查（CSRF、redirect URI） |
| Casbin 策略：`userId / brand / market / platform / shop / category / field` 7 维度 | 策略加载；典型 deny/allow 单元测试 | 自动化策略表测试               |
| 数据层 field mask；审计日志（M-10）                                                | 关键写操作 100% 有日志             | 抽检                           |

### W4：前端 shell + ES 初始化

| 实施内容                                                                                      | 完成标准                          | 校验办法        |
| --------------------------------------------------------------------------------------------- | --------------------------------- | --------------- |
| 管理后台 shell（侧边栏 + 路由 + 权限守卫 + 品牌主题 CSS 变量）                                | 路由权限与 IAM API 联通；403 页面 | E2E 权限守卫    |
| ES 集群（dev 单节点，staging 3 节点）+ 产品内容 index schema（含 locale 字段，即便 S1 只 EN） | 健康检查绿；可写入                | curl 测试       |
| Cloudinary 接入（上传/转换 API + CDN 配置）                                                   | 图片上传成功；带 brand 文件夹隔离 | 上传 + 访问验证 |

### W5：品类库 + 模板继承

| 实施内容                                                               | 完成标准          | 校验办法 |
| ---------------------------------------------------------------------- | ----------------- | -------- |
| Category CRUD：规格参数、功能词、卖点、FAQ、菜谱（"是否需要菜谱"开关） | CRUD + 版本时间戳 | API 测试 |
| 品类继承管线：新建 product_content 时 source=category_inherit          | 一键继承          | 快照比对 |

### W6：产品中心 路径 B（FAQ/菜谱人工填，AI 生成推迟到 S2）

| 实施内容                                                                             | 完成标准         | 校验办法 |
| ------------------------------------------------------------------------------------ | ---------------- | -------- |
| 产品创建表单（规格参数、品牌关联、品类关联、市场关联）                               | 可创建产品       | E2E      |
| FAQ/菜谱**人工填**输入框（继承品类模板默认值，支持运营覆盖编辑）；source=manual 入库 | 可创建+编辑+保存 | E2E      |
| 产品列表 + 详情前端（含 source 标签三色区分；S1 仅出现 category_inherit 与 manual）  | UI 可演示        | 视觉验收 |
| ⚠️ **AI 生成 FAQ/菜谱（GLM-5）推迟到 S2 W14**（v2.0 决策：S1 单模型起步）            | —                | —        |

### W7：领星 OpenAPI（凭证 + 店铺过滤）

| 实施内容                                                                  | 完成标准                         | 校验办法           |
| ------------------------------------------------------------------------- | -------------------------------- | ------------------ |
| 与领星技术对接清点能力清单（**v1.4 信任决策**：W7 前完成字段+写权限确认） | 清单文档入库                     | 与领星技术联调记录 |
| ShopBinding 管理界面：勾选同步店铺范围                                    | 仅绑定店铺生成同步任务           | 自动化测试         |
| 领星 API 凭证（IP 白名单 5 IP） + 限流告警                                | staging 鉴权成功                 | 模拟超量           |
| 库存 / Listing 摘要拉取（只读）                                           | 与领星后台抽样 5 条误差满足 M-04 | 对账脚本           |

### W8：领星 MCP 封装

| 实施内容                                                                              | 完成标准                 | 校验办法 |
| ------------------------------------------------------------------------------------- | ------------------------ | -------- |
| MCP 工具集（库存查询、Listing 摘要、关键词/广告表现 — **Gemini 2.5 Flash** 工具调用） | Agent 可调通所有只读工具 | 对话日志 |
| MCP 调用审计                                                                          | 每次调用有日志           | 日志查询 |
| MCP 与 OpenAPI 共享 allowed_shop_ids                                                  | 无 ID 混乱               | 集成测试 |

### W9–W10：Listing MVP（英语 / Amazon）

| 实施内容                                                                                                     | 完成标准                                                | 校验办法                |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------- |
| 输入管道：竞品 URL 解析 + 人工卖点 + 品类词库 + 领星关键词                                                   | 四路输入合并进 prompt                                   | 集成测试                |
| Listing 生成（**Gemini 2.5 Pro** EN 直接生成）：Title/Bullets/Desc/A+/Backend Keywords，适配 Amazon 字符上限 | 字符规则单元测试 100% 覆盖                              | CI                      |
| 状态流（v2.0）：`draft → review → approved → published → paused → archived`；主 listing 升降级审计           | 角色权限正确；约束生效                                  | 集成测试 + 约束违反测试 |
| **双重唯一约束生效**：(1) 平台 listing ID 全局唯一；(2) 每组合主 listing 唯一                                | 同 product 可建多条不同 ASIN；同组合下仅一条 is_primary | 多条并存测试            |
| `traffic_strategy` 字段录入（运营创建 listing 时选择战术意图）                                               | 下拉选择可用                                            | UI 验收                 |
| ListingVersion 子表：每次内容修改创建新 version；可设为 active 或归档；历史可回退 diff                       | 一个 listing 可见 v1, v2, v3 历史；一键回退             | 版本切换测试            |
| Listing 编辑器前端（多 Tab、状态徽章、版本时间线、主 listing 切换、traffic_strategy 标签）                   | UI 可演示                                               | 视觉 + 功能验收         |
| Listing 生成延迟 P95 < 15s（M-02）                                                                           | 性能测试通过                                            | k6                      |

### W11：图片需求单 + ES 写入产品知识库

| 实施内容                                                 | 完成标准         | 校验办法         |
| -------------------------------------------------------- | ---------------- | ---------------- |
| 图片需求单模板（主图、场景图、A+、Infographic）          | 设计可按单执行   | 项目经理签收样例 |
| 产品内容/品类 FAQ/卖点写入 ES 索引（为 S3 客户中心准备） | ES 延迟 < 200ms  | 搜索测试         |
| Listing A/B 版本快照                                     | 历史可查、可回退 | 快照 diff        |

### W12：存量数据迁移（Homtone）

| 实施内容                                                                                        | 完成标准             | 校验办法     |
| ----------------------------------------------------------------------------------------------- | -------------------- | ------------ |
| 路径 A 提取（**Gemini 2.5 Flash** 结构化提取）：领星 listing → 产品档案，仅 Homtone 美国 Amazon | 准确率 ≥ M-07（95%） | 运营逐条签字 |
| 批量导入脚本 + 验收报告                                                                         | 全量在售 SKU 入库    | 运营核对记录 |

### W13：S1 硬化与上线

| 实施内容                                               | 完成标准     | 校验办法              |
| ------------------------------------------------------ | ------------ | --------------------- |
| Feature flag（按品牌灰度）；DB 备份 + 密钥轮转 Runbook | 演练记录存档 | 运维签字              |
| 压测（M-01）：5 人并发场景 P99 < 800ms                 | k6 报告      | —                     |
| **S1 上线 + 5 人 alpha 试用启动**                      | 全流程零阻塞 | 录屏存档 + 运营反馈表 |

---

## 7. S2（月 4–6）：第二品牌 + Walmart

> **切片目标**：在 S1 基础上加第二品牌（Spoonlemon）+ Walmart 平台 + 路径 A 完整能力，验证多品牌/多平台架构。  
> **切片末交付（W26 末）**：12 名运营 beta 试用，覆盖 Homtone+Spoonlemon × Amazon+Walmart × 美国。

### W14–W15：多品牌切换 + Spoonlemon 配置 + GLM-5 引入 + Cost Tracking

| 实施内容                                                                                                           | 完成标准                                     | 校验办法       |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | -------------- |
| 前端品牌切换器（管理后台顶部）；IAM 品牌隔离生效                                                                   | 切换品牌后数据严格隔离                       | 跨品牌越权测试 |
| Spoonlemon 品牌配置（VI 规范、Logo、店铺绑定）                                                                     | 双品牌可独立配置                             | 视觉验收       |
| **GLM-5 Provider 接入**（OpenAI 兼容 endpoint，经 Vercel AI SDK）                                                  | GLM-5 hello world 跑通；可与 Gemini 同时调用 | 单元测试       |
| **AI Services 层 router 增强**：按 task_type + locale 选模型（FAQ/菜谱→GLM-5；Listing→Gemini Pro 等）              | router 单元测试覆盖 v2.0 全部场景            | CI             |
| **Cost Tracking 中间件**：每次 AI 调用记录 model / tokens / task / brand / market；写入 `ai_call_log` 表；月度报表 | 月度成本可按品牌/任务维度查询                | SQL 报表验收   |
| **`faqGenerationService` (GLM-5) 上线**：S1 推迟的 FAQ/菜谱 AI 生成现在加入；source=ai_generated                   | 3 款产品 AI 生成验收                         | 运营评审       |

### W16–W17：Walmart Listing 适配

| 实施内容                                                                 | 完成标准                 | 校验办法                   |
| ------------------------------------------------------------------------ | ------------------------ | -------------------------- |
| 平台字段规则表（Amazon/Walmart 字符上限、禁用词、图片尺寸、类目映射）    | 规则表评审通过           | 与官方文档抽检             |
| 规则单元测试自动化                                                       | 100% 覆盖                | CI                         |
| Walmart Listing 适配（Key Features、Short Description、Product ID 规则） | Walmart 格式可生成并预览 | 比对 Walmart Seller Center |

### W18–W20：路径 A 完整能力

| 实施内容                                                                                     | 完成标准                                 | 校验办法        |
| -------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------- |
| 路径 A 字段映射文档（领星 Listing → product_content，覆盖率 ≥ 90%）                          | 文档评审                                 | 与运营对照 5 款 |
| 路径 A 端到端：领星 API 拉取 → AI 解析 → 创建产品档案（Homtone+Spoonlemon × Amazon+Walmart） | 8 款跨品类 SKU 端到端导入，准确率 ≥ M-07 | 运营逐条签字    |
| 路径 A UI：异步任务进度跟踪                                                                  | 任务状态可见                             | 队列消费监控    |

### W21–W23：存量数据迁移（Spoonlemon + Walmart 数据）

| 实施内容                                | 完成标准           | 校验办法       |
| --------------------------------------- | ------------------ | -------------- |
| Spoonlemon 全量在售 SKU 入库            | 准确率 ≥ M-07      | 运营核对       |
| Walmart 平台 listing 数据入库（双品牌） | 多平台数据并存验证 | 跨平台查询测试 |

### W24–W25：多平台 Listing 批量生成 + Listing 矩阵分析

| 实施内容                                                                                                                                                                             | 完成标准                      | 校验办法         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ---------------- |
| 同一产品在 Amazon + Walmart 双平台 listing 一键生成（仍仅英文）                                                                                                                      | 双平台版本可并行生成          | 延迟满足 M-02    |
| 跨平台主 listing 标记策略                                                                                                                                                            | 每个组合一个主 listing        | 约束测试         |
| **Listing 操作审计日志（L1）**：listing 创建/编辑/状态变更/主 listing 切换全量记录（who/when/what/before/after）                                                                     | 任意 listing 可查完整变更历史 | 审计日志检索测试 |
| **Listing 矩阵分析 dashboard（L2）**：按 product_id 聚合视图，展示同产品下所有 listing（跨店铺、跨 ASIN）的 Title 文本相似度（embedding 距离）、traffic_strategy 分布、销售/曝光对比 | 运营可一屏看到产品矩阵全局观  | 5 款产品手工核对 |
| Dashboard 命名与文案：使用 **"矩阵分析" / "差异化建议"** 等中性词，避免任何"违规/合规风险"字眼                                                                                       | 文案评审                      | PM 走查          |

### W26：S2 上线

| 实施内容                     | 完成标准             | 校验办法      |
| ---------------------------- | -------------------- | ------------- |
| Feature flag 按品牌+平台开关 | 开关精准             | 自动化        |
| **S2 上线 + 12 人 beta**     | 双品牌双平台运营可用 | 录屏 + 反馈表 |

---

## 8. S3（月 7–9）：北美多语言 + 客户中心 V1

> **切片目标**：北美西班牙语/法语 Listing + 完整客户中心 V1（注册/chat/工单/手册/保修/首页/非登录订单查询）。  
> **切片末交付（W39 末）**：20 人试用，2 品牌 × 2 平台 × 美国（EN/ES/FR） + Homtone+Spoonlemon 客户门户上线。

### W27–W28：Locale 模型 + 多语言策略

| 实施内容                                                                        | 完成标准             | 校验办法     |
| ------------------------------------------------------------------------------- | -------------------- | ------------ |
| Locale = Market × Language 数据模型                                             | 北美 EN/ES/FR 可配置 | 切换测试     |
| 语言生成策略文档（**Gemini 2.5 Pro** 直接生成 ES/FR，避免中间翻译）+ 术语库 CSV | 文档+术语库入库      | 运营+PM 评审 |
| IAM 新增 `locale_reviewer` 角色                                                 | 权限矩阵更新         | 测试         |

### W29–W30：多语言 Listing 批量生成

| 实施内容                                  | 完成标准       | 校验办法        |
| ----------------------------------------- | -------------- | --------------- |
| EN/ES/FR × Amazon/Walmart 6 版本批量生成  | 6 版本并行生成 | 单版本满足 M-02 |
| 前端语言切换器 + Listing 编辑器多语言 Tab | UI 演示        | 视觉验收        |

### W31–W33：客户中心 V1 — 门户 + 注册 + 商品（Tenant 模板架构）

> **依赖**：使用 Homtone + Spoonlemon 2 品牌作为客户门户首发；架构按 4 品牌完全独立预留。

| 实施内容                                                                                                                                                                                          | 完成标准                                                     | 校验办法                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| **Tenant 架构落地**：单一代码库 + PostgreSQL 4 个 schema（homtone / spoonlemon / davivy / tysun）+ 域名识别中间件（tenant-resolver 通过 Host header 注入 tenant context，自动 `SET search_path`） | 代码 100% tenant-aware；任意请求泄漏到错误 schema 即测试失败 | 跨 tenant 隔离测试 + 代码 lint 规则      |
| **Auth 4 套独立实例化**：单一 Auth 代码 + 4 份 tenant 配置（域名/邮件模板/品牌色/SMTP 发件人）                                                                                                    | 4 品牌注册/登录/邮箱验证/密码重置流可独立运行                | 4 品牌端到端测试                         |
| 每品牌子域（support.homtone.com / support.spoonlemon.com）+ 主题（Cloudinary 按 `brand/` 目录加载资产）                                                                                           | 双品牌域名可访问                                             | SSL/跨域                                 |
| 客户注册/登录（Email + 邮箱验证 + 密码重置）；**完全独立客户库**（4 schema 物理隔离，同邮箱在每品牌单独注册互不感知）                                                                             | 跨品牌 0 数据泄漏；同邮箱可在 4 品牌各建一个独立账户         | 跨品牌注册测试 + DB 直查验证 schema 隔离 |
| 隐私政策按品牌实例化文案（Homtone 隐私政策 ≠ Spoonlemon 隐私政策）                                                                                                                                | 4 品牌独立隐私政策可访问                                     | 法务/PM 走查                             |
| Article 商品列表+详情（含 FAQ/规格）；多语言切换（基于 Locale + Market 域名）                                                                                                                     | 切换无闪烁                                                   | 视觉验收                                 |

### W34–W35：客户中心 V1 — AI Chat + 工单 + AI Fallback

| 实施内容                                                                                                      | 完成标准                                          | 校验办法                         |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------- |
| 文字实时聊天（WebSocket/SSE）；登录客户与匿名访客均可发起                                                     | 会话与工单关联，品牌隔离                          | E2E                              |
| **AI Fallback 装饰器**（v2.0 渐进式抽象 S3 增量）：Gemini Pro 5xx/超时 → 自动 retry Flash；3 次失败转人工降级 | 故障注入测试通过                                  | 模拟超时/限流测试                |
| AI 自动回复（**Gemini 2.5 Flash** + ES 语义搜索 + Fallback）；3 次未命中转人工                                | 命中率 ≥ M-03（65%）；ES 召回 ≥ M-08（70%）       | 100 题评分                       |
| 工单字段（优先级/标签/SLA/分配）；登录客户工单绑定 customer_id                                                | 工单 CRUD + 状态流                                | 集成测试                         |
| 跨品牌聚合看板（管理员）：通过专用聚合服务读取 4 schema 数据（仅授权管理员可见，绝不暴露给品牌前端）          | IAM `brand` 维度控制；聚合 API 强制走管理员 token | 权限验收 + 4 schema 聚合查询测试 |

### W36–W37：客户中心 V1 — 手册 + 保修

| 实施内容                                                                                     | 完成标准                                 | 校验办法      |
| -------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------- |
| 多语言手册下载（Cloudinary 直链 + Locale 选择）；登录与匿名均可下载                          | 各品牌×市场×语言可下载                   | 5 款抽测      |
| 保修注册表单（产品/序列号/购买日期/平台/发票图片到 Cloudinary）+ 邮件确认 + 到期前 30 天提醒 | 注册成功率 ≥ M-11（95%）；邮件投递 ≥ 98% | 10 例真实测试 |

### W38：客户中心 V1 — 首页 + 非登录订单查询

| 实施内容                                                                        | 完成标准                        | 校验办法 |
| ------------------------------------------------------------------------------- | ------------------------------- | -------- |
| 客户中心首页（我的产品/我的咨询/找资料/找订单 4 区块）                          | 加载 < 2s                       | 性能验收 |
| 非登录订单状态查询（订单号+邮箱→领星 API；速率限制 + CAPTCHA + 不返回完整详情） | 5 平台抽样查询；M-12 防爆破通过 | 安全测试 |

### W39：S3 上线

| 实施内容                          | 完成标准              | 校验办法      |
| --------------------------------- | --------------------- | ------------- |
| Feature flag 按品牌+市场+语言开关 | 灰度精准              | 自动化        |
| **S3 上线 + 20 人试用**           | 多语言 + 客户中心可用 | 录屏 + 反馈表 |

---

## 9. S4（月 10–12）：广告闸门 + 供应链 + NetSuite

> **切片目标**：广告执行闭环（含人工确认闸门、24h 回滚）+ 供应链（多仓 + NetSuite + FBA）。  
> **切片末交付（W52 末）**：30 人试用，运营可在系统内做广告优化与库存管理。

### W40–W42：广告数据看板

| 实施内容                                                                            | 完成标准                     | 校验办法 |
| ----------------------------------------------------------------------------------- | ---------------------------- | -------- |
| 领星广告报告同步（Amazon SP/SD/SB + Walmart）→ 本地聚合（ACOS/花费/销售额/CTR/CVR） | 与领星误差满足 M-05（≤0.1%） | 对账脚本 |
| 看板前端：日级报表 + 多维筛选（品牌/市场/产品/活动）                                | UI 可演示                    | 视觉验收 |

### W43–W45：AI 广告优化建议 + 执行闸门 + Rate Limiting

| 实施内容                                                                                                                                       | 完成标准                                 | 校验办法                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------- |
| **AI Rate Limiting 中间件**（v2.0 渐进式抽象 S4 增量）：分模型独立令牌桶（Gemini Pro / Flash / GLM-5 各独立配额）；按 brand 二级配额；超额排队 | 高峰期不抖动                             | 压测：100 个并发广告建议请求 |
| AI 优化建议单（**GLM-5** 中文输出）：高 ACOS 词、低 CTR 词                                                                                     | 建议单字段完整（词/类型/当前/建议/理由） | 运营试审 5 单                |
| **执行闸门**（Agent Native 安全设计）：AI 建议 → 运营勾选 → 二次确认弹窗 → 执行 → 变更日志                                                     | 无法绕过确认                             | 自动化绕过尝试               |
| 变更日志（类型/旧值/新值/执行人/时间戳）                                                                                                       | 满足 M-10                                | 日志抽检                     |
| 24h 单次回滚（M-09）+ 演练                                                                                                                     | 回滚可用                                 | 回滚演练                     |

### W46–W47：Dayparting + 预算监控

| 实施内容                           | 完成标准           | 校验办法 |
| ---------------------------------- | ------------------ | -------- |
| Dayparting（市场时区，需人工确认） | 不允许 AI 自动写入 | 权限测试 |
| 预算超支预警（企业微信/邮件）      | 触发测试通过       | 模拟超支 |

### W48–W50：供应链 — 多仓视图 + NetSuite

| 实施内容                                                       | 完成标准          | 校验办法     |
| -------------------------------------------------------------- | ----------------- | ------------ |
| 多仓视图（FBA / 本地仓 / **国内仓** / **在途**）与领星实时同步 | 各仓库存满足 M-04 | 5 SKU 抽样   |
| **NetSuite 国内+在途库存**（经领星 API）                       | 字段正确          | 财务对账签字 |
| 补货预警（销售速度+安全库存天数+在途不重复计算）               | 推送可用          | 模拟触发     |

### W51：FBA 入仓计划 + 采购单

| 实施内容                                               | 完成标准     | 校验办法   |
| ------------------------------------------------------ | ------------ | ---------- |
| FBA 入仓计划创建（符合 Amazon FBA）+ 货代记录 + 跟踪号 | 可导出       | 运营试操作 |
| 采购单 CRUD（关联产品+品类）+ 供应商管理 + 到货计划    | 采购流程完整 | API 测试   |

### W52：S4 上线

| 实施内容                                                              | 完成标准          | 校验办法 |
| --------------------------------------------------------------------- | ----------------- | -------- |
| 全链路演示（广告报告 → AI 建议 → 闸门 → 执行 → 回滚）+ 库存预警全链路 | 零阻塞            | 录屏     |
| **S4 上线 + 30 人试用**                                               | 广告 + 供应链可用 | 反馈表   |

---

## 10. S5（月 13–15）：4 品牌全量 + 欧洲市场

> **切片目标**：扩展到 Davivy + Tysun 品牌；加欧洲市场（DE/IT 加入，EN/FR/ES 复用）+ 英国市场。  
> **切片末交付（W65 末）**：38 人全员上岗，全品牌全市场（不含日本）覆盖。

### W53–W55：Davivy + Tysun 品牌配置

| 实施内容                                                        | 完成标准         | 校验办法     |
| --------------------------------------------------------------- | ---------------- | ------------ |
| 4 品牌完整配置（VI 规范、Listing 风格、店铺绑定、客服门户域名） | 每品牌独立可切换 | 品牌隔离测试 |
| 4 品牌客户中心扩展（support.davivy.com / support.tysun.com）    | 4 域名可访问     | SSL/视觉     |
| Davivy + Tysun 存量数据导入（路径 A）                           | 准确率 ≥ M-07    | 运营核对     |

### W56–W58：欧洲市场扩展

| 实施内容                                                                  | 完成标准           | 校验办法 |
| ------------------------------------------------------------------------- | ------------------ | -------- |
| 加 DE / IT 语言（Gemini 2.5 Pro 直接生成）                                | 6 语言全覆盖       | 单元测试 |
| 欧洲市场域名/店铺配置（DE/FR/ES/IT/EN，Amazon EU + Walmart 不可用则跳过） | 配置完成           | 验收     |
| 英国市场（EN）配置                                                        | 配置完成           | 验收     |
| 多语言术语库扩展（DE/IT 增加）                                            | 术语库覆盖核心品类 | review   |

### W59–W61：日语审核流程 + native speaker（即便 v2.0 不上日本市场，先建审核机制）

| 实施内容                                      | 完成标准       | 校验办法 |
| --------------------------------------------- | -------------- | -------- |
| ~~日语审核~~（v2.0 不上线，移到 v2.x）        | —              | —        |
| 欧洲语言专项审核（DE/IT 优先 native speaker） | 审核记录可追溯 | 抽样     |

### W62–W64：IAM 全权限矩阵回归 + 性能压测

| 实施内容                                              | 完成标准    | 校验办法 |
| ----------------------------------------------------- | ----------- | -------- |
| IAM 完整矩阵（4 品牌 × 8 市场 × 2 平台 × 7 维度）回归 | 无 P1 越权  | 渗透测试 |
| 38 人全员压测（M-01）                                 | P99 < 800ms | k6       |

### W65：S5 上线

| 实施内容                | 完成标准                     | 校验办法        |
| ----------------------- | ---------------------------- | --------------- |
| **S5 上线 + 38 人全员** | 全品牌全市场（不含日本）可用 | 录屏 + 全员反馈 |

---

## 11. S6（月 16–18）：Manual/包装 + 培训考试

> **切片目标**：Manual 多语言生成 + 包装文案 + 培训考试系统（含权限联动）。  
> **切片末交付（W78 末）**：v2.0 完整版上线，38 人完整培训。

### W66–W68：Manual 多语言生成

| 实施内容                                                                                     | 完成标准         | 校验办法          |
| -------------------------------------------------------------------------------------------- | ---------------- | ----------------- |
| Manual 多语言（Gemini 2.5 Pro 百万 token 长文档）：品类安全说明 + 产品字段 + 菜谱 → PDF/Word | 输出可编辑终稿   | 法务/合规抽样签字 |
| 法规模板库（CE / FCC / UL / 英国 UKCA / 欧盟）按市场选择                                     | 模板覆盖目标市场 | 合规审查          |

### W69–W71：包装文案

| 实施内容                                               | 完成标准        | 校验办法      |
| ------------------------------------------------------ | --------------- | ------------- |
| 包装文案（Gemini Pro EN/EU/英；GLM-5 中文说明/警示语） | 按品牌×市场输出 | 线下打样 1 款 |
| 输出格式（Figma / InDesign / PDF）                     | 印刷厂格式说明  | 供应商确认    |
| 品类+品牌包装模板库                                    | 模板可复用      | review        |

### W72–W74：培训考试 — 课程 + 题库

| 实施内容                                                                       | 完成标准           | 校验办法   |
| ------------------------------------------------------------------------------ | ------------------ | ---------- |
| 课程体系（GLM-5 中文）：Amazon 运营、Walmart、合规、广告、供应链、客户中心使用 | 课程可分配给 38 人 | 5 人试学   |
| 题库（GLM-5 中文出题）：单选/多选/判断/简答                                    | 题库覆盖各模块     | review     |
| 课程进度看板                                                                   | 数据实时更新       | 管理员验收 |

### W75–W76：培训考试 — 在线考试 + 权限联动

| 实施内容                                       | 完成标准    | 校验办法 |
| ---------------------------------------------- | ----------- | -------- |
| 在线考试（防切屏检测）+ 自动评分 + 成绩档案    | 成绩可导出  | 5 人试考 |
| 权限联动：考试通过特定模块 → 自动 IAM 权限变更 | 生效 < 1min | 自动化   |

### W77：v2.0 全量集成验收

| 实施内容                                                                | 完成标准 | 校验办法 |
| ----------------------------------------------------------------------- | -------- | -------- |
| 全链路演示（产品 → Listing → 客户中心 → 广告 → 供应链 → Manual → 培训） | 零阻塞   | 录屏     |
| 安全审查 OWASP Top10 自查                                               | 无 P1    | 检查清单 |
| SLA 文档与 On-Call 排班                                                 | 文档评审 | PM 签字  |

### W78：v2.0 正式上线

| 实施内容                                               | 完成标准   | 校验办法             |
| ------------------------------------------------------ | ---------- | -------------------- |
| 蓝绿/金丝雀发布检查表                                  | 流程文档化 | 上线后 1h 观察期报告 |
| 生产 Runbook（领星限流、广告回滚、DB 连接池、ES 重建） | 可独立排障 | 运维评审             |
| **v2.0 上线 + 38 人完整培训**                          | 全功能可用 | 录屏存档             |

---

## 12. 跨切片日常例行

每周重复，作为最小闭环保障：

| 频率                   | 实施内容                                                               | 完成标准               |
| ---------------------- | ---------------------------------------------------------------------- | ---------------------- |
| **每日**               | 站会（同步阻塞：领星 API 限额、IP、权限、AI 调用失败）                 | 阻塞有 Owner，ETA 明确 |
| **每日**               | 主干构建绿                                                             | CI 0 失败              |
| **每周一**             | 店铺绑定 & IAM 策略变更评审（双人复核）                                | 变更单记录             |
| **每周五**             | 迭代回顾（完成项、阻塞项、下周计划）                                   | 看板更新               |
| **每月**               | 安全扫描（依赖漏洞、密钥轮转检查）                                     | 扫描报告               |
| **每切片中（约每月）** | 知识共享：每个开发者轮流讲解一个模块（Bus factor 应对，M-16）          | 文档 + 录屏            |
| **每 6 个月**          | 平台 API changelog review（Amazon SP-API / Walmart / NetSuite / 领星） | 变更影响评估           |
| **每 6 个月**          | 技术栈版本审查（Next.js / NestJS / Casbin / Gemini / GLM）             | 升级或维持决策         |

---

## 13. 关键需求显式验收

| 需求                                   | 验收条件                                                                                                                                                                                                                                                                          | 校验方式                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **商品 = 产品 × 市场**（Article 层）   | Article API 与客服门户只暴露该层组合数据；售后汇总、本地化详情挂载在 Article 层                                                                                                                                                                                                   | API response schema 检查                         |
| **多 Listing 双层模型 + 双重唯一约束** | 一个 Product 可对应多条 Listing（多店铺、多 ASIN 抢流量、变体、捆绑等）；约束 1：`(platform, shop, platform_listing_id)` 全局唯一；约束 2：`(product, brand, market, platform, shop, language) WHERE is_primary=true` 部分唯一；ListingVersion 子表管理版本（草稿协作、历史回退） | 双约束违反测试 + 多 ASIN 并存验证 + 版本回退测试 |
| **店铺过滤**                           | 所有领星拉取带 `allowed_shop_ids`；未绑定店铺永不被查询                                                                                                                                                                                                                           | 自动化测试                                       |
| **品类继承三种 source**                | source 变更轨迹可追溯；品类模板更新可选择性级联产品                                                                                                                                                                                                                               | 快照 diff + 级联策略测试                         |
| **Listing 版本管理**                   | 通过 ListingVersion 子表实现；版本历史可查、可回退、diff 可视；同一 listing 仅一个 active version                                                                                                                                                                                 | 快照对比 UI + 版本切换测试                       |
| **NetSuite 库存**                      | 国内仓 + 在途仓数据与 NetSuite 报表抽样一致                                                                                                                                                                                                                                       | 财务对账会议                                     |
| **广告执行不可绕过确认**               | 自动化测试尝试绕过确认均被拒绝                                                                                                                                                                                                                                                    | 安全测试                                         |
| **培训 → 权限联动**                    | 考试通过 → 策略变更 < 1min 生效                                                                                                                                                                                                                                                   | 自动化                                           |
| **客户中心 V1 范围**                   | 注册/登录 + AI chat + 工单 + 手册下载 + 保修注册 + 首页 + 非登录订单查询 7 个模块全部上线（Homtone、Spoonlemon 2 品牌先行）                                                                                                                                                       | W18 集成验收                                     |
| **4 品牌客户库严格隔离**               | 同邮箱在 4 品牌各注册独立账户互不可见；跨品牌 0 数据泄漏                                                                                                                                                                                                                          | M-13 测试                                        |
| **保修注册数据资产**                   | 保修注册数据为品牌 CRM 起点，可导出做营销/复购分析                                                                                                                                                                                                                                | 数据导出 API + 字段完备性检查                    |

---

## 14. SLA 与 On-Call 规范

> 在 S6 W77 前完成文档，W78 v2.0 正式上线时执行。

### 事件分级

| 级别   | 定义                                         | 响应时间      | 解决时间      |
| ------ | -------------------------------------------- | ------------- | ------------- |
| **P0** | 全平台不可用 / 数据丢失 / 安全漏洞           | 15 分钟内响应 | 4 小时内恢复  |
| **P1** | 核心功能（Listing 生成/客服/库存同步）不可用 | 30 分钟内响应 | 8 小时内恢复  |
| **P2** | 非核心功能异常（报表延迟/培训系统）          | 2 小时内响应  | 24 小时内恢复 |
| **P3** | 轻微问题/优化建议                            | 下个工作日    | 下个迭代      |

### On-Call 要求

- 轮班制（7×24），P0/P1 告警触发企业微信 + 电话
- 告警渠道：Grafana Alert → 企业微信 Webhook
- Runbook 覆盖：领星限流处理、广告变更回滚、DB 连接池耗尽、ES 索引重建

---

## 15. v2.x 后续迭代（v2.0 不含）

> 以下功能在 v1.4 范围内，但 v2.0 因 18 个月 + 2 人产能限制延后。建议 v2.0 上线后根据真实使用反馈再排期。

| 功能                                               | 延后原因                                                        | 建议时间窗                   |
| -------------------------------------------------- | --------------------------------------------------------------- | ---------------------------- |
| **Wayfair / Shopify / TikTok Shop 平台对接**       | 平台数量过多，先验证 Amazon+Walmart 闭环                        | v2.1（v2.0 上线后 3-6 个月） |
| **客户中心 V1.5：跨平台订单聚合查询**              | 依赖客户主动提供订单号+邮箱绑定，UX 复杂                        | v2.1                         |
| **客户中心 V2：跨平台退换货闭环**                  | Amazon 已有 RMA 流程，工程价值低；Shopify 闭环可独立做          | v2.2                         |
| **日本市场（JA 语言）**                            | 日语 native speaker 审核流程未建；J-PSE 法规模板未整理          | v2.2                         |
| **社媒投流管理（TikTok/Google/Facebook/YouTube）** | 4 平台 API + UTM × SKU 归因，工程量 8-10 人周；平台政策变化频繁 | v2.3                         |
| **客服语音通话**                                   | 第三方 RTC + 录音合规 + 多语言；非核心场景                      | v2.3                         |
| **培训防切屏严格检测**                             | v2.0 仅基础检测；如发现作弊问题再加强                           | 按需                         |

### v2.x 触发条件

| 触发器                      | 行动                     |
| --------------------------- | ------------------------ |
| Shopify 销售占比 > 20%      | 优先做 Shopify 集成      |
| 日本市场销售开始            | 启动 JA 语言 + PSE 模板  |
| 社媒投流预算 > 月 10 万美金 | 启动社媒投流管理模块     |
| 客户中心月活 > 1 万         | 评估 V1.5 订单聚合的 ROI |

---

## 16. 风险登记册

| 风险                                              | 概率   | 影响     | 应对措施                                                                       |
| ------------------------------------------------- | ------ | -------- | ------------------------------------------------------------------------------ |
| 领星 API 限额超出                                 | 中     | 高       | 增量同步 + 超额告警 + 本地缓存（Redis TTL）                                    |
| 欧洲多语言内容质量不达标（DE/IT 优先）            | 中     | 中       | native speaker 审核角色；术语库前置                                            |
| 平台 API 变更（Amazon SP-API / Walmart）          | 中     | 高       | 适配层抽象；每月 changelog review；每 6 个月集中升级                           |
| ES 索引数据量增长性能                             | 低     | 中       | 分片策略文档；定期压测                                                         |
| 38 人并发使用峰值超预期                           | 低     | 中       | M-01 压测基线 + 弹性扩容预案                                                   |
| NetSuite 字段与领星不一致                         | 中     | 中       | S4 W48 前与财务团队对齐字段映射                                                |
| 各国合规法规更新（包装/Manual）                   | 低     | 高       | 模板化法规段落；每季度合规审查                                                 |
| 存量 SKU 数据质量差（导入准确率低）               | 中     | 中       | 切片末运营批量验收；AI 解析 + 人工二次校对                                     |
| Gemini API 服务中断或限速                         | 低     | 高       | AI 网关 Fallback（Pro → Flash）；GLM-5 临时接管；BullMQ 重试                   |
| GLM-5 中文内容不符合目标市场出口合规              | 低     | 中       | GLM 只处理内部中文；面向市场内容全 Gemini；合规审查按市场                      |
| Gemini / GLM API Key 泄露                         | 低     | 极高     | Secret Manager；Key 按环境隔离；每 90 天轮转；异常调用量告警                   |
| 客户中心非登录订单查询被滥用爬虫                  | 中     | 中       | M-12 限流 + CAPTCHA；不返回完整订单；异常 IP 告警                              |
| 客户注册转化率低                                  | 中     | 中       | 首页"保修产品"作为"我的产品"入口；上线后 4 周看转化率决定是否提前 V1.5         |
| 保修注册客户瞎填                                  | 中     | 中       | 必填发票图片；序列号校验产品；3 个月后样本审计                                 |
| 领星 API 字段细节未对齐                           | 低     | 中       | 领星整体可信赖（v1.4 决策），S1 W7 与领星技术对齐字段清单                      |
| **🔴 Bus Factor = 1（任一开发者离职即重大风险）** | **中** | **极高** | M-16：每月知识共享轮讲；模块文档双人 review；备份合同开发者预备                |
| **🔴 18 个月长周期：业务环境变化**                | **中** | **高**   | 每切片末 review 业务优先级；S4 末（月 12）做整体 v2.0 范围 review              |
| **🔴 18 个月长周期：技术栈过时**                  | **中** | **中**   | 每 6 个月技术栈审查；Next.js / NestJS / Casbin 锁版本，集中升级                |
| **🔴 38 人运营长期等待失去耐心**                  | **中** | **中**   | 切片驱动节奏（每 3 个月可用增量）；试用人数曲线（M-15）作为信心指标            |
| **🟡 Shopify / TikTok Shop / 日本市场业务等不及** | **中** | **中**   | v2.x 触发条件机制（见 §15）；如销售占比/合作机会突破阈值，可优先插入 v2.x 模块 |

---

_文档版本：v2.0 | 最后修订：2026-04-30 | 下次评审：S1 W6 结束后_

### v2.0 变更摘要（基于 brainstorm 决策链）

| 决策点                          | 取值                                               | 备注                                                                                                                                                     |
| ------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 客服门户产品边界                | B 完整客户中心                                     | 含登录/订单/退换货/保修/手册/账户                                                                                                                        |
| 客户主要服务对象                | A 跨平台一致体验                                   | 订单号+邮箱手动绑定                                                                                                                                      |
| 客户账户体系                    | **A 完全独立 + Tenant 模板架构**                   | 4 套 auth + 4 个 PostgreSQL schema 物理隔离；单一代码库 + 域名识别中间件，开发成本约 1.3x（非 4x）；隐私政策按品牌实例化；跨品牌看板走管理员专用聚合服务 |
| MVP 切分策略                    | A+ 组合方案                                        | V1 不依赖订单数据                                                                                                                                        |
| ~~领星依赖度（v1.x 历史决策）~~ | ~~高度信任~~                                       | ~~W7 仅做能力清点，不预留降级~~ — **已被 §3.2 M3 半镜像 + 4 级 SLO 降级覆盖**                                                                            |
| 团队规模                        | 2 人全栈                                           | 创始人 + 1                                                                                                                                               |
| 总时长                          | **18 个月（78 周）**                               | 替换原 26 周计划                                                                                                                                         |
| 范围裁剪                        | 砍掉社媒投流/语音/日本/Wayfair-Shopify-TikTok Shop | 进入 §15 v2.x 后续迭代                                                                                                                                   |
| 节奏模式                        | **切片驱动 6 切片**                                | 每 3 个月一个可上线增量                                                                                                                                  |
| 试用人数曲线                    | 5 → 12 → 20 → 30 → 38 → 38                         | M-15 作为运营信心指标                                                                                                                                    |
| AI 抽象层                       | **方案 3+4 单模型起步 + Vercel AI SDK**            | S1 仅 Gemini；S2 加 GLM-5+cost；S3 加 fallback；S4 加 rate limit                                                                                         |
| S1 FAQ/菜谱                     | 人工填（AI 推迟到 S2）                             | alpha 5 人接受                                                                                                                                           |
| Listing 数据模型                | **Listing + ListingVersion 双层** + 双重唯一约束   | 一个 Product 可对应多 ASIN（多店铺/抢流量/变体/捆绑）；ListingVersion 管版本；含 `traffic_strategy` 字段；**不含 violation_risk 状态**（合规考量）       |
| Listing 矩阵分析                | S2 W24-W25 上 L1 审计日志 + L2 dashboard           | 中性化命名（"矩阵分析"/"差异化建议"），不出现违规字眼；S3+ 视实际平台风控事件再考虑主动告警                                                              |
| 领星 ERP 依赖深度               | **M3 半镜像 + 场景化策略**（见 §3.2）              | 广告/NetSuite 全镜像；订单/库存透传+cache；Listing 元数据半镜像；统一 LingxingClient 中间层；4 级 SLO 降级状态机                                         |
| 指标采集                        | **E 分阶段渐进**（见 §5.1）                        | S1 Sentry+Postgres，S2 PostHog，S3 Metabase，S4 对账 cron；月成本 $30 起 → $80 收口                                                                      |
| S1 W1 落地节奏                  | **D-1 行政准备 + D1-D5 五天拆解**（见 §6 W1）      | D-1 预先一周完成账号申请；D1 ADR；D2 CI+后端；D3 前端；D4 AI/Cloudinary；D5 集成复盘                                                                     |

---

## 17. v2.0-RC 文档冻结与签字

### 17.1 状态

| 项       | 取值                                                      |
| -------- | --------------------------------------------------------- |
| 文档版本 | **v2.0-RC**（Release Candidate）—— 待签字后转 **v2.0 GA** |
| 冻结时间 | 2026-04-30                                                |
| 总长     | 953 行，17 章节                                           |
| 决策点   | 18 项（见 §16 末尾"v2.0 变更摘要"）                       |
| 切片     | 6（S1-S6，78 周）                                         |
| 量化指标 | 16（M-01 ~ M-16）                                         |

### 17.1a 启动状态记录（2026-04-30）

> **决定：以 v2.0-RC 状态正式启动，签字并行推进。**
>
> 背景：2 人团队完成 brainstorm 并锁定关键技术选型（Resend / Supabase / Upstash / Railway），  
> W1 D1 所需的阻塞级前置（R2-R4 选型锁定、R5 凭证模板就绪）已完成；  
> §17.2 六方正式签字在 W1-W2 期间并行推进，不阻塞开发启动。  
> 若 W2 末仍有签字方未回复，则视为"默认批准"并在版本注记中记录。
>
> 记录人：Tech Lead  
> 日期：2026-04-30

### 17.2 签字矩阵（v2.0-RC → GA 必备）

| 签字方              | 签字范围                                                                         | 关键关注点                                                                  |
| ------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **CTO / Tech Lead** | §3 技术选型、§3.1 AI 模型策略、§3.2 领星架构、§5.1 指标采集、§6 W1 五天拆解      | 架构合理性、2 人产能匹配、关键中间层（LingxingClient、AI Services）边界     |
| **运营 PM**         | §1 系统概述、§4 全局里程碑、§13 关键需求显式验收、§5 量化指标、§15 v2.x 后续迭代 | 切片末交付物可被运营试用；M-01-M-16 与运营 KPI 不冲突                       |
| **客服负责人**      | §8 S3 客户中心 V1（W31-W39）、§13 客户中心范围                                   | 4 品牌 tenant 隔离对客服工单流的影响；非登录订单查询限流策略                |
| **法务 / 合规**     | §3 IAM、§7 客户账户体系（4 schema 隔离）、§17.4 隐私政策模板要求                 | 4 品牌独立隐私政策、跨品牌数据零泄漏证据链、不含违规风险字段                |
| **财务 / 采购**     | §3.2 领星依赖、§9 S4 供应链 + NetSuite                                           | 月度运维成本预算（指标采集 $30→$80、Cloudinary、Sentry、Gemini token 费用） |
| **CEO / 创始人**    | 全文摘要 + §16 风险登记册 + §17 收官                                             | 18 个月时长可承受性、试用曲线 5→38、Bus factor M-16                         |

### 17.3 S1 W1 D1 启动一页 checklist（撕下即可执行）

> 当全部 6 方签字完成、`v2.0-RC` 转 `v2.0 GA` 后，按此清单进入 W1 D1。

#### W1 之前一周（D-1）

- [ ] GitHub Org + 私有 repo `yaemartOS` 创建（2 人 admin）
- [ ] Google Cloud 项目 + Gemini API key（`gemini-2.5-flash` 调通）
- [ ] Sentry / Cloudinary / Postgres 托管 / Redis 托管账号
- [ ] 1Password vault 密钥共享 + `.env.local` 模板
- [ ] 领星 OpenAPI 凭证申请（行政流程）
- [ ] 双开发者本地环境：Node 20 LTS、pnpm 9、Docker Desktop、VS Code/Cursor

#### W1 D1（周一）

- [ ] AM：pnpm workspace 初始化（5 个 package）
- [ ] AM：ESLint/Prettier/Husky/commitlint
- [ ] PM：ADR-001 技术选型 / ADR-002 分支策略
- [ ] PM：README + CONTRIBUTING + 第一个 PR 合入

#### W1 D2-D5

> 见 §6 W1 D2-D5 详细任务表。

#### 节奏纪律

- [ ] 每天 16:00 站会 5 分钟
- [ ] 任意单项卡 > 4h 立即 pair
- [ ] 周五 PM 录屏 demo 给运营 PM
- [ ] D-1 任一项未完成 → 推迟 W1 启动

### 17.4 隐私政策与合规要求（法务签字必读）

签字前法务必须确认：

| 项                             | 要求                                                     | 落地章节     |
| ------------------------------ | -------------------------------------------------------- | ------------ |
| 4 品牌独立隐私政策             | 各品牌独立 URL，文案差异化                               | §8 W31-W33   |
| 数据库 schema 物理隔离         | 4 个 schema：homtone/spoonlemon/davivy/tysun             | §3 ERD       |
| 跨品牌客户身份 0 自动关联      | 后台聚合服务仅限授权管理员，前端永不暴露                 | §8 W34-W35   |
| 用户数据导出/删除（GDPR/CCPA） | v2.x 触发条件之一                                        | §15          |
| 文档不含违规风险字段命名       | Listing.status 不含 `violation_risk`；矩阵分析命名中性化 | §16 决策摘要 |
| 审计日志覆盖率 100%            | M-10 验收                                                | §5           |

### 17.5 Brainstorm 决策链（v1.4 → v2.0 演进）

```
v1.0  初稿（26 周计划）
v1.1  完善修正（多语言/NetSuite/ES 策略）
v1.2  AI 模型切换（Anthropic → Gemini + GLM-5）
v1.3  IAM shop 维度 + Cloudinary + 多 listing 部分唯一
v1.4  客户中心 MVP V1（A+ 组合方案）
v2.0  ↓ 切片驱动 + brainstorm 6 个核心 topic
   topic A 合规告警   →  S2 W24-W25 L1+L2 中性化命名
   topic B 客户账号   →  4 schema Tenant 模板架构
   topic C 领星依赖   →  M3 半镜像 + 4 级 SLO
   topic D 指标采集   →  E 分阶段渐进
   topic E S1 W1 拆解 →  D-1 + D1-D5 五天 checklist
   topic F 文档冻结   →  v2.0-RC + 6 方签字矩阵
v2.0 GA  6 方签字后
```

### 17.6 签字行（待填）

| 角色            | 姓名       | 签字日期     | 状态   |
| --------------- | ---------- | ------------ | ------ |
| CTO / Tech Lead | **\_\_\_** | ****\_\_**** | ☐ 待签 |
| 运营 PM         | **\_\_\_** | ****\_\_**** | ☐ 待签 |
| 客服负责人      | **\_\_\_** | ****\_\_**** | ☐ 待签 |
| 法务 / 合规     | **\_\_\_** | ****\_\_**** | ☐ 待签 |
| 财务 / 采购     | **\_\_\_** | ****\_\_**** | ☐ 待签 |
| CEO / 创始人    | **\_\_\_** | ****\_\_**** | ☐ 待签 |

> **6 方签字完成后**：将 `v2.0-RC` 改为 `v2.0 GA`，文件首行版本号同步更新，正式启动 W1 D-1 行政准备。

---

_文档版本：v2.0-RC | 冻结日期：2026-04-30 | 下次评审：S1 W6 切片末_
