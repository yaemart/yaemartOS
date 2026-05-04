# ADR-011：实时同步策略（Agent → UI）

**Date**: 2026-05-04（W45 末，W46 启动前置）
**Status**: Proposed → Accepted（待 leadership 异步评审 24h 无异议视为通过）
**Deciders**: David Gao + Backend Owner（待指派）+ Frontend Owner（待指派）
**Context**: [v2 plan P0-pre](../plans/2026-05-04-004-agent-native-improvements-v2-plan.md)；[审计 v2 dump §7 UI Integration 1/29 = 3%](../audits/2026-05-W45-agent-native-audit-v2.md)

---

## Context

`/ce-agent-native-audit` v2 dump 量化了一个明显的协作面短板：**29 个应有 UI 反馈的 mutation 工具中只有 1 个（`triggerPathAImport`）能在 5s 内向运营 UI 反映 agent 写入**——其余 28 个都需要用户手动刷新页面才能看到变化。

这违反 Agent-Native 原则 6（UI Integration），且当 38 名运营从 S5 起全员上岗（其中部分场景 agent 是主要作者）时会摧毁运营对 agent 的信任：「我看到的还是旧数据，agent 是不是没工作？」

实施层目前的 UI 更新机制有 4 类（按覆盖度）：

1. `router.refresh()`（仅在用户主动操作后触发，agent 调用不会触发）
2. 局部 `setState`（同上）
3. `setInterval` 轮询（仅 `import-job-progress.tsx`）
4. SSE / WebSocket / subscribe（**全仓库 0 命中**业务面）

`/ce-doc-review` 7 个 persona 评审一致认为：W46 启动 SSE 框架前**必须**先决策以下 4 个架构问题，否则会撞墙——这就是本 ADR 的范围。

---

## Decision Summary

| #      | 决策项                | 答案                                                                                                                                    | 影响                                                                                    |
| ------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **D1** | SSE 鉴权机制          | **HttpOnly cookie + JwtAuthGuard 增加 cookie 抽取分支**                                                                                 | 浏览器 EventSource 无法带 Authorization header；改造 1 个 guard 文件                    |
| **D2** | 跨 pod fanout         | **Redis pub/sub 作发布总线**（事件: `agent_write` / payload: `{entity, action, brandId, ids[]}`）；进程内 `Subject` 仅作本 pod 订阅广播 | 多副本 K8s 必须，否则 agent 写入打到 pod-A 时订阅在 pod-B 的运营浏览器收不到            |
| **D3** | mid-edit 数据竞争策略 | **toast 模式 + 用户主动确认**（不 auto-invalidate 用户正在编辑的实体）；其他场景 auto-invalidate                                        | 保护用户编辑期不丢失改动；P0-B/C/D 任务表中已分别标注 `mode: 'toast'` 或 `mode: 'auto'` |
| **D4** | Feature flag 治理     | `feature_flag.AGENT_NATIVE_REALTIME_UI`，按 brand 灰度；W46 dev / W48 staging / W52 prod                                                | 满足 AGENTS.md「每模块上线前必须有功能开关」强制要求                                    |

---

## Decision Detail

### D1：SSE 鉴权机制 → HttpOnly cookie + JWT cookie 抽取

#### 问题

浏览器原生 `EventSource` API 不支持 `Authorization` header（W3C SSE 规范限制）。当前 `JwtAuthGuard` 用 `passport-jwt` 的 `ExtractJwt.fromAuthHeaderAsBearerToken()` 链路抽取 token，**与 EventSource 不兼容**。

候选方案：

| 方案                                                      | 优点                                                    | 缺点                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **A. HttpOnly cookie + cookie 抽取分支** ✅               | 与现有 JWT 共用 secret；浏览器自动带 cookie；XSS 防护好 | 需要前端加 `withCredentials`；需要改 `JwtAuthGuard` 加 cookie 提取链            |
| B. 把 JWT 拼到 SSE URL query 上                           | 实施快                                                  | token 漏到 access log / referrer header；XSS 拿不到但 server log 拿得到——不接受 |
| C. 用 fetch streaming + `ReadableStream` 替代 EventSource | 可继续用 Authorization header                           | 浏览器兼容性、断线重连、ID 续传都得自己实现——成本远高于 cookie                  |

