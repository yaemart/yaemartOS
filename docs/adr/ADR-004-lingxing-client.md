# ADR-004：LingxingClient 中间层设计

| 字段     | 取值                                                           |
| -------- | -------------------------------------------------------------- |
| 状态     | Proposed（W7 实施时评审）                                      |
| 提议日期 | 2026-04-30                                                     |
| 决策日期 | _S1 W7 评审通过后填写_                                         |
| 决策人   | tech lead + dev #2                                             |
| 关联文档 | `yaemartOS-implementation-plan.md` §2.3 / §3.2 / §6 W7 / §6 W8 |
| 取代     | 无                                                             |

---

## 1. 上下文

领星 ERP 是 yaemartOS 的核心数据源（订单 / 库存 / Listing 元数据 / 广告数据 / NetSuite 国内仓）。§3.2 已决策 **M3 半镜像 + 4 级 SLO 降级**策略。

不同业务模块对领星的调用方式分散：

- 路径 A 产品导入（同步批量）
- 客户中心订单查询（透传 + cache）
- 广告数据每日 cron（全镜像）
- 库存看板（混合）
- AI Agent 工具调用（即时 MCP）

如果每个模块各自直连领星 SDK，会导致：

- 限流不可控（领星 1 req/s 全局上限被多模块争抢）
- 错误率埋点散乱，§3.2 SLO 状态机无法生效
- 缓存策略不一致
- token 管理分散，refresh 逻辑可能失败
- 难做整体降级旁路

**决策**：所有领星调用强制走单点 `LingxingClient` 中间层。

---

## 2. 决策

### 2.1 模块结构

```
packages/lingxing-client/
├── src/
│   ├── index.ts                      # public API barrel
│   ├── client/
│   │   ├── lingxing-client.ts        # 主类：注入式 NestJS service
│   │   ├── http-transport.ts         # axios/fetch 包装 + interceptor
│   │   └── auth-manager.ts           # token 获取 / 刷新 / 缓存
│   ├── decorators/
│   │   ├── rate-limited.ts           # 令牌桶装饰器
│   │   ├── retry.ts                  # 指数退避重试
│   │   ├── cached.ts                 # Redis cache
│   │   └── circuit-broken.ts         # 熔断器（v2.x）
│   ├── slo/
│   │   ├── error-rate-tracker.ts     # 滑动窗口错误率
│   │   └── degradation-state.ts      # 4 级 SLO 状态机
│   ├── operations/                   # 按业务能力组织
│   │   ├── listings.ts               # ASIN 元数据 / 价格 / 类目
│   │   ├── orders.ts                 # 订单查询 / 订单详情
│   │   ├── inventory.ts              # 库存 / 在途 / NetSuite
│   │   ├── ads.ts                    # 广告数据 / 投放 / 关键词
│   │   └── shops.ts                  # 店铺 / 授权
│   ├── mirror/
│   │   ├── outbox-sync.ts            # 增量镜像
│   │   └── snapshot-sync.ts          # 全量镜像
│   ├── mcp/
│   │   └── mcp-bridge.ts             # MCP Agent 工具调用桥
│   ├── errors/
│   │   ├── lingxing-error.ts         # 错误类型层级
│   │   └── error-codes.ts
│   └── types/
│       └── ...                       # 全部 API 响应 TypeScript 类型
└── test/
    ├── fixtures/                     # 录制的真实响应（脱敏）
    └── ...
```

### 2.2 公开 API（NestJS Module）

```typescript
// app.module.ts
imports: [
  LingxingClientModule.forRoot({
    appId: process.env.LINGXING_APP_ID,
    appSecret: process.env.LINGXING_APP_SECRET,
    baseUrl: 'https://openapi.lingxing.com',
    rateLimitRps: 1,
    cacheRedisUrl: process.env.REDIS_URL,
    sloErrorWindowMs: 60_000,
  }),
]

// product.service.ts
constructor(private readonly lx: LingxingClient) {}

async loadFromLingxing(asin: string) {
  const meta = await this.lx.listings.getByAsin(asin, {
    cache: { ttl: 3600 },        // 1h
  });
  return meta;
}
```

