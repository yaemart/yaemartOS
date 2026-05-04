# ADR-012：Customer chat 接入 Vercel AI tool calling 子集

**Date**: 2026-05-04（W47 末，W48 启动前置）
**Status**: Proposed → Accepted（待 leadership 异步评审 24h 无异议视为通过）
**Deciders**: David Gao + Backend Owner（待指派）+ Frontend Owner（待指派）
**Context**: [W46 末 Action Parity 单项审计](../audits/2026-05-W46-action-parity-single-audit.md)；[v2 plan §13 落地后回头审计](../plans/2026-05-04-004-agent-native-improvements-v2-plan.md)；checklist [`P1-B-mod-v2`](../W46-W52-checklist.md)

---

## Context

W46 末 Action Parity 单项审计发现：**静态 tool 描述符 60 条，覆盖 88.2% 的 admin user action**——但 **LLM runtime tool calling = 0**。换言之，agent 看上去什么都"能做"，但实际只会聊天，所有行动都靠引导用户点击 admin UI。

最大的可观测落差不在 admin 端（admin 用户已经熟知后台路径），而在 customer-portal `/chat` 上：

- 客户问"我的工单进展？"→ AI 只能转述模板化回答，不会读 `Ticket` 表
- 客户问"我的保修还有几个月？"→ AI 只能让客户自己点保修页面
- 客户问"我的订单到哪了？"→ AI 只能引导手动输入订单号

这违反 Agent-Native 原则 1（Action Parity）和原则 4（Shared Workspace）：客户能做的查询，agent 不能代查；agent 看到的 system prompt 注入了 `openTickets` / `recentOrders`（已实现）但**仅作为只读上下文**，无法主动触发新动作。

W47 P0-A/B/C/D/E 已经把 admin 侧 SSE 实时同步打通，但 admin 这边 mutation 主要由 admin user 自己在 UI 上做，agent 的"代做"还没真正触发。**customer-portal chat 是最有产品 ROI 的破冰点**：客户已经在用 AI 提问，只差 agent 真的会"代客户做事"。

W47 末经容量评估：原 `P1-B-mod`「MCP 工具自述模块（admin 侧 /help 页面 + 前端 tool 列表 UI）」60% 已由 `GET /ai/mcp/tools` 落地，剩余「前端 /help 页面」并入 W50 `P2-B-1` 本就规划的 `/help` 页面（零增量工时）。腾出的 2 人日改投到 customer chat tool calling。

---

## Decision Summary

| #      | 决策项                          | 答案                                                                                                                            | 影响                                                            |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **D1** | tool 子集范围                   | **8 条 customer-self mirror**（ticket: 3 / warranty: 2 / order: 1 / manual: 2）                                                 | W48 单 sprint 可完成；其余客服 tool 留给 W50+ 评估              |
| **D2** | IAM 校验位置                    | **tool execute 内**，强制 `ctx.customerId` 来自已认证 chat session（不接受 LLM 参数注入 customerId）                            | 防 prompt-injection 升权；同 brand 不同客户互不可见             |
| **D3** | 错误回灌策略                    | **结构化 `{ ok: false, error: 'STABLE_CODE', message: 'human-readable' }`**，**不抛异常给 LLM**                                 | LLM 看到 stable code 才能稳定 graceful 回复；人类信息给客户参考 |
| **D4** | feature flag 治理               | **新增 `feature_flag.AGENT_NATIVE_TOOL_CALLING`**（独立于 `AGENT_NATIVE_REALTIME_UI`）                                          | 单独灰度回滚：tool calling 出问题不影响 admin 实时同步          |
| **D5** | system prompt 能力 summary 来源 | **运行时从 tool 注册表 derive**（不硬编码到 system prompt 字符串）                                                              | 加 / 删 tool 不需要改 prompt，避免漂移                          |
| **D6** | order lookup 绕过 CAPTCHA       | **新方法 `OrderLookupService.lookupForChatTool(customerId, orderNumber)`**：要求 `customerId !== null`，记录 source='chat-tool' | 已登录客户在 chat 内查询不必再过 Turnstile；匿名 chat 无此能力  |

---

## Decision Detail

### D1：tool 子集 = 8 条 customer-self mirror

