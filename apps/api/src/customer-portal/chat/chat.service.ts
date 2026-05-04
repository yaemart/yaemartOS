import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { randomUUID } from 'crypto';
import { Subject } from 'rxjs';
import { PRISMA_PUBLIC_CLIENT, PRISMA_TENANT_CLIENT } from '../../database/database.tokens';
import { TenantPrismaClient } from '../../database/tenant-prisma.types';
import type { PrismaClient } from '../../generated/prisma';
import { FaqKnowledgeService } from '../../search/faq-knowledge.service';
import { AI_DEGRADED_SIGNAL } from '../../ai/interceptors/ai-fallback.interceptor';
import { FeatureFlagService } from '../../common/feature-flag/feature-flag.service';
import { TicketService } from '../ticket/ticket.service';
import { WarrantyService } from '../warranty/warranty.service';
import { ManualService } from '../manual/manual.service';
import { OrderLookupService } from '../order-lookup/order-lookup.service';
import { buildCustomerChatTools, describeCustomerChatTools } from './customer-chat-tools';

/** ADR-012 §D4 — independent gate from AGENT_NATIVE_REALTIME_UI. */
const TOOL_CALLING_FLAG = 'AGENT_NATIVE_TOOL_CALLING';
/** ADR-012 OQ#2 — caps multi-step chains; 3 covers >95% of customer scenarios. */
const TOOL_MAX_STEPS = 3;

/**
 * W49 leadership KPI surface (see [W49 brief](../../../../../docs/briefs/2026-05-W49-leadership-sync.md)).
 *
 * Three counters fed into `Metric` so the W52 v3 audit can compute:
 *  - **Call rate**         = `invocation_count / session_count`
 *  - **Error rate**        = `error_count / invocation_count`
 *  - **Graceful coverage** = 1 - sessions where errors triggered escalation
 *
 * All three are recorded fire-and-forget. A failure to record must not
 * break the chat experience.
 */
const KPI_TOOL_INVOCATION = 'chat.tool.invocation_count';
const KPI_TOOL_ERROR = 'chat.tool.error_count';
const KPI_TOOL_SESSION = 'chat.session.with_tools_count';

const MAX_CONTEXT_MESSAGES = 10;
/** Default escalation threshold — overridden by env CHAT_MAX_UNFULFILLED_TURNS */
const DEFAULT_MAX_UNFULFILLED_TURNS = 3;
/** Minimum response length below which the answer is treated as unfulfilled — overridden by env CHAT_MIN_RESPONSE_LENGTH */
const DEFAULT_MIN_RESPONSE_LENGTH = 10;
const MAX_AI_RETRIES = 2;
const AI_RETRY_BASE_MS = 500;
/** Sessions with no activity for this duration are evicted from the in-memory maps. */
const SESSION_IDLE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface ChatToolCallEvent {
  /** Tool name as registered in `customer-chat-tools.ts`. */
  name: string;
  status: 'started' | 'completed';
}

export interface ChatTokenEvent {
  token?: string;
  done?: boolean;
  escalated?: boolean;
  sessionId?: string;
  /**
   * Surface tool-call lifecycle to the chat client so the user sees
   * "Calling listMyTickets…" instead of an unexplained pause. Emitted by
   * `streamText.onStepFinish` (ADR-012 §D5 +
   * `customer-portal/components/chat/chat-window.tsx`).
   */
  toolCall?: ChatToolCallEvent;
}

