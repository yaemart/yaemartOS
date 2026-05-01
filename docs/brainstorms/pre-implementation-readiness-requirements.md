---
date: 2026-04-30
topic: pre-implementation-readiness
---

# yaemartOS 实施前完善清单

## Problem Frame

v2.0-RC 实施方案已基本成型，但在正式启动 W1 D1 前，存在三类缺口：**未锁定的技术决策**会导致 W1 中途停工；**缺失的 UI 设计规范**会导致前端开发无依据；**尚未落地的行政事项**会在 W7 前造成等待。

本文档记录所有需要"先于对应开发周完成"的工作，并按阻塞程度分级，确保 W1 D1 能无障碍启动。

---

## Actors

- A1. tech lead：2 人团队中负责架构决策和外部账号申请的那位
- A2. dev #2：另一位开发者，负责基础设施和工具链
- A3. 运营 PM：对接运营侧需求、alpha 用户招募、文档签字
- A4. 领星技术对接人：外部，需要公司行政协调才能接触

---

## Requirements

**🔴 阻塞级 — W1 D1 前必须完成**

- R1. 明确 v2.0-RC 签字状态：要么完成 §17.2 六方签字，要么 tech lead + 运营 PM 明确记录"以 RC 状态启动，签字并行推进"的决定，并写入版本注记。
- ✅ R2. 邮件服务选型落地：**已选 Resend**（写入 ADR-001 §2.7）。待办：账号创建 + 测试发信（发件域名 DKIM 配置）。
- ✅ R3. PostgreSQL 托管选型落地：**已选 Neon**（写入 ADR-001 §2.3，serverless branching 支持 dev/staging 分支隔离）。待办：创建 dev + staging project，connection string 入 1Password。
- ✅ R4. Redis 托管选型落地：**已选 Upstash free**（写入 ADR-001 §2.3）。待办：创建 dev + staging 数据库，dev Redis URL 写入 `.env.local`。
- R5. 1Password 团队 vault 创建完成，上述所有凭证（Gemini API key、Sentry DSN、Cloudinary、DB URL、Redis URL、邮件服务 key）全部入库；`.env.local` 模板共享给 dev #2。
- R6. 领星 OpenAPI 凭证申请**立即启动**（公司行政流程，预估 2-4 周，W7 前必须到手）。
  行动清单（负责人：A1 + 行政）：
  1. 登录领星 ERP 后台 → 开发者中心 → 提交 OpenAPI 接入申请
  2. 填写：公司主体、接入目的（"内部运营系统与 ERP 数据同步"）、回调域名（staging URL）
  3. 准备材料：营业执照副本、经办人授权书、接入系统功能说明（可参考 `docs/yaemartOS-implementation-plan.md §3.2`）
  4. 申请提交后，在 1Password vault 建立占位条目「领星 OpenAPI - 申请中」，记录申请日期
  5. W6 末（距 W7 提前 1 周）检查是否到账；未到账则升级跟进并准备 mock 方案

**🟡 重要 — 需在对应开发周前完成**

_UI 设计规范_

- R7. 补写 UI 规范 B：管理后台 Shell（侧边栏导航结构、顶部导航栏、面包屑规则、主内容区域布局模板、空状态 / 加载状态 / 403 页模板）。须在 W4 前完成。
- R8. 补写 UI 规范 C：产品中心（产品创建/编辑表单布局、产品列表页、品类管理页、品类模板继承 UI 流程）。须在 W5 前完成。
- R9. 补写 Dashboard 首页规范：数字指标卡（M-01/M-02/M-10 等）、近期操作日志、快捷入口。须在 W4 前完成。
- ✅ R10. 补写客服门户完整规范：**已完成**（`docs/ui/G-customer-portal.md`，含门户首页、非登录订单查询、保修注册 3 步流、手册下载页、工单列表/详情/新建、账户中心、4 品牌视觉差异汇总表）。

_技术决策_

- ✅ R11. 生成正式 ERD 图：**已完成**（`docs/erd/domain-model.md`，Mermaid ER 图覆盖运营域 public schema + 客户域 4 个 tenant schema，含双重唯一约束和状态机说明）。
- ✅ R12. 部署目标决策：**已选 PaaS — Railway / Fly.io**（写入 ADR-001 §2.6，Harness CD pipeline 已更新为 Railway CLI 部署步骤）。
- R13. Amazon SP-API 接入时机明确：确认 S1-S3 完全走领星只读、S4 广告执行是否自行对接 SP-API 还是继续走领星写操作；结论写入实施方案对应切片。

_流程对齐_

- R14. 5 人 alpha 名单确认：识别 S1 末（W13）参与 alpha 试用的 5 名运营人员，由运营 PM 确认并通知，避免 W13 末找不到人试用。
- R15. 运营 PM 对 W1 D5 demo 的预期对齐：实施方案 W1 D5 要求"录屏给运营 PM 看"，需提前 1-2 周约好时间，确认对方能看并给反馈。

**🟢 并行可做 — 不阻塞但影响质量**

