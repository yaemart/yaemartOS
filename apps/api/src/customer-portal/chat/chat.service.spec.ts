import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Must mock the `ai` package before importing ChatService so the
// `streamText` reference closed over by the service is the spy. See
// `gemini-listing-generation.service.spec.ts` for the same pattern.
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, streamText: vi.fn() };
});
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn()),
}));

import { streamText } from 'ai';
import { ChatService } from './chat.service';
import { FaqKnowledgeService } from '../../search/faq-knowledge.service';
import { FeatureFlagService } from '../../common/feature-flag/feature-flag.service';
import type { TicketService } from '../ticket/ticket.service';
import type { WarrantyService } from '../warranty/warranty.service';
import type { ManualService } from '../manual/manual.service';
import type { OrderLookupService } from '../order-lookup/order-lookup.service';

const mockStreamText = vi.mocked(streamText);

/**
 * Build a fake `streamText` result whose `textStream` async iterator
 * yields the given chunks. `streamText` returns sync `StreamTextResult`
 * (not a Promise), so this is a plain object — chat.service's
 * `await streamText(...)` will simply unwrap to it. Keeps the
 * boilerplate out of every test.
 */
function fakeStreamResult(chunks: string[]): never {
  return {
    textStream: (async function* () {
      for (const c of chunks) {
        yield c;
      }
    })(),
  } as never;
}

/**
 * Helper to simulate an `onStepFinish` invocation with N tool calls
 * and optional ok-false results. Call inside a mockImplementationOnce.
 */