#### 选定方案：A

实施细节：

```typescript
// apps/api/src/auth/jwt-auth.guard.ts（改造）
import { ExtractJwt, Strategy } from 'passport-jwt';

const jwtFromRequest = ExtractJwt.fromExtractors([
  ExtractJwt.fromAuthHeaderAsBearerToken(), // 现有 API 调用保持
  (req: Request) => req?.cookies?.['ya_sid'], // 新增：SSE 走 cookie
]);
```

```typescript
// apps/api/src/main.ts
import cookieParser from 'cookie-parser';
app.use(cookieParser());
```

登录响应同时设置：

```typescript
// apps/api/src/auth/auth.controller.ts (login response)
res.cookie('ya_sid', accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: ACCESS_TOKEN_TTL_MS,
});
return res.json({ accessToken, refreshToken, user });
```

#### JWT 中途过期处理

SSE 连接打开后 30 分钟，accessToken 自然过期。决策：

- **服务端**：SSE handler 捕获 token expired 异常 → 发送 `event: auth-expired` 后关闭连接
- **客户端**：`useEntityRevalidation` hook 监听 `auth-expired` 事件 → 走 `refreshTokens` 流程刷新 cookie → 自动重连
- **不做**：JWT silent refresh in middleware（侵入性太强，留 S5 重新评估）

### D2：跨 pod fanout → Redis pub/sub

#### 问题

K8s 多副本部署时，agent 调用 `executeAdSuggestion` 打到 pod-A，运营浏览器 SSE 订阅挂在 pod-B → 运营收不到事件 → "前台仍是旧数据" 现象。

仓内已有 `customer-portal/chat` 用进程内 RxJS `Subject` 做 SSE 广播——这只在单 pod 工作。

#### 选定方案：Redis pub/sub

实施细节：

```typescript
// apps/api/src/realtime/realtime-bus.service.ts（新建）
@Injectable()
export class RealtimeBusService {
  constructor(
    @Inject('REDIS_PUB') private pub: Redis,
    @Inject('REDIS_SUB') private sub: Redis,
  ) {
    this.sub.subscribe('agent_write');
    this.sub.on('message', (ch, msg) => {
      const evt = JSON.parse(msg) as RealtimeEvent;
      this.local$.next(evt); // 本 pod 内广播
    });
  }

  private local$ = new Subject<RealtimeEvent>();

  publish(evt: RealtimeEvent): Promise<void> {
    return this.pub.publish('agent_write', JSON.stringify(evt));
  }

  subscribeForBrand(brandId: string): Observable<RealtimeEvent> {
    return this.local$.pipe(filter((e) => e.brandId === brandId));
  }
}
```

事件 schema：

```typescript
type RealtimeEvent = {
  entity: 'listing' | 'listing-version' | 'ad-suggestion' | 'ad-change'
        | 'ad-daily-stat' | 'shop-binding' | 'system-config' | 'migration-job' | ...;
  action: 'create' | 'update' | 'delete';
  brandId: string;
  ids: string[];           // 受影响行 id 列表
  actorType: 'user' | 'agent';
  actorId: string;
  timestamp: number;
};
```

#### 写入端集成

mutation controller / service 在写库成功后调用 `bus.publish(evt)`。**不做** AOP 拦截器自动发——显式调用更可控、易调试，新人也容易理解。

#### Redis 连接

复用现有 `apps/api/src/database/redis.service.ts`（AI rate limit 已经在用 Redis）。新建两个连接（pub 与 sub 必须独立 connection，ioredis 限制）。

### D3：mid-edit 数据竞争策略 → toast 模式

#### 问题

design-lens reviewer 指出：用户在编辑 listing 时，agent 调用 `generateListingDraft` 产生新版本——若 UI 自动 invalidate + refresh，用户输入的未保存改动会丢失。