### 2.3 Auth 管理

- **Token 获取**：启动时调 `/v1/auth` 获取 access_token + 过期时间
- **Token 缓存**：Redis key `lingxing:token`，TTL = 过期时间 - 5 分钟（提前刷新）
- **并发刷新保护**：Redis 分布式锁防多实例同时刷新
- **失败处理**：连续 3 次刷新失败 → 触发降级 P1 告警；客户域请求短路返回 503
- **Token 永不入日志 / Sentry breadcrumb**

### 2.4 限流（令牌桶）

- 全局令牌桶：1 token/s（领星账号 baseline；视实际配额调整）
- 实现：Redis Lua 脚本原子递减
- 桶满时调用阻塞 ≤ 30s；超时返回 `RateLimitedError`
- AI Agent MCP 调用走**优先级队列**（紧急任务优先消耗 token）
- 可观测性：Prometheus / Sentry counter `lingxing.rate_limit.wait_ms`

### 2.5 重试策略

```typescript
@retry({
  maxAttempts: 3,
  backoff: 'exponential',
  baseDelayMs: 500,
  retryOn: [408, 429, 500, 502, 503, 504, 'NETWORK_ERROR'],
  retryNoOn: [400, 401, 403, 404, 422],   // 业务错误不重试
})
```

- 第 1 次失败：500ms 后重试
- 第 2 次失败：1500ms 后重试
- 第 3 次失败：放弃，抛 `LingxingError` + 进 SLO 错误统计

### 2.6 缓存（场景化 TTL）

按 §3.2 数据分类：

| API 类型                        | TTL                    | 触发失效                                 |
| ------------------------------- | ---------------------- | ---------------------------------------- |
| `listings.getByAsin`            | 1h                     | webhook 回调 / `mirror.refreshListing()` |
| `orders.getStatus` (客户中心查) | 5min                   | 不主动失效（短 TTL 自然刷新）            |
| `inventory.getRealtime`         | 1min                   | —                                        |
| `inventory.getSnapshot`         | 1h                     | cron 同步触发                            |
| `ads.getDaily`                  | 不缓存（直接读镜像表） | —                                        |
| `auth.getToken`                 | token 过期前 5min      | —                                        |

- 缓存 key 格式：`lingxing:cache:{operation}:{hash(args)}`
- 缓存 miss → 调真实 API → 写缓存
- 写期间被其他请求"惊群"防护：分布式锁（同一 key）

### 2.7 SLO 状态机（与 §3.2 对齐）

```typescript
class DegradationState {
  private errorRateTracker: SlidingWindowCounter; // 60s 窗口

  getCurrentLevel(): 'normal' | 'l1' | 'l2' | 'l3' | 'outage' {
    const rate = this.errorRateTracker.getErrorRate();
    if (rate < 0.01) return 'normal';
    if (rate < 0.05) return 'l1';
    if (rate < 0.2) return 'l2';
    if (rate < 1.0) return 'l3';
    return 'outage';
  }

  applyPolicy(operation: string): {
    cacheTtlMultiplier: number;
    enqueueWrites: boolean;
    blockReads: string[];
    fallbackToMirror: boolean;
  } {
    switch (this.getCurrentLevel()) {
      case 'normal':
        return {
          cacheTtlMultiplier: 1,
          enqueueWrites: false,
          blockReads: [],
          fallbackToMirror: false,
        };
      case 'l1':
        return {
          cacheTtlMultiplier: 4,
          enqueueWrites: false,
          blockReads: [],
          fallbackToMirror: false,
        };
      case 'l2':
        return {
          cacheTtlMultiplier: 4,
          enqueueWrites: true,
          blockReads: [],
          fallbackToMirror: false,
        };
      case 'l3':
        return {
          cacheTtlMultiplier: 8,
          enqueueWrites: true,
          blockReads: ['orders.getStatus'],
          fallbackToMirror: true,
        };
      case 'outage':
        return {
          cacheTtlMultiplier: 24,
          enqueueWrites: true,
          blockReads: ['orders.getStatus', 'inventory.getRealtime'],
          fallbackToMirror: true,
        };
    }
  }
}
```