- R16. REST API contract 文档：至少覆盖 S1 核心路由（Auth、Category、Product、Listing、ListingVersion）的 endpoint + request/response schema，存入 `docs/api/`。可在 W2-W3 期间由后端开发者边写边补。
- R17. 测试覆盖率门槛定义：明确 unit test ≥ X%、E2E 覆盖哪些核心路径，写入 `CONTRIBUTING.md`（当前只有框架选型，无覆盖率要求）。
- R18. 回滚预案模板：§2.1 要求"回滚预案文档 + 演练记录"，需在 W13 前准备一份通用模板（版本、变更内容、回滚步骤、验证方法、负责人），供每次上线填写。

---

## Acceptance Examples

- AE1. **Covers R1.** 在 W1 D1 周一，打开 GitHub repo 的 `docs/yaemartOS-implementation-plan.md`，§17.2 签字矩阵中有明确状态记录（已签或"以 RC 状态启动"决定）。
- AE2. **Covers R2, R3, R4, R5.** 在 W1 D2 下午，dev #2 执行 `docker-compose up`，系统能连上 PostgreSQL、Redis、发出一封测试邮件，全链路无手动补密钥步骤。
- AE3. **Covers R6.** W7 开始前，1Password vault 中存有领星 OpenAPI 的 access_key + secret_key，且 staging IP 已在白名单中。
- AE4. **Covers R7, R8, R9.** W4 前，设计者打开 Figma 或 `docs/ui/` 中的 B 和 C 文档，能找到侧边栏每个导航项的目标页面布局和产品中心表单的字段列表。

---

## Success Criteria

- W1 D1 启动时，R1–R6 全部完成，无行政阻塞导致停工。
- W4 前，R7–R9 完成，前端开发者可在无口头沟通的情况下独立开始 shell 搭建。
- S1 末 alpha 试用顺利启动（R14 / R15 已落地），5 人能在当天开始使用。

---

## Scope Boundaries

- 本文档只追踪"实施前需完善"的工作，不包含 S1 代码实现本身。
- ERD 图（R11）只需覆盖运营域核心表，客户域 tenant schema 在 S3 前补充即可。
- API contract（R16）只需覆盖 S1 范围，S2+ 接口可滚动补充。
- 客服门户完整规范（R10）虽然 S3 才用，但放在 S2 内完成，避免 S3 开始时设计欠债。

---

## Key Decisions

- **邮件服务**：✅ **已决策 → Resend**（API 简洁，免费额度 100 封/天，与 Next.js 生态集成好；React Email 原生支持）。2026-04-30
- **PostgreSQL 托管**：✅ **已决策 → Neon**（serverless branching 支持 dev/staging 分支隔离，适合 2 人团队 PR 级数据库隔离）。2026-04-30
- **Redis 托管**：✅ **已决策 → Upstash free**（按请求计费，dev 阶段成本接近零；Redis Cloud free tier 500MB 固定）。2026-04-30
- **部署目标**：✅ **已决策 → PaaS（Railway / Fly.io）**（运维成本低，适合 2 人团队；Harness CD pipeline 已更新；K8s 留给 S5+ 规模时评估迁移）。2026-04-30

---

## Dependencies / Assumptions

- 领星 OpenAPI 申请走公司行政流程，预估 2-4 周。如果 W7 前未到账，W7-W8 领星集成工作需延期或改用 mock。
- v2.0-RC 签字依赖运营 PM 和公司管理层时间，可能非开发团队能控制；如无法在 W1 D1 前完成，建议以"正式启动即视为默认批准"机制推进，事后补签。
- UI 规范 B/C/Portal（R7-R10）由设计角色完成；如 2 人团队没有专职设计，则由 tech lead 在写代码前先写文字版 spec（参照现有 D/E 文档格式）。

---

## Outstanding Questions

### Resolve Before Planning

- ~~[Affects R12][User decision] 部署目标是 K8s 还是 PaaS？~~ **已决策：Railway / Fly.io（PaaS）**，Harness pipeline 已更新。2026-04-30

### Deferred to Planning

- [Affects R13][Needs research] Amazon SP-API S4 广告执行：领星是否支持通过其 API 代理执行广告操作（创建/暂停/改价），还是必须自己对接 SP-API？需联调确认。
- [Affects R16][Technical] API contract 文档工具：是用 OpenAPI/Swagger 自动生成还是手写 markdown？NestJS 有 `@nestjs/swagger` 可自动生成，建议在 W2 安装并设为 CI 产物。

---

## Next Steps

本文档缺口分为 4 个工作包，可并行推进：

1. **立即启动（本周）**：R1（签字状态）+ R2/R3/R4/R5（选型 + 账号）+ R6（领星申请）
2. **W2 前完成**：R11（ERD 图）+ R12 初步决策（部署目标）
3. **W4 前完成**：R7（Shell UI 规范 B）+ R9（Dashboard 规范）
4. **W5 前完成**：R8（产品中心 UI 规范 C）

→ 每个工作包完成后可独立进入 `/ce-plan` 做对应模块的实施规划。
