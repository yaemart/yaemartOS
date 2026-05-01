# ADR-005：AI Services 层接口设计

| 字段     | 取值                                                           |
| -------- | -------------------------------------------------------------- |
| 状态     | Proposed（W1 实施时评审）                                      |
| 提议日期 | 2026-04-30                                                     |
| 决策日期 | _S1 W1 D4 评审通过后填写_                                      |
| 决策人   | tech lead + dev #2                                             |
| 关联文档 | `yaemartOS-implementation-plan.md` §2.2 / §3 / §3.1 / §6 W1-D4 |
| 取代     | 无                                                             |

---

## 1. 上下文

§3.1 已决策 **方案 3+4 单模型起步 + Vercel AI SDK**：S1 仅 Gemini 不做 router/fallback/rate-limit/cost-tracking；S2-S4 渐进引入。

不同业务场景对 AI 的调用方式差异巨大：

- Listing 撰写（长文本，结构化输出 JSON Schema）
- 客服 AI Chat（流式回复，多轮上下文，工具调用 RAG）
- 路径 A 数据解析（图像/PDF 多模态，结构化抽取）
- AI Agent MCP 调用领星（tool calling）
- 广告优化建议（中文运营，GLM-5）

如果业务代码各自直连 AI SDK，会导致：

- Provider 切换困难（S2 引入 GLM-5 时改动面巨大）
- 成本追踪散乱（无统一计费视角）
- Fallback / Rate Limit 装饰逻辑无统一植入点
- prompt 与代码混在一起，迭代困难

**决策**：所有 LLM 调用必须走 AI Services 层；3 个核心 service 类按使用语义拆分。

---

## 2. 决策

### 2.1 模块结构

```
packages/ai-services/
├── src/
│   ├── index.ts
│   ├── module.ts                          # NestJS module
│   ├── services/
│   │   ├── listing-generation.service.ts  # 多语言 listing 生成
│   │   ├── mcp-tool-call.service.ts       # AI Agent 工具调用
│   │   └── structured-extraction.service.ts # 多模态 → JSON Schema
│   ├── providers/
│   │   ├── gemini-provider.ts             # S1 + 全程
│   │   └── glm-provider.ts                # S2+ 引入
│   ├── prompts/                           # prompt template (markdown 文件)
│   │   ├── listing/
│   │   │   ├── amazon-en.md
│   │   │   ├── amazon-es.md (S3+)
│   │   │   └── walmart-en.md (S2+)
│   │   ├── chat/
│   │   │   └── customer-support.md
│   │   ├── extraction/
│   │   │   ├── lingxing-listing-meta.md
│   │   │   └── manual-pdf-content.md
│   │   └── ad-optimization/               # GLM-5 (S2+)
│   │       └── amazon-ppc-cn.md
│   ├── decorators/
│   │   ├── cost-tracking.ts               # S2+ 引入
│   │   ├── rate-limited.ts                # S4+ 引入
│   │   └── fallback.ts                    # S3+ 引入
│   ├── router/                            # S2+ 引入：模型路由
│   │   └── model-router.ts
│   ├── observability/
│   │   ├── token-counter.ts
│   │   ├── prompt-logger.ts               # 入审计日志
│   │   └── cost-tracker.ts                # S2+ 引入
│   ├── errors/
│   │   ├── ai-error.ts
│   │   └── error-codes.ts
│   └── types/
│       ├── messages.ts                    # 统一消息类型
│       └── outputs.ts                     # 输出 zod schema 类型
└── test/
    ├── fixtures/                          # 录制响应（测试用）
    ├── eval-sets/                         # 评测集（M-03 / M-06 / M-08）
    └── ...
```

### 2.2 公开 API（NestJS Module）