按"客户在 customer-portal 自己 UI 上能做的事，agent 也能做"为筛选标准。Admin-only 操作（如分配工单、改单状态）**不**纳入，避免越权。

| Tool 名                    | 后端 service                                    | 描述                                                   | 是否需登录 |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------ | ---------- |
| `listMyTickets`            | `TicketService.findByCustomer`                  | 列出当前客户工单                                       | ✅         |
| `createCustomerTicket`     | `TicketService.create`                          | 代客户提交新工单                                       | ✅         |
| `addCustomerTicketMessage` | `TicketService.addMessage`                      | 在已存在工单中代客户追加一条消息                       | ✅         |
| `listMyWarranties`         | `WarrantyService.listByCustomer`                | 列出当前客户保修注册                                   | ✅         |
| `registerWarranty`         | `WarrantyService.register`（不带 invoice 文件） | 代客户注册保修；不接受文件上传，提示客户后续在 UI 补传 | ✅         |
| `customerOrderLookup`      | `OrderLookupService.lookupForChatTool`          | 查询订单状态（绕 CAPTCHA，要求 customerId）            | ✅         |
| `listProductManuals`       | `ManualService.listManuals`                     | 列出本品牌产品手册                                     | 否（公开） |
| `getProductManual`         | `ManualService.getManual`                       | 拿到指定 SKU + locale 的手册下载 URL                   | 否         |

不入选名单（明确排除）：

- `closeByCustomer` 工单：避免 LLM 误关导致流程中断
- `updateTicketStatus` / `assignTicket` / `addAgentMessage`：admin-only
- `lookupOrderStatus`（admin 版）：客户不应触达管理员快查通道

### D2：IAM 校验位置 = tool execute 内 + customerId 锁定

**绝对原则**：tool 的 `inputSchema` **不接受** `customerId` / `brandId` 字段。`ctx.customerId` 来自已经被 `CustomerGuard` + `CustomerTenantGuard` 验证过的 chat session，注入 tool 工厂时锁定。

```ts
// 错误示范（漏洞）：
inputSchema: z.object({ customerId: z.string(), ... })
// → LLM 把 customerId 改成别人的就能查到别人的工单

// 正确：
inputSchema: z.object({ /* 只接业务参数 */ })
execute: async (args) => {
  if (!ctx.customerId) return { ok: false, error: 'NOT_AUTHENTICATED' };
  return await ctx.ticket.findByCustomer(ctx.customerId, args.page, args.limit);
}
```

匿名 chat（无 customerId）调用需登录的 tool 必须返回 `{ ok: false, error: 'NOT_AUTHENTICATED' }`，不能 throw、不能 silently 忽略。

### D3：错误回灌 = 结构化 `{ ok: false, error: 'CODE' }`

Vercel AI SDK 的 `tool.execute` 返回值会被序列化进 LLM 的 toolResult 消息。如果抛异常，整个 `streamText` 会中断，客户看到的是空白或错误。

策略：

- 业务错误（404 / 403 / 验证失败）→ 返回 `{ ok: false, error: 'STABLE_CODE', message: 'human readable' }`
- 系统错误（DB 挂了、Lingxing 不可用）→ 同样返回 `{ ok: false, error: 'SERVICE_UNAVAILABLE' }`，由上层 `chat.service` 决定是否触发"已为您升级到人工"流程
- 错误码字典（保持稳定，便于评估集断言）：
  - `NOT_AUTHENTICATED`
  - `NOT_FOUND`
  - `FORBIDDEN`
  - `BAD_REQUEST`
  - `RATE_LIMITED`
  - `SERVICE_UNAVAILABLE`
  - `UNKNOWN_ERROR`

### D4：feature flag 独立 — `AGENT_NATIVE_TOOL_CALLING`

为什么不复用 `AGENT_NATIVE_REALTIME_UI`：两者影响面完全独立，绑在一起会让单方面回滚变成全停摆。

灰度计划：

- W48 dev：默认 on（运营评估集跑得起来）
- W48 末 staging：homtone on，spoonlemon/davivy/tysun off（验证客户真实交互）
- W50 早 prod：staging 单 brand on 满 1 周后开 homtone prod
- W52：根据 v3 审计结果决定剩余 brand

