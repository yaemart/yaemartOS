---
date: 2026-05-04
category: backend_pattern
tags: [sse, eventsource, k8s, ingress, nginx, cookie-auth, agent-native]
applies_to: [S4-W46, all-realtime]
status: authoritative
related_adr: docs/adr/ADR-011-realtime-sync-strategy.md
related_plan: docs/plans/2026-05-04-004-agent-native-improvements-v2-plan.md
---

# SSE over K8s Ingress + HttpOnly Cookie Auth — Spike 验证

> 研究日期：2026-05-04 | 触发：W46 P0-A 引入 `/realtime/inbox`
> 目标：验证 NestJS `@Sse` + `EventSource` + HttpOnly cookie + ingress-nginx 端到端不被截断

---

## 关键结论摘要

| 问题                                                   | 验证结果                                                           | 备注                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------- |
| `Content-Type: text/event-stream` 过 ingress-nginx     | ✅ 默认放行                                                        | 需关闭 `proxy_buffering` 与 `proxy_request_buffering` |
| `EventSource` 不能带 Authorization header              | ✅ 已知 W3C 限制                                                   | 必须 cookie 或 query param                            |
| HttpOnly cookie 跨 origin（dev `:3000` → API `:4000`） | ✅ `credentials: include` + CORS `origin: true, credentials: true` | sameSite='lax' 在 dev 工作；prod 用 strict            |
| ingress 30s idle close                                 | ⚠️ 需 `proxy_read_timeout 3600s`                                   | 我们在 controller 端发 25s 心跳兜底                   |
| Cloudflare 在 SSE 路径上的 buffer                      | ⚠️ 必须把 `/realtime/*` 加入 "Cache Rules → Bypass cache"          | dev 不涉及；staging 起加规则                          |
| K8s service 切换 pod 时 SSE 连接                       | ✅ EventSource 自动重连                                            | client 已实现指数退避（max 6 retries）                |

---

## 一、为什么必须用 cookie 鉴权而不是 Authorization header

W3C SSE 规范明确禁止 `EventSource` 设置自定义 header，唯一可携带的凭证是 cookie 或 URL query。我们选 HttpOnly cookie 而非 query：

- **HttpOnly + secure + sameSite=strict**：JS 拿不到，CSRF 走 sameSite 兜底；
- query 方式会把 token 漏到 access log / referrer header / browser history，**不接受**。

JwtStrategy 已扩展为 `fromExtractors([authHeader, cookieExtractor])`，所有现有 Bearer API 调用零影响。

---

## 二、本地手工冒烟脚本

### 前置

```bash
pnpm -F @yaemartos/api dev      # 端口 4000
# 另一个 shell：
pnpm -F @yaemartos/web dev      # 端口 3000，用于浏览器流程
```

### 1. 登录拿到 cookie

```bash
curl -sS -c /tmp/yaemart-cookies.txt -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@yaemart.com","password":"<dev-password>"}' | jq .
cat /tmp/yaemart-cookies.txt | grep ya_sid    # 验证 cookie 已写
```

### 2. 启用 feature flag

```bash
ACCESS=$(jq -r .accessToken < /tmp/login.json)
curl -sS -X PUT http://localhost:4000/settings/feature-flags/AGENT_NATIVE_REALTIME_UI \
  -H "Authorization: Bearer $ACCESS" \
  -H 'Content-Type: application/json' \
  -d '{"value":"true"}'
```

### 3. 订阅 SSE（应保持连接、收到心跳）

```bash
curl -N -b /tmp/yaemart-cookies.txt http://localhost:4000/realtime/inbox
# 期望：连接保持，每 25s 一条 `event: heartbeat` + `data: {ts:...}`。
```

> `-N` 关闭 curl 缓冲；不加这个就看不到流式输出。

### 4. 触发一个事件（使用 debug-ping，仅 dev）

```bash
curl -N -b /tmp/yaemart-cookies.txt http://localhost:4000/realtime/debug-ping
# 期望：立即收到一条 `event: debug` 含 brand=自己的事件。
```

### 5. 浏览器端冒烟

打开 admin 页面（已登录），在 DevTools Network 面板看：

- `/realtime/inbox` 请求 status `200`、Type `eventsource`
- Response: `Content-Type: text/event-stream`
- Time: 持续 pending（保持连接）
- Console: `bus.status` → `'open'`

---

## 三、K8s ingress-nginx 配置要点

部署到 staging/prod 前，确保 ingress 注解：