```typescript
imports: [
  AiServicesModule.forRoot({
    providers: {
      gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        models: {
          pro: 'gemini-2.5-pro',
          flash: 'gemini-2.5-flash',
          embedding: 'text-embedding-004',
        },
      },
      // S2+ 加入
      // glm: { apiKey: process.env.GLM_API_KEY, models: { ... } },
    },
    defaults: {
      timeout: 30_000,
      maxRetries: 1, // S1 单次重试；S3+ 升级到 2 次 + fallback
    },
    auditLogger: process.env.NODE_ENV === 'production' ? prodLogger : devLogger,
  }),
];
```

### 2.3 Service #1：`listingGenerationService`

**职责**：多语言 listing 内容生成（Title / Bullets / Description / A+ / Backend Keywords），适配多平台字符规则。

```typescript
@Injectable()
export class ListingGenerationService {
  /**
   * 生成 listing 内容
   */
  async generate(input: ListingGenerationInput): Promise<ListingContent> {
    const promptTemplate = await this.loadPrompt(`listing/${input.platform}-${input.locale}.md`);
    const prompt = this.fillTemplate(promptTemplate, input);

    return await this.gemini.generateStructured({
      model: 'pro',                                  // 长文本，复杂逻辑用 Pro
      messages: [{ role: 'user', content: prompt }],
      schema: ListingContentSchema,                  // zod 强制结构
      temperature: 0.7,
      timeout: 30_000,
    });
  }

  /**
   * 仅生成关键词建议（轻量，用 Flash）
   */
  async suggestKeywords(input: KeywordSuggestInput): Promise<string[]> { ... }

  /**
   * 仅生成 A+ 模块
   */
  async generateAPlusModule(input: APlusInput): Promise<APlusModule> { ... }

  /**
   * S1 hello world：用于 W1 D4 验收，调通 Gemini Flash
   */
  async helloWorld(): Promise<string> {
    const result = await this.gemini.generate({
      model: 'flash',
      messages: [{ role: 'user', content: 'Say hello to yaemartOS in one short sentence.' }],
    });
    return result.text;
  }
}
```

#### Input / Output 类型

```typescript
type ListingGenerationInput = {
  productId: string;
  brand: 'homtone' | 'spoonlemon' | 'davivy' | 'tysun';
  market: 'us' | 'ca' | 'uk' | 'de' | 'fr' | 'es' | 'jp';
  platform: 'amazon' | 'walmart';
  locale: 'en' | 'es' | 'fr' | 'de' | 'ja';
  context: {
    productAttributes: Record<string, string>;
    sellingPoints: string[];
    competitorAsins?: string[]; // 路径 A 抓取
    categoryKeywords: string[];
    forbiddenWords?: string[];
    glossary?: Record<string, string>; // 术语库 S3+
  };
};

const ListingContentSchema = z.object({
  title: z.string().min(50).max(200),
  bullets: z.array(z.string().max(500)).length(5),
  description: z.string().max(2000),
  aplus: z.array(z.object({ module: z.string(), content: z.string() })).optional(),
  backendKeywords: z.array(z.string()).max(50),
});
type ListingContent = z.infer<typeof ListingContentSchema>;
```

#### 平台字符规则注入

通过 `prompt-template` 包内字段注入：

```markdown
<!-- prompts/listing/amazon-en.md -->

You are a listing copywriter for Amazon US ({{brand}}).

# Constraints

- Title: max 200 chars, must include brand name + main feature
- Each bullet: max 500 chars, capitalize first word
- Backend keywords: max 250 bytes total

# Brand voice

{{brandVoice}}

# Product context

{{productContext}}

Output JSON matching the provided schema.
```

### 2.4 Service #2：`mcpToolCallService`

**职责**：AI Agent 通过 MCP 协议调用领星 / yaemartOS 内部工具，支持流式回复 + 工具调用循环。