- 状态变更触发告警（P3/P2/P1/P0）
- 状态从高级别降回低级别需 5 分钟稳定时间（防抖）
- 状态机内部状态写入 Redis 让多实例共享

### 2.8 错误类型层级

```typescript
class LingxingError extends Error {
  code: string; // 'RATE_LIMITED' / 'AUTH_FAILED' / 'API_ERROR' / 'NETWORK_ERROR'
  status?: number; // HTTP status
  retryable: boolean;
}

class RateLimitedError extends LingxingError {
  code = 'RATE_LIMITED';
  retryable = true;
}
class AuthFailedError extends LingxingError {
  code = 'AUTH_FAILED';
  retryable = false;
}
class BusinessError extends LingxingError {
  code = 'API_ERROR';
  retryable = false;
}
class NetworkError extends LingxingError {
  code = 'NETWORK_ERROR';
  retryable = true;
}
```

业务代码用 `instanceof` 区分处理；不暴露 axios 错误对象。

### 2.9 MCP Agent 桥

- AI Agent 通过 MCP 协议调领星单次操作（如"创建广告"、"修改 ASIN 价格"）
- `mcp-bridge.ts` 提供 MCP server impl，把 MCP tool call 转化为 `LingxingClient` 调用
- 关键：**MCP 调用同样走全部限流 / 重试 / SLO 状态机**，不走旁路
- 高敏感操作（价格修改、新建广告活动）必须有 human_in_the_loop confirm（§2.2 AI Agent Native 原则）

### 2.10 镜像同步

#### Outbox 增量同步

- listing 元数据：领星 webhook → outbox 队列 → BullMQ worker 调 `LingxingClient.listings.getByAsin()` → 更新本地镜像表
- 兜底：每小时全量轮询所有 ASIN 比较 `last_modified_at`

#### Snapshot 全量同步

- 广告数据：每日 03:00 cron → `lingxing.ads.getDaily(yesterday)` → 写入本地镜像表（按日 partition）
- NetSuite 库存：每日 04:00 cron + 关键变更触发

> 同步任务用 BullMQ 单独 queue，与请求路径隔离。

---

## 3. 测试策略

### 3.1 录制 + 回放

- 开发阶段：调真实 dev 账号录制典型响应到 `test/fixtures/`
- 单元测试：HTTP transport mock，回放 fixtures，确保 LingxingClient 解析正确
- 集成测试：dev 账号实测（CI 跑前**先跑速率限制等待 60s**避免影响其他 PR）

### 3.2 故障注入

- **限流注入**：mock 返回 429 → 验证重试 + 退避正确
- **token 过期**：mock 401 → 验证 auth-manager 自动刷新
- **网络中断**：mock timeout → 验证 SLO 状态机切级
- **数据延迟**：mock 200OK 但响应延迟 30s → 验证超时逻辑

### 3.3 SLO 状态机测试

- 单元测试 sliding window 计数器
- 集成测试整体状态切换（正常 → l1 → l2 → l3 → outage → 恢复）
- 防抖测试：5 分钟内状态频繁切换不抖动

---

## 4. 监控与告警

### 4.1 关键指标（接入 §5.1 Sentry / Postgres metrics）

| 指标                              | 阈值        | 告警等级       |
| --------------------------------- | ----------- | -------------- |
| `lingxing.error_rate_60s`         | > 1%        | P3             |
| `lingxing.error_rate_60s`         | > 5%        | P2             |
| `lingxing.error_rate_60s`         | > 20%       | P1             |
| `lingxing.error_rate_60s`         | > 80%       | P0             |
| `lingxing.rate_limit.wait_ms.p95` | > 5s        | P3             |
| `lingxing.auth_refresh.failure`   | 连续 3 次   | P1             |
| `lingxing.cache.hit_rate`         | < 60%       | P3（性能问题） |
| `lingxing.degradation.level`      | l3 / outage | P1 / P0        |
| `mirror.sync.lag_sec`             | > 600       | P2             |