```yaml
# infra/k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: yaemartos-api
  annotations:
    # 关键三条：禁缓冲、长超时、HTTP/1.1（禁 HTTP/2 server-push 在 SSE 路径下不需要，但保险关闭也行）
    nginx.ingress.kubernetes.io/proxy-buffering: 'off'
    nginx.ingress.kubernetes.io/proxy-request-buffering: 'off'
    nginx.ingress.kubernetes.io/proxy-read-timeout: '3600'
    nginx.ingress.kubernetes.io/proxy-send-timeout: '3600'
    nginx.ingress.kubernetes.io/configuration-snippet: |
      # SSE: 关闭 X-Accel-Buffering 缓冲，强制 chunked
      proxy_set_header X-Accel-Buffering no;
spec:
  rules:
    - host: api.yaemart.example
      http:
        paths:
          - path: /realtime/
            pathType: Prefix
            backend:
              service:
                name: yaemartos-api
                port:
                  number: 4000
          - path: /
            pathType: Prefix
            backend:
              service:
                name: yaemartos-api
                port:
                  number: 4000
```

> 我们暂未把 ingress YAML 提交到仓库（infra IaC 由 DevOps 维护）。**W47 必须做的事**：把这段配置 PR 给 DevOps，否则 staging 上 SSE 会 30 秒断一次。

### Cloudflare 路径规则（staging/prod）

控制台 → Cache Rules：

- 匹配 `/realtime/*`
- Action: **Bypass cache**
- Origin: 加 `Cache-Control: no-cache, no-transform`（NestJS 默认会发 `text/event-stream`，但显式加 header 防中间层）

---

## 四、CORS 与跨 origin cookie

dev 默认 `apps/web :3000` 与 `apps/api :4000` 跨 origin。我们已经在 `apps/api/src/main.ts` 设：

```ts
app.enableCors({
  origin: process.env.NODE_ENV === 'development' ? true : false,
  credentials: true,
});
```

`origin: true` 反射请求 origin（dev 可以接受），prod 必须改成显式白名单（W47 待办）。

`apps/web/lib/api/auth-client.ts` 的 `login` / `refreshTokens` 都加了 `credentials: 'include'`，浏览器才会接受 setCookie。

---

## 五、心跳 + 重连兜底

| 层        | 机制                                           | 兜底窗口                              |
| --------- | ---------------------------------------------- | ------------------------------------- |
| Server    | NestJS controller 每 25s 发 `event: heartbeat` | 防 30s ingress idle                   |
| Browser   | 内置 EventSource auto-reconnect                | server 主动 close 时立即重连          |
| App layer | `RealtimeBus` 6 次指数退避 (1/2/5/10/30/60s)   | feature flag off / cookie 过期 后停止 |

**注意**：浏览器原生 EventSource 在 5xx 后会无限重连（带 ~3s 退避）。我们之所以套一层 manual close+reconnect 是为了：

1. 让 401/403（feature flag off）能被识别并停止；
2. 让重连退避可控、可测试；
3. 让 `useEntityRevalidation` 可以暴露 `'reconnecting'` / `'error'` 状态给 UI（"实时更新已暂停"提示）。

---

## 六、常见踩坑清单

| 现象                      | 根因                                        | 修复                                                                                                        |
| ------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 浏览器永远拿不到 SSE 数据 | CORS `credentials` 没开                     | API: `credentials: true`，前端 `withCredentials: true`，cookie 不能 `sameSite: none` 的同时 `secure: false` |
| 连上后立即断开（30s 内）  | ingress idle 超时                           | 加 `proxy_read_timeout 3600s` 与 `X-Accel-Buffering: no`                                                    |
| `event: heartbeat` 没出现 | NestJS `@Sse` 未把 `interval` 流 merge 进去 | 已 merge 在 `realtime-sse.controller.ts`                                                                    |
| 跨 brand 用户看到别人事件 | brandId 过滤在 client 而非 bus              | `RealtimeBusService.subscribeForBrand()` 服务端过滤，客户端不可绕过                                         |
| Cloudflare 把 SSE 缓存了  | 默认 cache 规则把 text 类响应缓存           | "Cache Rules → Bypass cache" 路径规则                                                                       |
| 401 反复重连              | EventSource 默认无限重连                    | 我们在 6 次后停止；UI 应显示"请重新登录"                                                                    |

---

## 七、验收清单（W47 P0-E）

- [ ] dev：上述 5 步本地脚本全部通过
- [ ] dev：浏览器开 listing 编辑器，curl 调 `/realtime/debug-ping`，5s 内 toast 出现
- [ ] staging：ingress YAML PR 通过；30 分钟连接不断
- [ ] staging：跨 brand 隔离断言（A brand cookie 调 `?brand=B` → 403）
- [ ] staging：feature flag off → SSE 端点 401 / 前端 6 次后停止
- [ ] prod homtone：5 名 alpha 运营 1 周无 P0 故障

---

## 参考

- [ADR-011 实时同步策略](../../adr/ADR-011-realtime-sync-strategy.md)
- [W46-W52 checklist](../../W46-W52-checklist.md)
- [WHATWG SSE 规范](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [ingress-nginx SSE notes](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/#proxy-buffering)