#### 选定方案：双 mode `useEntityRevalidation` hook

```typescript
type RevalidationMode = 'auto' | 'toast';

useEntityRevalidation(entity: EntityName, opts: {
  mode: RevalidationMode;
  filterIds?: string[];   // 仅匹配这些 id 的事件触发
});
```

**`mode: 'toast'` 行为**：

- 收到 SSE 事件后**不**自动 `invalidateQueries` / `router.refresh`
- 显示 toast：「Agent X 修改了此 [实体]，[查看变更]」
- 用户点击 toast → 弹 confirm dialog（"是否丢弃当前编辑？"）→ 确认后才刷新

**`mode: 'auto'` 行为**：

- 收到 SSE 事件后立即 `invalidateQueries` + `router.refresh`
- 适用：列表页、看板、变更历史等无用户编辑态的场景

#### 各页面 mode 配置（v2 plan 已写入）

| 页面                           | Mode  | 理由                               |
| ------------------------------ | ----- | ---------------------------------- |
| Listing 编辑器                 | toast | 用户编辑期保护                     |
| 广告建议列表 / 看板 / 变更历史 | auto  | 列表无编辑态                       |
| 店铺绑定列表                   | toast | 用户可能正在编辑绑定参数           |
| Settings 三个面板              | toast | 用户可能正在编辑 flag/router/theme |
| Migration 进度 + 任务列表      | auto  | 进度面板天然就是被动观察           |

### D4：Feature flag → `AGENT_NATIVE_REALTIME_UI` + 灰度

#### AGENTS.md 强制要求

> **Feature Flag**：每模块上线前必须有功能开关，支持按品牌/市场灰度

#### 选定 flag 结构

`SystemConfig` key: `feature_flag.AGENT_NATIVE_REALTIME_UI`
Value（JSON）：

```json
{
  "enabled": false,
  "perBrand": {
    "homtone": { "enabled": false },
    "spoonlemon": { "enabled": false },
    "davivy": { "enabled": false },
    "tysun": { "enabled": false }
  }
}
```

#### 灰度时间线

| 阶段             | 时间     | 范围                                  | 触发条件               |
| ---------------- | -------- | ------------------------------------- | ---------------------- |
| W46 dev          | W46 起   | 仅 dev / staging 环境（env override） | P0-A 完成              |
| W48 staging      | W48 起   | staging 单 brand（homtone）           | P0-D 完成              |
| W50 staging 全   | W50 起   | staging 全 4 brand                    | P0-E E2E 通过          |
| W52 prod homtone | W52      | prod homtone（5 名 alpha 运营）       | 重审计通过             |
| W52+1 prod 全    | W52+1 周 | prod 全 4 brand                       | homtone 1 周无 P0 故障 |

#### 控制路径

- **后端 SSE 端点**：`@FeatureFlagGuard('AGENT_NATIVE_REALTIME_UI')` 装饰；flag off 时直接 401
- **前端 hook**：`useEntityRevalidation` 内部 short-circuit；flag off 时不连接 SSE
- **运行时切换**：通过 `setFeatureFlag` 工具或 Settings UI 改 SystemConfig；60s 内全 pod 生效（已有 cache TTL）

---

## Consequences

### 正面

- 解锁 UI Integration 1/29 → 18/29，agent 写入对运营即时可见
- 与现有 JwtAuthGuard / Casbin / FeatureFlagGuard / Audit / Redis 架构无缝集成
- toast 模式保护用户编辑期，避免数据丢失
- feature flag + 灰度保证回滚便利
- 为 S5 客户工单实时推送、chat agent 实时事件铺好基础设施

### 负面

- `JwtAuthGuard` 增加 cookie 抽取分支带轻微复杂度（双路径 → 单测必须覆盖两条）
- 增加 Redis pub/sub 通道（已有 Redis 集群，无新基础设施成本）
- `RealtimeBusService` + `useEntityRevalidation` hook 是新抽象，团队需学习
- toast 模式增加用户认知负担（"agent 改了，我要不要刷新？"）—— 通过 P2-C 埋点 4 周采集判断 UX 是否健康