### 4.2 Dashboard

S2 Metabase 引入后建专用 dashboard：

- 实时调用量 / 成功率 / 延迟 P50/P95/P99
- 各 operation 调用占比
- SLO 状态机时间线（彩色色块按级别）
- Cache hit rate trend
- Rate limit 阻塞时间 trend

---

## 5. 安全

- App ID / App Secret 仅在 `LingxingClient` 内部读取，不暴露任何业务 service
- Token 永不写入业务日志 / 错误堆栈 / Sentry breadcrumb
- MCP 工具调用必须验证 user identity；高风险操作（创建广告、改价、转账）必须经 human-in-the-loop UI confirm
- 审计日志记录每次调用（operation / 调用方 user_id / 入参 hash / 出参 hash / 状态码 / 耗时）

---

## 6. 落地切片节奏

| 切片           | 增量                                                                              |
| -------------- | --------------------------------------------------------------------------------- |
| **S1 W1**      | 包骨架 + AuthManager + HttpTransport + LingxingError 类型层级                     |
| **S1 W7**      | `listings.getByAsin` + cache 装饰器 + 基本重试；用于路径 A                        |
| **S1 W8**      | MCP bridge + 单元测试 + fixtures 录制                                             |
| **S2 W14**     | 错误率埋点接入 Sentry；初步 SLO state（l1 仅缓存延长，未完整状态机）              |
| **S2 W21**     | Outbox 增量同步框架                                                               |
| **S3 W31**     | `orders.getStatus` 用于客户中心；降级 UI 文案与 LingxingClient 集成               |
| **S4 W40-W42** | `ads.getDaily` 全镜像 cron；`inventory.*` 双策略；完整 SLO 4 级状态机；P0/P1 告警 |
| **S5+**        | 镜像表数据治理 / 归档 / 性能优化                                                  |

---

## 7. 替代方案与拒绝理由

| 方案                                    | 拒绝理由                                                           |
| --------------------------------------- | ------------------------------------------------------------------ |
| 各模块直连领星 SDK                      | 限流 / 错误率 / 缓存策略分散，§3.2 SLO 无法实施                    |
| 用通用 API gateway（如 Kong）           | 杀鸡用牛刀；2 人团队运维成本高；难做业务定制（操作分类、镜像同步） |
| 拆成微服务独立部署                      | 当前规模不需要；增加运维成本                                       |
| 完全异步 event-driven（不暴露同步 API） | 业务场景太多即时同步需求（路径 A 解析、客户订单查询）              |

---

## 8. 验收

- [ ] 包骨架在 S1 W1 入仓（仅 stub）
- [ ] S1 W7 路径 A `listings.getByAsin` 跑通 dev / staging
- [ ] S1 W8 MCP 桥跑通至少 1 个 AI Agent 工具调用
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 故障注入测试套件全过
- [ ] code-review lint 规则：`@yaemartos/no-direct-lingxing-call`，禁止业务代码绕过 LingxingClient

---

## 9. 风险与未决项

| 风险                                        | 缓解                                                         |
| ------------------------------------------- | ------------------------------------------------------------ |
| 领星 OpenAPI 文档实际响应字段不稳定         | fixtures 频繁更新；schema 加 `dynamic: extra-fields-allowed` |
| 限流配额随月份调整                          | 配置化 RPS；Sentry 监控 429 比例触发自动降级                 |
| 单点故障（LingxingClient bug 影响所有调用） | CI 强制 80% 覆盖；故障注入；canary 部署                      |
| MCP 协议版本演进                            | mcp-bridge 单独 versioning，不影响主代码                     |
| token 刷新雪崩                              | 分布式锁防多实例并发刷；token 过期 5min 提前刷               |

---

_版本：v0.1 提案 | 最后修订：2026-04-30 | 实施评审：S1 W7_