function fireSteps(
  args: Parameters<typeof streamText>[0],
  invocations: number,
  okFalseResults = 0,
) {
  const onStepFinish = (args as { onStepFinish?: (input: unknown) => void }).onStepFinish;
  if (!onStepFinish) {
    return;
  }
  const toolCalls = Array.from({ length: invocations }, (_, i) => ({
    toolName: `tool_${i}`,
  }));
  const toolResults = Array.from({ length: okFalseResults }, (_, i) => ({
    toolName: `tool_${i}`,
    result: { ok: false, error: 'BAD_REQUEST', message: 'x' },
  }));
  onStepFinish({ toolCalls, toolResults });
}

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
        .mockResolvedValue(
          overrides?.chatSession ?? { id: 'sess-1', brandId: 'homtone', customerId: null },
        ),
      create: vi.fn().mockResolvedValue({ id: 'sess-1', sessionToken: 'tok-abc' }),
      update: vi.fn().mockResolvedValue({}),
    },
    chatMessage: {
      create: vi.fn().mockResolvedValue({ id: 'msg-1' }),
      findMany: vi.fn().mockResolvedValue([{ role: 'user', content: 'Hello' }]),
    },
    systemConfig: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    ticket: {
      count: vi.fn().mockResolvedValue(0),
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

  const mockFeatureFlag = {
    isEnabled: vi.fn().mockResolvedValue(false),
  } as unknown as FeatureFlagService;
  const mockTicket = {} as TicketService;
  const mockWarranty = {} as WarrantyService;
  const mockManual = {} as ManualService;
  const mockOrderLookup = {} as OrderLookupService;

  const metricCreate = vi.fn().mockResolvedValue({ id: 'metric-1' });
  const mockPublicDb = { metric: { create: metricCreate } };

  const service = new ChatService(
    tenantDb as any,
    mockPublicDb as any,
    mockFaq,
    mockConfig,
    mockFeatureFlag,
    mockTicket,
    mockWarranty,
    mockManual,
    mockOrderLookup,
  );
  return { service, tenantDb, mockFaq, mockFeatureFlag, metricCreate };
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

  // -------------------------------------------------------------
  // W49 KPI flush behavior — `/review` findings F-2 + F-7 + T-2.
  //
  // F-2: invocation/error must NOT double-count across retries.
  // F-7: session must STILL increment when every attempt fails (so the
  //      call-rate denominator stays accurate under flaky LLM upstream).
  //
  // We mock `streamText` to control retry sequencing without touching
  // the real Gemini provider. Fake timers skip exponential backoff.
  // -------------------------------------------------------------
  describe('handleMessage KPI flush (F-2 + F-7)', () => {
    beforeEach(() => {
      mockStreamText.mockReset();
      // Fake ONLY setTimeout — the ChatService constructor schedules a
      // long-running `setInterval` for idle session eviction; faking
      // setInterval triggers an infinite loop when we advance time.
      vi.useFakeTimers({ toFake: ['setTimeout'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /**
     * Drive a `handleMessage` invocation through its exponential-backoff
     * retry sleeps without waiting real time. We advance up to 5s which
     * covers the worst case of MAX_AI_RETRIES=2 with base 500ms
     * (500ms + 1000ms = 1.5s of total backoff).
     */
    async function runWithFakeTimers<T>(p: Promise<T>): Promise<T> {
      // Yield once so handleMessage queues its first sleep before we
      // advance the clock past it.
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(5000);
      return p;
    }

    it('flushes invocation+error counts ONLY ONCE on a single successful attempt', async () => {
      const { service, mockFeatureFlag, metricCreate } = makeService({
        geminiApiKey: 'gem-test',
      });
      vi.mocked(mockFeatureFlag.isEnabled).mockResolvedValue(true);

      mockStreamText.mockImplementationOnce(((args: unknown) => {
        fireSteps(args as Parameters<typeof streamText>[0], 2, 1); // 2 calls, 1 ok:false
        return fakeStreamResult(['Hello, ', 'world.']);
      }) as never);

      await runWithFakeTimers(
        service.handleMessage({
          sessionId: 'sess-1',
          brandId: 'homtone',
          locale: 'en',
          content: 'Show me my order',
          onEscalate: vi.fn(),
        }),
      );

      // Drain microtasks so the fire-and-forget `metric.create` resolves.
      await Promise.resolve();
      await Promise.resolve();

      const calls = metricCreate.mock.calls.map((c) => c[0].data);
      // Exactly 3 metric rows: 1 session + 1 invocation (value:2) + 1 error (value:1)
      expect(calls).toHaveLength(3);
      expect(calls).toContainEqual({
        name: 'chat.session.with_tools_count',
        value: 1,
        unit: 'count',
        brandId: 'homtone',
      });
      expect(calls).toContainEqual({
        name: 'chat.tool.invocation_count',
        value: 2,
        unit: 'count',
        brandId: 'homtone',
      });
      expect(calls).toContainEqual({
        name: 'chat.tool.error_count',
        value: 1,
        unit: 'count',
        brandId: 'homtone',
      });
    });

    it('does NOT double-count invocations when first attempt fails mid-stream and retry succeeds (F-2)', async () => {
      const { service, mockFeatureFlag, metricCreate } = makeService({
        geminiApiKey: 'gem-test',
      });
      vi.mocked(mockFeatureFlag.isEnabled).mockResolvedValue(true);

      // First attempt: 2 tools fired, then explode mid-stream.
      mockStreamText.mockImplementationOnce(((args: unknown) => {
        fireSteps(args as Parameters<typeof streamText>[0], 2, 0);
        throw new Error('flaky upstream');
      }) as never);
      // Second attempt: 3 tools fired, completes cleanly.
      mockStreamText.mockImplementationOnce(((args: unknown) => {
        fireSteps(args as Parameters<typeof streamText>[0], 3, 0);
        return fakeStreamResult(['ok']);
      }) as never);

      await runWithFakeTimers(
        service.handleMessage({
          sessionId: 'sess-1',
          brandId: 'homtone',
          locale: 'en',
          content: 'Show me my order',
          onEscalate: vi.fn(),
        }),
      );
      await Promise.resolve();
      await Promise.resolve();

      const calls = metricCreate.mock.calls.map((c) => c[0].data);
      const invocationRows = calls.filter((c) => c.name === 'chat.tool.invocation_count');
      const sessionRows = calls.filter((c) => c.name === 'chat.session.with_tools_count');

      // Critical: only the *successful* attempt's 3 invocations are
      // flushed. The 2 from the failed attempt are discarded.
      // Total invocation value = 3, NOT 5 (2 + 3).
      expect(invocationRows).toHaveLength(1);
      expect(invocationRows[0]!.value).toBe(3);
      // Session counted exactly once.
      expect(sessionRows).toHaveLength(1);
      expect(sessionRows[0]!.value).toBe(1);
    });

    it('still counts the session denominator when EVERY attempt fails (F-7)', async () => {
      const { service, mockFeatureFlag, metricCreate } = makeService({
        geminiApiKey: 'gem-test',
      });
      vi.mocked(mockFeatureFlag.isEnabled).mockResolvedValue(true);
      const onEscalate = vi.fn().mockResolvedValue(undefined);

      // All 3 attempts (initial + 2 retries) fail after firing tool calls.
      mockStreamText.mockImplementation(((args: unknown) => {
        fireSteps(args as Parameters<typeof streamText>[0], 1, 0);
        throw new Error('persistent failure');
      }) as never);

      await runWithFakeTimers(
        service.handleMessage({
          sessionId: 'sess-1',
          brandId: 'homtone',
          locale: 'en',
          content: 'Show me my order',
          onEscalate,
        }),
      );
      await Promise.resolve();
      await Promise.resolve();

      const calls = metricCreate.mock.calls.map((c) => c[0].data);
      const sessionRows = calls.filter((c) => c.name === 'chat.session.with_tools_count');
      const invocationRows = calls.filter((c) => c.name === 'chat.tool.invocation_count');
      const errorRows = calls.filter((c) => c.name === 'chat.tool.error_count');

      // Session denominator MUST still be written — leadership needs to
      // know "tools were available for N sessions" even when LLM died.
      expect(sessionRows).toHaveLength(1);
      // Invocation/error counters do NOT flush on full failure — a
      // half-fired tool call from a crashed attempt isn't a real
      // invocation from a leadership perspective.
      expect(invocationRows).toHaveLength(0);
      expect(errorRows).toHaveLength(0);
      // Sanity: handleMessage should still escalate to a human.
      expect(onEscalate).toHaveBeenCalledOnce();
    });

    it('writes ZERO KPI rows when tools are disabled (feature flag off)', async () => {
      const { service, mockFeatureFlag, metricCreate } = makeService({
        geminiApiKey: 'gem-test',
      });
      vi.mocked(mockFeatureFlag.isEnabled).mockResolvedValue(false);

      mockStreamText.mockImplementationOnce(((_args: unknown) =>
        fakeStreamResult(['hi'])) as never);

      await runWithFakeTimers(
        service.handleMessage({
          sessionId: 'sess-1',
          brandId: 'homtone',
          locale: 'en',
          content: 'Hi',
          onEscalate: vi.fn(),
        }),
      );
      await Promise.resolve();
      await Promise.resolve();

      // No KPI rows written at all when tools are off — pre-W48 baseline.
      expect(metricCreate).not.toHaveBeenCalled();
    });
  });

  // W49 leadership KPI — see [W49 brief](../../../../../docs/briefs/2026-05-W49-leadership-sync.md).
  describe('recordToolMetric (W49 KPI)', () => {
    it('writes to public Metric table with correct shape', async () => {
      const { service, metricCreate } = makeService();
      (service as any).recordToolMetric('chat.tool.invocation_count', 1, 'homtone');
      // Recorder is fire-and-forget; let the queued microtask run.
      await Promise.resolve();
      expect(metricCreate).toHaveBeenCalledWith({
        data: {
          name: 'chat.tool.invocation_count',
          value: 1,
          unit: 'count',
          brandId: 'homtone',
        },
      });
    });

    it('swallows metric.create failures so chat is never blocked', async () => {
      const { service, metricCreate } = makeService();
      metricCreate.mockRejectedValueOnce(new Error('db unavailable'));
      // The call itself must not throw — that is the whole contract.
      expect(() =>
        (service as any).recordToolMetric('chat.tool.error_count', 1, 'spoonlemon'),
      ).not.toThrow();
      // Wait for the rejected promise's `.catch` to settle.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  // -------------------------------------------------------------
  // F-3 + T-7 — runtime guard for the ADR-012 §D3 envelope.
  //
  // Pre-fix code was `tr.result as { ok?: boolean }`, which silently
  // type-checked any drift from the documented envelope. These tests
  // assert the guard:
  //   1. Recognizes the documented `{ ok: false, ... }` shape.
  //   2. Returns `false` (not `true`!) for unknown shapes — a missing
  //      `ok` field cannot be assumed to be an error.
  //   3. Logs a warn whenever the shape is unexpected, so an SDK
  //      upgrade fails loudly instead of zeroing the KPI silently.
  // -------------------------------------------------------------
  describe('isToolErrorResult (F-3 envelope guard)', () => {
    function setup() {
      const { service } = makeService();
      const warn = vi.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
      return {
        guard: (toolName: string, raw: unknown): boolean =>
          (service as any).isToolErrorResult(toolName, raw),
        warn,
      };
    }

    it('returns true only for the documented `{ ok: false, ... }` shape', () => {
      const { guard, warn } = setup();
      expect(guard('lookupOrder', { ok: false, error: 'NOT_FOUND', message: 'gone' })).toBe(true);
      expect(warn).not.toHaveBeenCalled();
    });

    it('returns false for `{ ok: true, data: ... }` (success envelope)', () => {
      const { guard, warn } = setup();
      expect(guard('lookupOrder', { ok: true, data: { id: 'o-1' } })).toBe(false);
      expect(warn).not.toHaveBeenCalled();
    });

    it('returns false WITHOUT warning when the result is null / undefined', () => {
      const { guard, warn } = setup();
      expect(guard('noOp', null)).toBe(false);
      expect(guard('noOp', undefined)).toBe(false);
      expect(warn).not.toHaveBeenCalled();
    });

    it('returns false AND warns when result is a non-object primitive', () => {
      const { guard, warn } = setup();
      expect(guard('weirdTool', 'string-result' as unknown)).toBe(false);
      expect(guard('weirdTool', 42 as unknown)).toBe(false);
      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn.mock.calls[0]![0]).toContain('typeof=string');
      expect(warn.mock.calls[1]![0]).toContain('typeof=number');
    });

    it('returns false AND warns when envelope is missing the `ok` field (SDK drift)', () => {
      const { guard, warn } = setup();
      // Simulates a future SDK that wraps results in `{ output: ... }`.
      expect(guard('futureTool', { output: { ok: false, error: 'X' } })).toBe(false);
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0]![0]).toContain('missing "ok" field');
      expect(warn.mock.calls[0]![0]).toContain('keys: [output]');
    });

    it('returns false AND warns when `ok` exists but is not a boolean', () => {
      const { guard, warn } = setup();
      expect(guard('legacy', { ok: 'false' })).toBe(false); // string, not bool
      expect(guard('legacy', { ok: 0 })).toBe(false); // number, not bool
      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn.mock.calls[0]![0]).toContain('non-boolean "ok"');
    });

    it('REGRESSION: would have caught the F-3 silent-zero bug pre-fix', () => {
      // Pre-fix code:  tr.result as { ok?: boolean }  // never throws
      // Pre-fix check: result && result.ok === false  // → always false
      //               for `{ output: { ok: false } }` — silent zeroing.
      //
      // Post-fix: the guard returns false (correct) BUT also warns,
      // so observability catches the drift instead of leadership
      // wondering why error_count is permanently 0.
      const { guard, warn } = setup();
      const futureSdkShape = { output: { ok: false, error: 'BAD_REQUEST' } };
      expect(guard('migratedTool', futureSdkShape)).toBe(false);
      expect(warn).toHaveBeenCalled();
    });
  });
});