```typescript
@Injectable()
export class McpToolCallService {
  /**
   * 单轮 AI Agent 任务执行（自动多轮工具调用循环）
   */
  async runAgent(input: AgentRunInput): Promise<AgentRunResult> {
    const tools = await this.loadTools(input.toolScope);
    return await this.gemini.runAgentLoop({
      model: 'pro',
      messages: input.messages,
      tools,
      maxIterations: 10,
      timeoutMs: 60_000,
      humanInLoopGate: this.confirmGate.bind(this), // 高风险操作回调 UI 确认
    });
  }

  /**
   * 流式 AI 客服 Chat
   */
  async *streamChat(input: ChatStreamInput): AsyncGenerator<ChatChunk> {
    const tools = await this.loadTools(['rag.product_knowledge', 'rag.faq']);
    yield* this.gemini.streamWithTools({
      model: 'flash', // 客服用 Flash 快
      messages: input.messages,
      tools,
      maxIterations: 5,
    });
  }
}
```

#### Tool 注册

```typescript
// 内部工具
const internalTools = [
  defineTool('rag.product_knowledge', {
    description: 'Search product knowledge for the brand',
    parameters: z.object({ query: z.string(), brand: z.string() }),
    execute: async ({ query, brand }) => {
      return await esClient.searchInTenant('ops-product_knowledge', { brand }, query);
    },
  }),
  defineTool('rag.faq', { ... }),
];

// 领星桥（详见 ADR-004）
const lingxingTools = lingxingMcpBridge.getTools();
```

#### Human-in-the-Loop 闸门

高风险操作（创建广告、改价、删除 listing）必须经 UI 确认：

```typescript
async confirmGate(toolCall: ToolCall): Promise<{ allowed: boolean; reason?: string }> {
  if (HIGH_RISK_TOOLS.includes(toolCall.name)) {
    const ticket = await this.confirmService.requestApproval({ toolCall, requestedBy: this.userId });
    const decision = await this.confirmService.waitForDecision(ticket.id, { timeoutMs: 5 * 60_000 });
    return { allowed: decision.approved, reason: decision.reason };
  }
  return { allowed: true };
}
```

### 2.5 Service #3：`structuredExtractionService`

**职责**：多模态输入（图像 / PDF / 网页）→ 严格结构化 JSON 输出。

```typescript
@Injectable()
export class StructuredExtractionService {
  /**
   * 通用结构化抽取
   */
  async extract<T>(input: StructuredExtractionInput<T>): Promise<T> {
    const inputs = await this.preparePromptInputs(input);  // 处理图片/PDF
    return await this.gemini.generateStructured({
      model: 'pro',                                        // 多模态需要 Pro
      messages: inputs,
      schema: input.schema,
      temperature: 0.1,                                    // 抽取任务低温度
    });
  }

  /**
   * 路径 A：领星 listing 截图 / PDF 元数据 → product_content
   */
  async extractListingMeta(asinScreenshot: ImageInput | PdfInput): Promise<ProductContentDraft> {
    return await this.extract({
      schema: ProductContentDraftSchema,
      prompt: await this.loadPrompt('extraction/lingxing-listing-meta.md'),
      attachments: [asinScreenshot],
    });
  }

  /**
   * Manual PDF 全文 → 章节结构化（多语言）
   */
  async extractManualSections(pdf: PdfInput): Promise<ManualSection[]> { ... }
}
```

#### 多模态输入抽象

```typescript
type ImageInput = { type: 'image'; url?: string; base64?: string; mimeType: string };
type PdfInput = { type: 'pdf'; url?: string; base64?: string };
type TextInput = { type: 'text'; content: string };
type StructuredExtractionInput<T> = {
  schema: z.ZodSchema<T>;
  prompt?: string;
  attachments?: (ImageInput | PdfInput | TextInput)[];
  options?: { temperature?: number; timeoutMs?: number };
};
```

### 2.6 Provider 抽象（Vercel AI SDK 包装）

```typescript
interface AiProvider {
  readonly name: 'gemini' | 'glm';

  generate(req: GenerateRequest): Promise<GenerateResponse>;
  generateStructured<T>(req: GenerateStructuredRequest<T>): Promise<T>;
  stream(req: StreamRequest): AsyncGenerator<StreamChunk>;
  streamWithTools(req: StreamWithToolsRequest): AsyncGenerator<ChatChunk>;
  runAgentLoop(req: AgentLoopRequest): Promise<AgentRunResult>;
  embed(text: string | string[]): Promise<number[][]>;
}

class GeminiProvider implements AiProvider {
  constructor(private readonly sdk: GoogleGenerativeAI) {}
  // 用 Vercel AI SDK 实现接口
}
```

