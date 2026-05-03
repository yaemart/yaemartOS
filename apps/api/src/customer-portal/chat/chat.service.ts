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
import { PRISMA_TENANT_CLIENT } from '../../database/database.tokens';
import { TenantPrismaClient } from '../../database/tenant-prisma.types';
import { FaqKnowledgeService } from '../../search/faq-knowledge.service';
import { AI_DEGRADED_SIGNAL } from '../../ai/interceptors/ai-fallback.interceptor';

const MAX_CONTEXT_MESSAGES = 10;
const MAX_UNFULFILLED_TURNS = 3;
const MAX_AI_RETRIES = 2;
const AI_RETRY_BASE_MS = 500;
/** Sessions with no activity for this duration are evicted from the in-memory maps. */
const SESSION_IDLE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface ChatTokenEvent {
  token?: string;
  done?: boolean;
  escalated?: boolean;
  sessionId?: string;
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
    private readonly faqKnowledge: FaqKnowledgeService,
    private readonly config: ConfigService,
  ) {
    this.evictionTimer = setInterval(() => this.evictIdleSessions(), SESSION_IDLE_TTL_MS);
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
      select: { id: true, brandId: true },
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

    const systemPrompt = [
      `You are a helpful customer support assistant for brand ${brandId}.`,
      `Respond in locale: ${locale}.`,
      faqContext
        ? `Relevant FAQ knowledge:\n${faqContext}`
        : 'No FAQ knowledge available for this query.',
      'If you cannot answer or the question is outside your knowledge, respond with exactly: UNKNOWN',
    ].join('\n\n');

    const subject = this.getSessionStream(brandId, sessionId);

    let responseContent = '';
    let streamError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_AI_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = AI_RETRY_BASE_MS * Math.pow(2, attempt - 1);
        this.logger.warn(
          `AI retry ${attempt}/${MAX_AI_RETRIES} for session ${sessionId} in ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      try {
        const apiKey = this.config.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
          throw new ServiceUnavailableException('GEMINI_API_KEY not configured');
        }

        const google = createGoogleGenerativeAI({ apiKey });
        const { textStream } = await streamText({
          model: google('gemini-2.5-flash-preview-04-17'),
          system: systemPrompt,
          messages: contextMessages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
        });

        responseContent = '';
        for await (const chunk of textStream) {
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

    const trimmed = responseContent.trim();
    const isUnfulfilled = trimmed.toUpperCase() === 'UNKNOWN' || trimmed.length < 10;

    if (isUnfulfilled) {
      const count = (this.unfulfilledCounts.get(sessionId) ?? 0) + 1;
      this.unfulfilledCounts.set(sessionId, count);

      if (count >= MAX_UNFULFILLED_TURNS) {
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