### 风险与缓解

| 风险                                                 | 缓解                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| K8s ingress 切断 SSE event-stream content-type       | W46 P0-A spike 1 天验证 ingress 配置；如失败 fallback 到 5s 短轮询（同 hook 接口）                           |
| Redis pub/sub 吞吐瓶颈                               | 当前 AI rate limit Redis QPS < 100，pub/sub 增加 ≤ 100 × 38 名运营 ≈ 3800 events/s 上限；4Vcore 节点完全够用 |
| toast 模式让用户体验割裂（一会儿 toast 一会儿 auto） | P2-C 埋点收集；如分歧严重，统一改 toast 模式                                                                 |
| HttpOnly cookie 与现有 localStorage token 共存期 BUG | 双写（Authorization header + cookie）保持 1 周兼容期；W47 末删 localStorage 路径                             |

---

## Alternatives Rejected

### 方案 1：用 WebSocket 代替 SSE

**驳回原因**：

- 当前 NestJS `@Sse` 已在 `customer-portal/chat` 验证可用
- WebSocket 双向通信本场景不需要（事件单向：server → client）
- WebSocket 需要 socket.io 或 ws，bundle 增量大于 SSE
- K8s ingress 对 WebSocket 升级请求处理更复杂

### 方案 2：放弃实时同步，全用 5s 短轮询

**驳回原因**：

- 5s × 29 个页面 × 38 名运营 = 持续 ~220 QPS 的"无效轮询"，浪费服务器资源
- 5s 延迟仍然让 agent 写入"看起来卡顿"
- 真正解决"信任 agent"问题需要 < 1s 的反馈

### 方案 3：用 React Server Components 的 `revalidatePath`

**驳回原因**：

- `revalidatePath` 只能在 server action 中调用，agent 走的是独立 REST API（不经过 server action）
- 该方案无法跨 pod 通知（每个 pod 维护自己的 RSC 缓存）

---

## Implementation Checklist (W46–W47)

- [ ] 加 `cookie-parser` 中间件（`apps/api/src/main.ts`）
- [ ] `JwtAuthGuard` 增加 cookie 抽取分支 + 单测
- [ ] `auth.controller.ts` 登录响应同时 setCookie
- [ ] 新建 `apps/api/src/realtime/realtime-bus.service.ts`（Redis pub/sub）+ 单测
- [ ] 新建 `apps/api/src/realtime/realtime-sse.controller.ts`（`@Sse('/sse/inbox')` + Casbin brandId 过滤）+ E2E
- [ ] `RealtimeModule` 注册到 `AppModule`
- [ ] `feature_flag.AGENT_NATIVE_REALTIME_UI` 默认值写入 `seed.ts`
- [ ] `apps/web` 添加 `@tanstack/react-query` + `QueryProvider`
- [ ] `apps/web/lib/realtime/use-entity-revalidation.ts` hook + 双 mode 单测
- [ ] 选定写入端集成（listing / ads/suggestions / shops controller 调 `bus.publish()`）
- [ ] Playwright SSE helper（subscribeSse + 跨 brand 隔离断言）
- [ ] ingress spike：验证 `Content-Type: text/event-stream` 与 `X-Accel-Buffering: no` 在生产 K8s 上工作
- [ ] 文档：`docs/solutions/` 写一篇 SSE keep-alive 调优经验（如 spike 中发现问题）

---

## References

- [v2 plan §3 P0 + §8 风险表 + §10 DoD](../plans/2026-05-04-004-agent-native-improvements-v2-plan.md)
- [审计 v2 dump §7 UI Integration](../audits/2026-05-W45-agent-native-audit-v2.md)
- AGENTS.md「Feature Flag：每模块上线前必须有功能开关」
- ADR-005 AI Services（Vercel AI SDK + 现有 SSE 在 chat 验证经验）
- ADR-006 IAM Casbin（brandId 过滤源）
- ADR-008 Tenant Middleware（`x-yaemart-brand` header 模式 → SSE 改 cookie 内 brandId 选择）