@Injectable()
export class ChatService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatService.name);
  /** Key: `${tenantId}:${sessionId}` for tenant isolation */
  private readonly streams = new Map<string, Subject<ChatTokenEvent>>();
  private readonly unfulfilledCounts = new Map<string, number>();
  /** Tracks last activity time for each sessionId to support TTL eviction. */
  private readonly sessionLastSeen = new Map<string, number>();
  private readonly evictionTimer: ReturnType<typeof setInterval>;

  constructor(
    @Inject(PRISMA_TENANT_CLIENT) private readonly tenantDb: TenantPrismaClient,
    @Inject(PRISMA_PUBLIC_CLIENT) private readonly publicDb: PrismaClient,
    private readonly faqKnowledge: FaqKnowledgeService,
    private readonly config: ConfigService,
    private readonly featureFlag: FeatureFlagService,
    private readonly ticketService: TicketService,
    private readonly warrantyService: WarrantyService,
    private readonly manualService: ManualService,
    private readonly orderLookupService: OrderLookupService,
  ) {
    this.evictionTimer = setInterval(() => this.evictIdleSessions(), SESSION_IDLE_TTL_MS);
  }

  /**
   * Fire-and-forget KPI recorder. Writes to the public `Metric` table
   * via `prisma.metric.create`, swallowing any failure (network, DB, etc.)
   * so chat streaming is never blocked by observability.
   *
   * Called by `handleMessage`'s `onStepFinish` and the post-stream wrap-up.
   */
  private recordToolMetric(name: string, value: number, brandId: string): void {
    void this.publicDb.metric
      .create({
        data: { name, value, unit: 'count', brandId },
      })
      .catch((err: unknown) => {
        this.logger.warn(`Metric record failed (${name}): ${String(err)}`);
      });
  }

  /**
   * Runtime guard for the ADR-012 §D3 tool-result envelope (`/review`
   * finding F-3). Pre-fix code was `tr.result as { ok?: boolean }`,
   * which silently swallowed any envelope drift — e.g. if Vercel AI SDK
   * ever wraps results in `{ output: { ok: ... } }`, the cast would
   * still type-check but `result.ok === false` would never trigger,
   * permanently zeroing `chat.tool.error_count` with no error log.
   *
   * Returns `true` only when the value structurally matches
   * `{ ok: false, ... }`. Anything else (null, non-object, missing `ok`,
   * non-boolean `ok`) returns `false` AND logs a `warn` so a future
   * SDK upgrade fails loudly instead of silently zeroing the metric.
   *
   * Exposed as private so unit tests can exercise it via `as any`.
   */
  private isToolErrorResult(toolName: string, raw: unknown): boolean {
    if (raw === null || raw === undefined) {
      // Legitimate "tool returned nothing" — not an error envelope, but
      // also not noisy enough to warn on.
      return false;
    }
    if (typeof raw !== 'object') {
      this.logger.warn(
        `Tool "${toolName}" returned non-object result (typeof=${typeof raw}); ` +
          'cannot classify ok/error envelope. ADR-012 §D3 violated upstream.',
      );
      return false;
    }
    const r = raw as Record<string, unknown>;
    if (!('ok' in r)) {
      this.logger.warn(
        `Tool "${toolName}" result envelope missing "ok" field — ` +
          `keys: [${Object.keys(r).join(', ')}]. ADR-012 §D3 violated.`,
      );
      return false;
    }
    if (typeof r['ok'] !== 'boolean') {
      this.logger.warn(
        `Tool "${toolName}" result has non-boolean "ok" (got ${typeof r['ok']}); ` +
          'treating as success (no error_count bumped).',
      );
      return false;
    }
    return r['ok'] === false;
  }

  onModuleDestroy(): void {
    clearInterval(this.evictionTimer);
  }

  private evictIdleSessions(): void {
    const cutoff = Date.now() - SESSION_IDLE_TTL_MS;
    for (const [sessionId, lastSeen] of this.sessionLastSeen) {
      if (lastSeen < cutoff) {
        this.unfulfilledCounts.delete(sessionId);
        this.sessionLastSeen.delete(sessionId);
      }
    }
  }

  /**
   * Creates (or reuses) a chat session for the given brand.
   * Returns the session ID and a session token for anonymous access.
   */
  async getOrCreateSession(opts: {
    customerId?: string;
    brandId: string;
    existingSessionToken?: string;
  }): Promise<{ sessionId: string; sessionToken: string }> {
    if (opts.existingSessionToken) {
      const existing = await this.tenantDb.chatSession.findUnique({
        where: { sessionToken: opts.existingSessionToken },
        select: { id: true, sessionToken: true },
      });
      if (existing) {
        await this.tenantDb.chatSession.update({
          where: { id: existing.id },
          data: { lastActivityAt: new Date() },
        });
        return { sessionId: existing.id, sessionToken: existing.sessionToken };
      }
    }

    const sessionToken = randomUUID();
    const session = await this.tenantDb.chatSession.create({
      data: {
        customerId: opts.customerId ?? null,
        sessionToken,
        brandId: opts.brandId,
        lastActivityAt: new Date(),
      },
      select: { id: true, sessionToken: true },
    });

    return { sessionId: session.id, sessionToken: session.sessionToken };
  }

  /**
   * Validates that a session exists in the current tenant and belongs to the
   * expected customer (if authenticated). Throws 404 / 403 on failure.
   */
  async validateSession(tenantId: string, sessionId: string, customerId?: string): Promise<void> {
    const session = await this.tenantDb.chatSession.findUnique({
      where: { id: sessionId },
      select: { id: true, brandId: true, customerId: true },
    });
    if (!session) {
      throw new NotFoundException(`Chat session ${sessionId} not found`);
    }
    if (session.brandId !== tenantId) {
      throw new ForbiddenException('Session does not belong to this brand');
    }
    if (customerId && session.customerId && session.customerId !== customerId) {
      throw new ForbiddenException('Session does not belong to this customer');
    }
  }

  /**
   * Returns the RxJS Subject for the given session.
   * Key is `${tenantId}:${sessionId}` to prevent cross-tenant eavesdropping.
   * Creates the Subject only when called from validated contexts.
   */
  getSessionStream(tenantId: string, sessionId: string): Subject<ChatTokenEvent> {
    const key = `${tenantId}:${sessionId}`;
    let subject = this.streams.get(key);
    if (!subject) {
      subject = new Subject<ChatTokenEvent>();
      this.streams.set(key, subject);
    }
    return subject;
  }

  /** Removes the Subject when the SSE connection closes. */
  removeSessionStream(tenantId: string, sessionId: string): void {
    const key = `${tenantId}:${sessionId}`;
    const subject = this.streams.get(key);
    if (subject) {
      subject.complete();
      this.streams.delete(key);
    }
    this.unfulfilledCounts.delete(sessionId);
    this.sessionLastSeen.delete(sessionId);
  }

  /**
   * Handles an incoming customer message:
   * 1. Saves the user message
   * 2. Retrieves context (history + FAQ knowledge)
   * 3. Calls Gemini Flash with streaming
   * 4. Pushes tokens to the session Subject
   * 5. On escalation condition, calls the provided escalation callback
   */
  async handleMessage(opts: {
    sessionId: string;
    brandId: string;
    locale: string;
    content: string;
    onEscalate: (lastMessages: Array<{ role: string; content: string }>) => Promise<void>;
  }): Promise<void> {
    const { sessionId, brandId, locale, content, onEscalate } = opts;

    const session = await this.tenantDb.chatSession.findUnique({
      where: { id: sessionId },
      select: { id: true, brandId: true, customerId: true },
    });
    if (!session || session.brandId !== brandId) {
      throw new NotFoundException(`Chat session ${sessionId} not found`);
    }

    this.sessionLastSeen.set(sessionId, Date.now());

    await this.tenantDb.chatMessage.create({
      data: { sessionId, role: 'user', content },
    });

    const history = await this.tenantDb.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: MAX_CONTEXT_MESSAGES,
      select: { role: true, content: true },
    });
    const contextMessages = history.reverse();

    const faqChunks = await this.faqKnowledge.search(content, brandId, locale, 5);
    const faqContext = faqChunks.map((c) => `Q: ${c.question}\nA: ${c.answer}`).join('\n\n');

    const [brandConfig, openTickets, recentOrders] = await Promise.all([
      this.tenantDb.systemConfig
        .findFirst({ where: { key: 'brand.displayName' }, select: { value: true } })
        .catch(() => null),
      session.customerId
        ? (this.tenantDb as any).ticket
            .findMany({
              where: {
                customerId: session.customerId,
                status: { in: ['open', 'pending', 'in_progress'] },
              },
              select: { id: true, ticketNo: true, subject: true, status: true },
              orderBy: { createdAt: 'desc' },
              take: 5,
            })
            .catch(() => [])
        : Promise.resolve([]),
      session.customerId
        ? (this.tenantDb as any).orderLookup
            .findMany({
              where: { customerId: session.customerId },
              select: { orderNumber: true, resultStatus: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 3,
            })
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    const brandDisplayName =
      (brandConfig?.value as string | undefined) ??
      brandId.charAt(0).toUpperCase() + brandId.slice(1);

    let customerSection: string;
    if (!session.customerId) {
      customerSection = 'Customer is browsing anonymously (not logged in).';
    } else {
      const ticketLines =
        (openTickets as Array<{ ticketNo: string; subject: string; status: string }>).length > 0
          ? (openTickets as Array<{ ticketNo: string; subject: string; status: string }>)
              .map((t) => `  - [${t.ticketNo}] ${t.subject} (${t.status})`)
              .join('\n')
          : '  (none)';
      const orderLines =
        (recentOrders as Array<{ orderNumber: string; resultStatus: string | null }>).length > 0
          ? (recentOrders as Array<{ orderNumber: string; resultStatus: string | null }>)
              .map((o) => `  - Order #${o.orderNumber}: ${o.resultStatus ?? 'unknown status'}`)
              .join('\n')
          : '  (no recent order lookups)';
      customerSection = [
        `Logged-in customer ID: ${session.customerId}`,
        `Open/active support tickets:\n${ticketLines}`,
        `Recent order lookups (last 3):\n${orderLines}`,
      ].join('\n');
    }

    const hasOpenTickets = (openTickets as unknown[]).length > 0;

    // ADR-012: build tool registry bound to this validated session, then
    // gate it behind the `AGENT_NATIVE_TOOL_CALLING` flag. Flag off → tools
    // is undefined and `streamText` behaviour is identical to W47-end.
    const toolingEnabled = await this.featureFlag.isEnabled(TOOL_CALLING_FLAG, {
      brand: brandId,
    });
    const tools = toolingEnabled
      ? buildCustomerChatTools({
          customerId: session.customerId ?? null,
          brandId,
          locale,
          ticket: this.ticketService,
          warranty: this.warrantyService,
          manual: this.manualService,
          orderLookup: this.orderLookupService,
        })
      : null;
    const toolSummary = tools ? describeCustomerChatTools(tools) : null;

    const systemPrompt = [
      `You are a helpful customer support assistant for ${brandDisplayName}, a cross-border e-commerce brand.`,
      `Always respond in the language matching locale: ${locale}.`,
      customerSection,
      `Your support scope: product questions, order status inquiries, warranty and returns, and general brand FAQs.`,
      `Out of scope (do not attempt): pricing negotiations, account modifications, legal disputes — for these, let the customer know you will connect them with a human agent.`,
      `Escalation policy: ${hasOpenTickets ? 'the customer has open tickets — acknowledge them and offer to continue or escalate' : 'if you cannot help, offer to create a support ticket for follow-up'}.`,
      // Tool capability summary (ADR-012 §D5) — derived from the tool
      // registry so adding/removing a tool does not require a prompt edit.
      toolSummary
        ? `You have access to the following tools and SHOULD call them when the customer's intent matches. Always confirm the action with the customer first when it mutates data (createCustomerTicket, addCustomerTicketMessage, registerWarranty). When a tool returns { ok: false, error, message } reply gracefully with the human message — do not surface raw error codes:\n${toolSummary}`
        : "You can answer questions but cannot take actions on the customer's account in this conversation.",
      faqContext
        ? `Relevant knowledge base entries:\n${faqContext}`
        : 'No matching knowledge base entries found for this query.',
      'If you genuinely cannot answer the question within the scope above, respond with exactly: UNKNOWN',
    ].join('\n\n');

    const subject = this.getSessionStream(brandId, sessionId);

    let responseContent = '';
    let streamError: Error | null = null;

    // W49 KPI accumulators (`/review` finding F-2). Counted locally per
    // attempt and flushed *once* after the retry loop so a mid-stream
    // failure on attempt N can't double-count the same tools when
    // attempt N+1 retries successfully. Reset at the top of each attempt.
    let pendingInvocations = 0;
    let pendingErrors = 0;

    for (let attempt = 0; attempt <= MAX_AI_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = AI_RETRY_BASE_MS * Math.pow(2, attempt - 1);
        this.logger.warn(
          `AI retry ${attempt}/${MAX_AI_RETRIES} for session ${sessionId} in ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Discard any counts from a previous failed attempt — only the
      // final attempt's counts (whether successful or not) survive into
      // the post-loop flush.
      pendingInvocations = 0;
      pendingErrors = 0;

      try {
        const apiKey = this.config.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
          throw new ServiceUnavailableException('GEMINI_API_KEY not configured');
        }

        const chatModel =
          this.config.get<string>('CHAT_AI_MODEL') ?? 'gemini-2.5-flash-preview-04-17';
        const google = createGoogleGenerativeAI({ apiKey });
        // Surfacing tool calls to the SSE stream — see customer-portal/chat
        // frontend `chat-window.tsx` `tool-call` event handling. We push a
        // lightweight `{ tool: <name>, status: 'started' | 'done' }` so the
        // client can render "Calling X tool…" while the model is mid-step.
        const result = await streamText({
          model: google(chatModel),
          system: systemPrompt,
          messages: contextMessages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
          ...(tools ? { tools, maxSteps: TOOL_MAX_STEPS } : {}),
          onStepFinish: tools
            ? ({ toolCalls, toolResults }) => {
                for (const call of toolCalls ?? []) {
                  subject.next({ toolCall: { name: call.toolName, status: 'started' } });
                  pendingInvocations += 1;
                }
                for (const tr of toolResults ?? []) {
                  subject.next({
                    toolCall: { name: tr.toolName, status: 'completed' },
                  });
                  // ADR-012 §D3 — every tool returns a stable envelope; an
                  // `ok: false` payload is the canonical signal that the
                  // tool itself rejected the call. Count it so leadership
                  // can watch error_rate vs healthy invocation rate. The
                  // runtime guard yells at us if the SDK ever changes the
                  // envelope shape — see `/review` finding F-3.
                  if (this.isToolErrorResult(tr.toolName, tr.result)) {
                    pendingErrors += 1;
                  }
                }
              }
            : undefined,
        });

        responseContent = '';
        for await (const chunk of result.textStream) {
          responseContent += chunk;
          subject.next({ token: chunk });
        }
        streamError = null;
        break;
      } catch (err) {
        if (err instanceof ServiceUnavailableException) {
          streamError = err;
          break;
        }
        streamError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `AI attempt ${attempt + 1} failed for session ${sessionId}: ${streamError.message}`,
        );
      }
    }

    // W49 KPI flush (`/review` findings F-2 + F-7). Always counts the
    // session whenever tools were available, even if every attempt failed
    // (so the call-rate denominator never silently drops out from under
    // a flaky LLM). Invocation / error counters only flush on success —
    // a failed final attempt isn't a real "tool was called" event from
    // leadership's perspective.
    if (tools) {
      this.recordToolMetric(KPI_TOOL_SESSION, 1, brandId);
      if (streamError === null && pendingInvocations > 0) {
        this.recordToolMetric(KPI_TOOL_INVOCATION, pendingInvocations, brandId);
      }
      if (streamError === null && pendingErrors > 0) {
        this.recordToolMetric(KPI_TOOL_ERROR, pendingErrors, brandId);
      }
    }

    if (streamError) {
      this.logger.error(
        `AI chat exhausted retries for session ${sessionId}: ${streamError.message}`,
      );
      subject.next({ token: AI_DEGRADED_SIGNAL });
      this.unfulfilledCounts.delete(sessionId);
      await onEscalate(contextMessages);
      subject.next({ escalated: true, done: true });
      this.removeSessionStream(brandId, sessionId);
      return;
    }

    await this.tenantDb.chatMessage.create({
      data: { sessionId, role: 'assistant', content: responseContent },
    });

    const maxUnfulfilledTurns = this.config.get<number>(
      'CHAT_MAX_UNFULFILLED_TURNS',
      DEFAULT_MAX_UNFULFILLED_TURNS,
    );
    const minResponseLength = this.config.get<number>(
      'CHAT_MIN_RESPONSE_LENGTH',
      DEFAULT_MIN_RESPONSE_LENGTH,
    );

    const trimmed = responseContent.trim();
    const isUnfulfilled = trimmed.toUpperCase() === 'UNKNOWN' || trimmed.length < minResponseLength;

    if (isUnfulfilled) {
      const count = (this.unfulfilledCounts.get(sessionId) ?? 0) + 1;
      this.unfulfilledCounts.set(sessionId, count);

      if (count >= maxUnfulfilledTurns) {
        this.logger.log(`Session ${sessionId}: ${count} unfulfilled turns — escalating`);
        this.unfulfilledCounts.delete(sessionId);
        await onEscalate(contextMessages);
        subject.next({ escalated: true, done: true });
        this.removeSessionStream(brandId, sessionId);
        return;
      }
    } else {
      this.unfulfilledCounts.delete(sessionId);
    }

    subject.next({ done: true });
  }
}
