---
title: ADR-002 Git 分支策略与 CI 门禁
status: accepted
date: 2026-05-01
supersedes: []
---

# ADR-002：Git 分支策略与 CI 门禁

## 上下文

yaemartOS 采用 monorepo，需要约定默认分支、特性分支命名以及合并前质量门禁，以便与 GitHub Actions、后续 Neon 分支 CI（W2）对齐。

## 决策

1. **主干**：`main` 为集成分支；发布分支使用 `release/x.y`（与 CI `build` job 条件一致）。
2. **特性分支**：`feat/<short-scope>`、`fix/<short-scope>`、`chore/<short-scope>`；避免无意义机器名分支。
3. **合并要求**：PR 必须通过 `.github/workflows/ci.yml` 中的 **lint-typecheck**、**test**；合并到 `main` / `release/*` 的路径上还需 **build** job。
4. **E2E**：`e2e` job 依赖单元测试通过后运行 Playwright 冒烟；数据库使用 workflow 内嵌 Postgres 服务 + `prisma migrate deploy`。
5. **文档-only 变更**：可通过后续迭代在 CI 增加 `paths-ignore`（当前未启用，避免遗漏依赖文档的配置变更）。

## 后果

- 贡献者在 PR 中可获得一致的自动化反馈。
- 发布节奏与 `release/**` 分支及镜像构建流程可直接挂钩（staging/prod 见总体规划）。
