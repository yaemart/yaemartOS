import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { FaqKnowledgeService } from '../../search/faq-knowledge.service';

function makeMockDb(
  overrides?: Partial<{
    chatSession: Record<string, unknown>;
    chatMessage: Record<string, unknown>;
  }>,
) {
  return {
    chatSession: {
      findUnique: vi
        .fn()
        .mockResolvedValue(overrides?.chatSession ?? { id: 'sess-1', brandId: 'homtone' }),
      create: vi.fn().mockResolvedValue({ id: 'sess-1', sessionToken: 'tok-abc' }),
      update: vi.fn().mockResolvedValue({}),
    },
    chatMessage: {
      create: vi.fn().mockResolvedValue({ id: 'msg-1' }),
      findMany: vi.fn().mockResolvedValue([{ role: 'user', content: 'Hello' }]),
    },
  };
}

function makeService(opts?: {
  dbOverrides?: Partial<Record<string, unknown>>;
  faqResults?: Array<{ faqId: string; question: string; answer: string; score: number }>;
  geminiApiKey?: string;
}) {
  const tenantDb = makeMockDb(opts?.dbOverrides);

  const mockFaq = {
    search: vi.fn().mockResolvedValue(opts?.faqResults ?? []),
  } as unknown as FaqKnowledgeService;

  const mockConfig = {
    get: vi.fn((key: string) => {
      if (key === 'GEMINI_API_KEY') {
        return opts?.geminiApiKey ?? null;
      }
      return null;
    }),
  } as unknown as ConfigService;

  const service = new ChatService(tenantDb as any, mockFaq, mockConfig);
  return { service, tenantDb, mockFaq };
}

describe('ChatService', () => {
  describe('getOrCreateSession', () => {
    it('creates new session when no existing token', async () => {
      const { service, tenantDb } = makeService();
      const result = await service.getOrCreateSession({ brandId: 'homtone' });
      expect(result.sessionId).toBe('sess-1');
      expect(result.sessionToken).toBe('tok-abc');
      expect(tenantDb.chatSession.create).toHaveBeenCalledOnce();
    });

    it('reuses existing session when valid token provided', async () => {
      const { service, tenantDb } = makeService();
      const result = await service.getOrCreateSession({
        brandId: 'homtone',
        existingSessionToken: 'tok-abc',
      });
      expect(result.sessionId).toBe('sess-1');
      expect(tenantDb.chatSession.create).not.toHaveBeenCalled();
    });

    it('creates new session when token not found in DB', async () => {
      const { service, tenantDb } = makeService();
      tenantDb.chatSession.findUnique = vi.fn().mockResolvedValue(null);
      tenantDb.chatSession.create = vi.fn().mockResolvedValue({
        id: 'sess-new',
        sessionToken: 'tok-new',
      });
      const result = await service.getOrCreateSession({
        brandId: 'homtone',
        existingSessionToken: 'tok-not-found',
      });
      expect(result.sessionId).toBe('sess-new');
      expect(tenantDb.chatSession.create).toHaveBeenCalledOnce();
    });
  });

  describe('getSessionStream', () => {
    it('creates and returns a Subject', () => {
      const { service } = makeService();
      const subject = service.getSessionStream('homtone', 'sess-1');
      expect(subject).toBeDefined();
      expect(typeof subject.next).toBe('function');
    });

    it('returns the same Subject on subsequent calls for same tenant+session', () => {
      const { service } = makeService();
      const s1 = service.getSessionStream('homtone', 'sess-1');
      const s2 = service.getSessionStream('homtone', 'sess-1');
      expect(s1).toBe(s2);
    });

    it('returns different Subjects for different tenants with same sessionId', () => {
      const { service } = makeService();
      const s1 = service.getSessionStream('homtone', 'sess-1');
      const s2 = service.getSessionStream('spoonlemon', 'sess-1');
      expect(s1).not.toBe(s2);
    });
  });

  describe('handleMessage', () => {
    it('throws NotFoundException when session does not exist', async () => {
      const { service, tenantDb } = makeService();
      tenantDb.chatSession.findUnique = vi.fn().mockResolvedValue(null);

      await expect(
        service.handleMessage({
          sessionId: 'missing',
          brandId: 'homtone',
          locale: 'en',
          content: 'Hello',
          onEscalate: vi.fn(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('queries FAQ knowledge for the message content', async () => {
      const { service, mockFaq } = makeService({ geminiApiKey: undefined });
      const onEscalate = vi.fn().mockResolvedValue(undefined);

      await service
        .handleMessage({
          sessionId: 'sess-1',
          brandId: 'homtone',
          locale: 'en',
          content: 'return policy',
          onEscalate,
        })
        .catch(() => {});

      expect(mockFaq.search).toHaveBeenCalledWith('return policy', 'homtone', 'en', 5);
    });

    it('calls onEscalate when GEMINI_API_KEY is not set (ServiceUnavailable)', async () => {
      const { service } = makeService({ geminiApiKey: undefined });
      const onEscalate = vi.fn().mockResolvedValue(undefined);

      await service.handleMessage({
        sessionId: 'sess-1',
        brandId: 'homtone',
        locale: 'en',
        content: 'Hello',
        onEscalate,
      });

      expect(onEscalate).toHaveBeenCalledOnce();
    });

    it('pushes escalated event to SSE Subject on error', async () => {
      const { service } = makeService({ geminiApiKey: undefined });
      const subject = service.getSessionStream('homtone', 'sess-1');
      const events: unknown[] = [];
      subject.subscribe((e) => events.push(e));

      await service.handleMessage({
        sessionId: 'sess-1',
        brandId: 'homtone',
        locale: 'en',
        content: 'Hello',
        onEscalate: vi.fn().mockResolvedValue(undefined),
      });

      expect(events.some((e: any) => e.escalated === true)).toBe(true);
    });
  });

  describe('removeSessionStream', () => {
    it('completes and removes the Subject', () => {
      const { service } = makeService();
      const subject = service.getSessionStream('homtone', 'sess-1');
      const completeSpy = vi.spyOn(subject, 'complete');
      service.removeSessionStream('homtone', 'sess-1');
      expect(completeSpy).toHaveBeenCalledOnce();
    });
  });
});