控制点：`chat.service.ts:streamText({ ... })` 的 `tools` 字段，flag off 时不传 `tools`（行为完全等价于现在）。

### D5：system prompt 能力 summary derive 自 tool 注册表

不硬编码"You can do X, Y, Z"到 prompt 字符串里。改成：

```ts
const toolSummary = Object.entries(tools)
  .map(([name, t]) => `- ${name}: ${t.description}`)
  .join('\n');
const systemPrompt = `... You have access to the following tools (call them only when the customer's intent matches):\n${toolSummary}\n...`;
```

后续加 / 删 tool 直接改 `customer-chat-tools.ts`，prompt 自动更新。这也方便 W50 `P2-B-1` /help 页面用同一份注册表渲染"AI 能为您做什么"卡片。

### D6：OrderLookupService 新方法 `lookupForChatTool`

现有 `lookup(orderNumber, turnstileToken, ip)` 强制 CAPTCHA，目的是防爬虫扫单号。

但 chat 内的客户已经走过：

1. customer-portal 登录（`CustomerGuard`）
2. chat session 创建（`ChatService.getOrCreateSession`，绑定 customerId）

再让他们过 Turnstile 体验糟糕。新方法签名：

```ts
async lookupForChatTool(customerId: string, orderNumber: string): Promise<OrderLookupResult | OrderLookupNotFound>
```

不同点：

- 跳过 `turnstile.verifyOrThrow`
- `logAttempt` 中记录 `resultStatus = 'chat-tool:found' | 'chat-tool:not_found'`，便于审计
- **强制要求 customerId**：调用方传 null 直接抛 `BadRequestException`（防止匿名 chat 通过 tool 间接绕 CAPTCHA）
- 频率限制：交给 `Throttler` + `chat.controller.ts` 既有 `@Throttle({ limit: 30, ttl: 60000 })`，不再单独加

---

## Consequences

**Positive**:

- Action Parity 真实分数从静态 88.2% → runtime 88.2%（不再是"看起来能但其实不能"）
- customer-portal chat 真的会代客户查/做事，客户感知度直接打破（前 9 周客户感知 = 0）
- 后续 W50 `/help` 页面有现成 derive 数据源
- W52 v3 审计可以打勾"runtime tool calling > 0"

**Negative / Risks**:

- LLM 选错 tool（e.g. 客户问"取消订单"，模型调用 `createCustomerTicket`）：在 D1 子集排除"破坏性"操作，create/list 类即使误调成本也低
- `registerWarranty` 不接受 invoice 文件：tool 内只能注册不带凭证，发完后必须提示客户去 UI 补传——靠 system prompt 引导
- Vercel AI SDK 升级时 tool API 可能变：W48 锁定到当前版本，W52 v3 审计前不动；详见 [tool calling 风险跟踪](../W46-W52-checklist.md#关键风险跟踪)

**Migration / Rollback**:

- feature flag off 时 `streamText` 不传 `tools` 字段，行为完全回退到 W47 末状态
- DB 没有 schema 变更，回滚不需要 migration

---

## Open Questions（W48 实现期解决）

1. tool 调用过程中如果客户离开 / SSE 断开，正在 execute 的 tool 是否要 abort？
   - **暂定方案**：execute 不可 abort（service 层操作很快，<200ms），返回结果如果客户已断连就丢弃
2. 多 tool 链调（agent 第一次调用 listMyTickets 后再调 addCustomerTicketMessage）是否限制单次 streamText 内的 tool call 数？
   - **暂定方案**：Vercel AI SDK `maxSteps: 3`（够 3 步链调，足以应付绝大多数客服场景）
3. tool 执行超时？
   - **暂定方案**：service 层方法本身有超时（DB 5s / Lingxing 10s），tool 不再加额外超时

---

## References

- [Vercel AI SDK tool calling](https://ai-sdk.dev/docs/foundations/tools)
- [Action Parity 审计 W46](../audits/2026-05-W46-action-parity-single-audit.md)
- [v2 plan §13 落地后回头审计](../plans/2026-05-04-004-agent-native-improvements-v2-plan.md)
- [W46-W52 checklist P1-B-mod-v2](../W46-W52-checklist.md)
