# AGENTS.md — yaemartOS

跨境电商运营系统，服务 4 品牌（Homtone / Spoonlemon / Davivy / Tysun）× 38 名运营人员。

## 项目概况

- **技术栈**：Next.js 14 (App Router) + NestJS + TypeScript + PostgreSQL + Redis + Elasticsearch
- **UI**：Tailwind CSS 3.4 + shadcn/ui + Framer Motion，4 品牌 CSS Custom Properties 主题
- **AI**：Vercel AI SDK → Gemini 2.5 (S1 起) + GLM-5 (S2 起)
- **部署**：Docker Compose (dev) → K8s (staging/prod)
- **包管理**：pnpm monorepo，`@yaemartos/web`（前端）+ `@yaemartos/api`（后端）

## Docs 结构

```
docs/
├── adr/                    # Architecture Decision Records（技术选型决策，变更须评审）
├── ui/                     # UI 设计规范（各模块布局、组件、交互）
├── audits/                 # Agent-native 合规审计
├── privacy/                # 4 品牌隐私政策
├── eval-sets/              # AI 评估集与评分标准
├── solutions/              # 已解决问题的文档（bug、设计模式、工作流经验），
│                           # 按分类组织，YAML frontmatter 含 module / tags /
│                           # problem_type 字段，便于搜索。在已记录领域实现
│                           # 功能或排查问题时可参考。
├── secrets-vault-conventions.md
├── W1-D1-checklist.md
└── yaemartOS-implementation-plan.md   # 主实施方案（18 个月 6 切片）
```

## 关键约定

- **品牌主题**：通过 `data-brand` 属性 + CSS Custom Properties 实现，运行时零闪烁切换；勿用渐变色或每品牌独立组件
- **AI 写入规则**：AI 只能写入 `draft` 版本，用户手动激活；Active 版本不可被 AI 直接覆盖
- **IAM 维度**：`userId / brand / market / platform / shop / category / field`（Casbin RBAC+ABAC）
- **Dev Preview**：`/dev` 路由提供跨后台+4品牌门户的统一预览，`⌘1-5` 切换视角（仅开发环境）
- **Feature Flag**：每模块上线前必须有功能开关，支持按品牌/市场灰度
