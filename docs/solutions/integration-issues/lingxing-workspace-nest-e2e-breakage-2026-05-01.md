---
title: 领星 workspace 包在 nest start + Playwright E2E 下模块解析与 DI 失败
date: 2026-05-01
category: integration-issues
module: lingxing-client
problem_type: integration_issue
component: development_workflow
symptoms:
  - 'Node.js v24 启动 API 时报 ERR_MODULE_NOT_FOUND，无法解析 packages/lingxing-client/src 内相对路径（如 errors/error-codes）'
  - 'Nest 报 LingxingMcpBridge / AuthManager 依赖无法解析，constructor 参数显示为 (? Symbol(...))'
  - 'Playwright W8 E2E 期望未登录返回 401，实际收到 404（路由不存在）'
root_cause: config_error
resolution_type: code_fix
severity: medium
tags:
  - lingxing-client
  - pnpm-workspace
  - nestjs-di
  - circular-dependency
  - playwright
  - e2e
related_components:
  - apps/api
  - packages/lingxing-client
  - scripts/test-e2e-local.sh
---

# 领星 workspace 包在 nest start + Playwright E2E 下模块解析与 DI 失败

## Problem

在本地运行 `./scripts/test-e2e-local.sh w8` 做 Playwright 专项验证时，API WebServer 无法正常启动或测试断言失败：先是 Node 无法加载 `@yaemartos/lingxing-client` 的 TypeScript 源码；修复后出现 NestJS 注入 `LingxingMcpBridge` / `AuthManager` 失败；再修复后出现 MCP 相关 HTTP 路径返回 **404** 而非预期的 **401**。

## Symptoms

- **`ERR_MODULE_NOT_FOUND`**：`Cannot find module '.../errors/error-codes' imported from .../index.ts`（裸路径无扩展名，在由 `dist/` 运行的 CommonJS 上下文中解析失败）。
- **Nest DI**：`Nest can't resolve dependencies of the LingxingMcpBridge (?, Symbol(LINGXING_CLIENT_OPTIONS))` 或 `AuthManager (?, +)` — 第一个参数类型显示为 `?`。
- **E2E**：对 `http://127.0.0.1:4000/ai/mcp/*` 的请求得到 **404**，而非 JwtAuthGuard 下的 **401**。

## What Didn't Work

- 仅依赖「已有 dev server」或 Vitest 通过：单元测试不执行 `nest start` 编译后的 `require` 路径，无法暴露 workspace 包入口问题。
- 不把 DI Symbol 从 `lingxing-client.module.ts` 抽到独立文件：`module → lingxing-client → http-transport → module` 的循环依赖在 CJS 加载顺序下会让 `@Inject(Symbol)` 在装饰器执行时读到 **`undefined`**。
- 仅修复 `auth-manager` / `mcp-bridge` 的 import，而 **`http-transport.ts` 仍从 `lingxing-client.module` 拉 Symbol**：循环链仍在，`design:paramtypes` 里 **`LingxingClient` 可为 `undefined`**，表现为 `LingxingMcpBridge` 首参无法解析。

## Solution

1. **发布可执行的 JS 产物**（workspace 包被 API 的 `dist/main.js` require 时必须是 JS）
   - 为 `packages/lingxing-client` 增加 `tsconfig.build.json`，`package.json` 的 `main`/`exports` 指向 `./dist/index.js`。
   - 在 `scripts/test-e2e-local.sh` 开头执行 `pnpm --filter @yaemartos/lingxing-client run build`，保证 E2E 启动前产物存在。

2. **打破循环依赖：统一从 `tokens.ts` 引用 Symbol**
   - 新建 `packages/lingxing-client/src/tokens.ts`，导出 `LINGXING_CLIENT_OPTIONS`、`REDIS_CLIENT`。
   - `auth-manager.ts`、`http-transport.ts`、`lingxing-client.ts`、`mcp-bridge.ts` **仅从 `./tokens`（或相对路径 `../tokens`）导入**，禁止再从 `lingxing-client.module.ts` 反向引用 Symbol。

3. **补齐 HTTP 契约**
   - 在 `apps/api/src/ai/ai.controller.ts` 增加 `GET /ai/mcp/tools` 与若干 `POST /ai/mcp/...`，并加 `JwtAuthGuard`，使未携带 JWT 的请求稳定返回 **401**，与 E2E 断言一致。

## Why This Works

- **`nest start --watch`** 将 API 编译到 `apps/api/dist/`；运行时 Node 按 `package.json` 的 `main` 解析 workspace 包。若 `main` 仍指向 **`src/index.ts`**，Node v24 不会用 ts-node 解释器加载依赖树，因而出现 **ERR_MODULE_NOT_FOUND**。指向 **`dist/index.js`** 后，与普通 npm 依赖一致。

- **CommonJS 循环依赖**下，模块未完成导出时先被 `require`，会导致 **Symbol token 与类构造函数在装饰器阶段为 `undefined`**，Nest 报告 `(?, ...)`。将 token 定义移到无业务依赖的 `tokens.ts`，并确保 **`http-transport` 不再 import module 文件**，可消除环路，使 `emitDecoratorMetadata` 生成的 `design:paramtypes` 在运行时指向真实的 `LingxingClient` 类。

- **401 vs 404**：只有注册了路由且挂了 Guard，未认证才会走 Guard 返回 401；未注册路由则永远是 404。

## Prevention

- **凡是「给 API 用的 workspace TypeScript 库」**：在 CI / `test:e2e` / `nest start` 路径上要么 **先 build 再跑**，要么在 ADR/脚本里明确「禁止仅指向 `src` 的 main」（与本仓库 `dist/` + `pnpm filter build` 模式对齐）。
- **Nest + monorepo**：禁止从 **`*.module.ts` 导出注入 token** 又被同一模块依赖的子文件 import；token 放在 **`tokens.ts`** 或独立常量文件。
- **新增需鉴权的 HTTP API**：同步补充 Playwright **未登录 401** 用例，避免「服务层已实现、路由未挂」的静默缺口。
- **会话侧线索**（session history）：先前会话中 W7 将 `lingxing-client` 的 `main` 指向 `src/index.ts` 在 Vitest 下可行，但在 \*\*`nest` 编译产物运行时暴露差异 — 两类命令应用不同验证。（session history）

## Related Issues

- 仓库内暂无同一问题的既有 solution 文档；本条目与 `docs/solutions/backend-patterns/nestjs-prisma-neon-multitenant-2026-04-30.md` 同属 Nest 实践但主题不同（低重叠）。
- 实施参考：`docs/adr/ADR-004-lingxing-client.md`（客户端分层）；W8 计划在 `docs/plans/2026-05-01-005-feat-w8-lingxing-mcp-bridge-plan.md`。