S2 加 `GlmProvider implements AiProvider`，业务 service 不需要改动。

### 2.7 Router（S2+ 启用）

```typescript
class ModelRouter {
  /**
   * 根据 service / locale / scene 决定 provider + model
   */
  pickModel(ctx: AiCallContext): { provider: 'gemini' | 'glm'; model: string } {
    // S1: 永远 Gemini
    // S2+: 中文运营场景路由到 GLM
    if (ctx.locale === 'zh' || ctx.scene === 'ad-optimization-cn') {
      return { provider: 'glm', model: 'glm-5' };
    }
    if (ctx.modality === 'multimodal-image' && ctx.sourceLanguage === 'zh') {
      return { provider: 'glm', model: 'glm-4v' };
    }
    return { provider: 'gemini', model: ctx.complexityHint === 'high' ? 'pro' : 'flash' };
  }
}
```

### 2.8 装饰器（渐进引入）

#### S1：基础

```typescript
@audit                  // 写入审计日志（M-10）
async generate(...) { ... }
```

#### S2：Cost Tracking

```typescript
@audit
@costTracked            // 记录 prompt_tokens / completion_tokens / cost_usd
async generate(...) { ... }
```

#### S3：Fallback

```typescript
@audit
@costTracked
@fallback({             // Pro 5xx/超时 → Flash
  primaryFailureCodes: [500, 502, 503, 504, 'TIMEOUT'],
  fallbackModel: 'flash',
  maxFallbackAttempts: 1,
})
async generate(...) { ... }
```

#### S4：Rate Limiting

```typescript
@audit
@costTracked
@fallback({...})
@rateLimited({          // 用户级 + 项目级双闸门
  perUserRpm: 30,
  globalRpm: 600,
  scope: 'ai.generate',
})
async generate(...) { ... }
```

### 2.9 Prompt 管理

- **prompt 文件单独入仓** `packages/ai-services/src/prompts/<scene>/<id>.md`
- 不直接写在 TypeScript 代码（除 hello-world 等 trivial）
- 每个 prompt 文件 frontmatter 含 metadata：

```markdown
---
id: listing/amazon-en
version: 1.0.0
model: gemini-2.5-pro
last_review: 2026-04-30
review_owner: dev #2
eval_set: listing-amazon-en-v1
---

You are a listing copywriter ...
```

- 变更 prompt 必须配 evalset 跑分（M-06 ≥ 3.5 / M-08 ≥ 70%）
- prompt 文件 PR review 必须配截图或评测对比

### 2.10 评测集（与 §5.1 指标采集对齐）

| 评测集                                   | 关联指标 | 引入切片 |
| ---------------------------------------- | -------- | -------- |
| `listing-amazon-en-v1`（盲审 100 例）    | M-06     | S1       |
| `path-a-extraction-v1`（5 类目 × 8 SKU） | M-07     | S1       |
| `customer-support-v1`（100 题）          | M-03     | S3       |
| `es-recall-v1`（多 query → 期望返回）    | M-08     | S2       |

每个评测集：

- 输入数据集 + 期望输出（人工标注）
- 评测脚本（Vitest 或独立 CLI）
- CI 上每次 prompt PR 自动跑回归

---

## 3. 错误处理

```typescript
class AiError extends Error {
  code: string; // 'TIMEOUT' / 'PROVIDER_ERROR' / 'SCHEMA_VIOLATION' / 'CONTENT_FILTER' / 'RATE_LIMITED'
  provider: 'gemini' | 'glm';
  retryable: boolean;
}
```

业务代码用 `instanceof AiError` 判断；UI 层根据 `code` 决定文案：

