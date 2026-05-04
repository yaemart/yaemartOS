import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

vi.mock('ioredis', () => {
  return {
    default: class FakeRedis {
      on() {}
      disconnect() {}
      eval() {
        return Promise.resolve([1, 1]);
      }
    },
  };
});

import { AiRateLimitGuard } from './ai-rate-limit.guard';
import { AiRateLimitOptions } from './ai-rate-limit.decorator';

interface MockRedis {
  eval: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function makeContext(opts: { brandId?: string; userId?: string }): ExecutionContext {
  const headers: Record<string, unknown> = {};
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        resolvedBrandId: opts.brandId,
        user: opts.userId ? { sub: opts.userId } : undefined,
      }),
      getResponse: () => ({
        setHeader: (k: string, v: unknown) => {
          headers[k] = v;
        },
      }),
    }),
    getHandler: () => () => undefined,
    getClass: () => class {},
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

interface GuardOptions {
  /** First eval result (brand bucket). */
  evalReturn?: [number, number];
  /** Subsequent eval results in order. Lets tests model brand-pass + user-fail. */
  evalSequence?: Array<[number, number]>;
  throwOnEval?: boolean;
  metadata?: AiRateLimitOptions;
}

function makeGuard(opts: GuardOptions) {
  const reflector = {
    getAllAndOverride: vi
      .fn()
      .mockReturnValue(
        opts.metadata ?? ({ model: 'glm-4-flash', requestsPerMinute: 10 } as AiRateLimitOptions),
      ),
  } as unknown as Reflector;

  const config = {
    get: vi.fn().mockReturnValue('redis://localhost:6379'),
  } as unknown as { get: (k: string) => string };

  const guard = new AiRateLimitGuard(reflector, config as never);

  let evalFn: ReturnType<typeof vi.fn>;
  if (opts.throwOnEval) {
    evalFn = vi.fn().mockRejectedValue(new Error('redis down'));
  } else if (opts.evalSequence) {
    evalFn = vi.fn();
    for (const r of opts.evalSequence) {
      evalFn.mockResolvedValueOnce(r);
    }
  } else {
    evalFn = vi.fn().mockResolvedValue(opts.evalReturn ?? [1, 1]);
  }

  (guard as unknown as { redis: MockRedis }).redis = {
    eval: evalFn,
    on: vi.fn(),
    disconnect: vi.fn(),
  };
  return { guard, reflector, evalFn };
}

describe('AiRateLimitGuard', () => {
  it('allows requests under the limit (Lua returns allowed=1)', async () => {
    const { guard } = makeGuard({ evalReturn: [1, 5] });
    const ctx = makeContext({ brandId: 'homtone' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows the boundary request at exactly the limit', async () => {
    const { guard } = makeGuard({ evalReturn: [1, 10] });
    const ctx = makeContext({ brandId: 'homtone' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects requests over the limit (Lua returns allowed=0)', async () => {
    const { guard } = makeGuard({ evalReturn: [0, 10] });
    const ctx = makeContext({ brandId: 'homtone' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });

  it('does not write to bucket when over the limit (Lua refuses zadd, count stays)', async () => {
    // The Lua script only zadds when under limit, so a rejected request must
    // not consume future quota. We assert the guard surfaces 429 and trusts
    // Lua to keep the bucket clean.
    const { guard, evalFn } = makeGuard({ evalReturn: [0, 10] });
    const ctx = makeContext({ brandId: 'homtone' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
    expect(evalFn).toHaveBeenCalledTimes(1);
  });

  it('skips when no decorator metadata is present', async () => {
    const { guard, reflector } = makeGuard({ evalReturn: [0, 999] });
    (reflector.getAllAndOverride as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const ctx = makeContext({ brandId: 'homtone' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('fail-open when Redis is unreachable', async () => {
    const { guard } = makeGuard({ throwOnEval: true });
    const ctx = makeContext({ brandId: 'homtone' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  describe('user-bucket cross-brand ceiling', () => {
    it('checks both brand and user buckets when userId resolved', async () => {
      const { guard, evalFn } = makeGuard({
        evalSequence: [
          [1, 5], // brand bucket: allowed
          [1, 10], // user bucket: allowed
        ],
      });
      const ctx = makeContext({ brandId: 'homtone', userId: 'user-1' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(evalFn).toHaveBeenCalledTimes(2);
    });

    it('rejects with 429 when brand passes but user limit exceeded', async () => {
      const { guard } = makeGuard({
        evalSequence: [
          [1, 5], // brand bucket: allowed
          [0, 20], // user bucket: rejected (cross-brand stack detected)
        ],
      });
      const ctx = makeContext({ brandId: 'homtone', userId: 'user-1' });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
    });

    it('skips user-bucket check when brandId equals userId (anonymous fallback)', async () => {
      // When req.user is missing and we fall back to userId === brandId, the
      // user bucket would be a duplicate of the brand bucket. Skip it.
      const { guard, evalFn } = makeGuard({ evalReturn: [1, 1] });
      const ctx = makeContext({ brandId: 'anonymous' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(evalFn).toHaveBeenCalledTimes(1);
    });

    it('honors userRequestsPerMinute=null to disable user ceiling', async () => {
      const { guard, evalFn } = makeGuard({
        evalReturn: [1, 1],
        metadata: { model: 'glm-4-flash', requestsPerMinute: 10, userRequestsPerMinute: null },
      });
      const ctx = makeContext({ brandId: 'homtone', userId: 'user-1' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(evalFn).toHaveBeenCalledTimes(1);
    });
  });
});
