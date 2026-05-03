import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { randomUUID } from 'crypto';
import { Subject } from 'rxjs';
import { PRISMA_TENANT_CLIENT } from '../../database/database.tokens';
import { FaqKnowledgeService } from '../../search/faq-knowledge.service';
import { AI_DEGRADED_SIGNAL } from '../../ai/interceptors/ai-fallback.interceptor';

const MAX_CONTEXT_MESSAGES = 10;
const MAX_UNFULFILLED_TURNS = 3;

export interface ChatTokenEvent {
  token?: string;
  done?: boolean;
  escalated?: boolean;
  sessionId?: string;
}

type TenantPrisma = any;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly streams = new Map<string, Subject<ChatTokenEvent>>();
  private readonly unfulfilledCounts = new Map<string, number>();

  constructor(
    @Inject(PRISMA_TENANT_CLIENT) private readonly tenantDb: TenantPrisma,
    private readonly faqKnowledge: FaqKnowledgeService,
    private readonly config: ConfigService,
  ) {}

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
   * Returns the RxJS Subject for the given session, creating one if it doesn't exist.
   * The SSE controller subscribes to this Subject to stream tokens.
   */
  getSessionStream(sessionId: string): Subject<ChatTokenEvent> {
    let subject = this.streams.get(sessionId);
    if (!subject) {
      subject = new Subject<ChatTokenEvent>();
      this.streams.set(sessionId, subject);
    }
    return subject;
  }

  /** Removes the Subject when the SSE connection closes. */
  removeSessionStream(sessionId: string): void {
    const subject = this.streams.get(sessionId);
    if (subject) {
      subject.complete();
      this.streams.delete(sessionId);
    }
    this.unfulfilledCounts.delete(sessionId);
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
    if (!session) {
      throw new NotFoundException(`Chat session ${sessionId} not found`);
    }

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

    const subject = this.getSessionStream(sessionId);

    let responseContent = '';
    try {
      const apiKey = this.config.get<string>('GEMINI_API_KEY');
      if (!apiKey) {
        throw new ServiceUnavailableException('GEMINI_API_KEY not configured');
      }

      const google = createGoogleGenerativeAI({ apiKey });
      const { textStream } = await streamText({
        model: google('gemini-2.5-flash-preview-04-17'),
        system: systemPrompt,
        messages: contextMessages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      for await (const chunk of textStream) {
        responseContent += chunk;
        subject.next({ token: chunk });
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI chat stream error for session ${sessionId}: ${reason}`);
      subject.next({ token: AI_DEGRADED_SIGNAL });
      subject.next({ escalated: true, done: true });

      await onEscalate(contextMessages);
      return;
    }

    await this.tenantDb.chatMessage.create({
      data: { sessionId, role: 'assistant', content: responseContent },
    });

    const isUnfulfilled =
      responseContent.trim().toUpperCase().includes('UNKNOWN') ||
      responseContent.trim().length < 10;

    if (isUnfulfilled) {
      const count = (this.unfulfilledCounts.get(sessionId) ?? 0) + 1;
      this.unfulfilledCounts.set(sessionId, count);

      if (count >= MAX_UNFULFILLED_TURNS) {
        this.logger.log(`Session ${sessionId}: ${count} unfulfilled turns — escalating`);
        subject.next({ escalated: true, done: true });
        await onEscalate(contextMessages);
        return;
      }
    } else {
      this.unfulfilledCounts.delete(sessionId);
    }

    subject.next({ done: true });
  }
}