| code             | 用户文案                             |
| ---------------- | ------------------------------------ |
| TIMEOUT          | "AI 处理较慢，请稍后重试"            |
| SCHEMA_VIOLATION | "AI 输出未符合预期，已记录待优化"    |
| CONTENT_FILTER   | "内容触发安全过滤，请调整输入后重试" |
| RATE_LIMITED     | "请求过于频繁，请 1 分钟后重试"      |
| PROVIDER_ERROR   | "AI 服务暂时不可用，请稍后重试"      |

---

## 4. 安全 / 合规

- 所有 prompt 在调用前过敏感词扫描（避免误注入泄漏 secret）
- 用户输入不直接拼接到 system prompt（系统提示与用户输入物理隔离）
- 客户域 prompt 必须强制 tenant scope（不能跨品牌引用知识库）
- 完整 prompt + 响应入审计日志（保留 90 天，PII 脱敏）
- 高风险工具调用必须 human-in-the-loop（§2.4 confirmGate）

---

## 5. 落地切片节奏

| 切片         | 增量                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------- |
| **S1 W1 D4** | 包骨架 + 3 service 接口定义 + GeminiProvider + helloWorld 跑通                           |
| **S1 W5-W6** | listing-generation prompt v1（Amazon EN）+ extraction prompt v1（lingxing-listing-meta） |
| **S1 W11**   | RAG 工具注册（rag.product_knowledge 接 ES）                                              |
| **S2 W14**   | GlmProvider + ModelRouter + cost-tracking 装饰器                                         |
| **S2 W16**   | listing-generation walmart-en prompt                                                     |
| **S3 W27**   | listing-generation amazon-es / amazon-fr                                                 |
| **S3 W34**   | mcp-tool-call streamChat + customer-support prompt + fallback 装饰器                     |
| **S4 W43**   | rate-limited 装饰器 + 完整成本 dashboard                                                 |

---

## 6. 替代方案与拒绝理由

| 方案                             | 拒绝理由                                         |
| -------------------------------- | ------------------------------------------------ |
| 业务代码直接调 Vercel AI SDK     | 无统一 audit / cost / fallback / router 植入点   |
| LangChain / LlamaIndex           | 抽象过重，2 人团队维护成本高；Vercel AI SDK 更轻 |
| 写在单一 god service `aiService` | 接口太宽；scene 差异大；难单元测试               |
| 不拆 provider 抽象，写死 Gemini  | S2 切 GLM 时改动面大；contract 难保              |
| Prompt 写在代码 string 字面量    | 不可 review；不可独立评测；模板化复用难          |

---

## 7. 验收

- [ ] S1 W1 D4 包骨架入仓
- [ ] 3 个 service 接口 TypeScript 类型导出
- [ ] GeminiProvider 实现完整 AiProvider interface
- [ ] `listingGenerationService.helloWorld()` 单元测试通过
- [ ] AuditLogger 接入 M-10 审计日志覆盖率
- [ ] code-review lint 规则：`@yaemartos/no-direct-llm-sdk-call`，禁止业务代码绕过 AiServices
- [ ] S1 W5 listing-amazon-en prompt v1 + 评测集 ≥ M-06 基线

---

## 8. 风险与未决项

| 风险                                           | 缓解                                                        |
| ---------------------------------------------- | ----------------------------------------------------------- |
| Gemini SDK 频繁升级                            | 锁定 Vercel AI SDK 版本；minor 版本月度评估                 |
| Gemini Pro/Flash 价格变化                      | cost tracking S2 启用；月成本告警                           |
| Schema validation 失败率高（结构化输出不稳定） | 加重试 1 次（不同 temperature）；统计 SCHEMA_VIOLATION 频率 |
| Prompt 注入攻击                                | 用户输入与 system prompt 严格隔离                           |
| GLM-5 与 Gemini 输出风格差异大                 | S2 引入时保留旧 prompt 备份；评测集回归                     |
| 多模态请求 token 成本高                        | S2 cost tracking 必须先到位；超阈值降级到 Flash             |

---

_版本：v0.1 提案 | 最后修订：2026-04-30 | 实施评审：S1 W1 D4_
