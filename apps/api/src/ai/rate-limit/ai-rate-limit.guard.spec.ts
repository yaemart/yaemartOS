import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

vi.mock('ioredis', () => {
  return {
    default: class FakeRedis {
      on() {}
      disconnect() {}
      multi() {
        return { exec: () => Promise.resolve(null) };
      }
    },
  };
});

import { AiRateLimitGuard } from './ai-rate-limit.guard';
import { AiRateLimitOptions } from './ai-rate-limit.decorator';

interface MockRedis {
  multi: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function makeContext(brandId: string | undefined): ExecutionContext {
  const headers: Record<string, unknown> = {};
  return {
    switchToHttp: () => ({
      getRequest: () => ({ resolvedBrandId: brandId }),
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

function makeGuard(opts: { count: number; throwOnExec?: boolean }) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue({
      model: 'glm-4-flash',
      requestsPerMinute: 10,
    } as AiRateLimitOptions),
  } as unknown as Reflector;

  const config = {
    get: vi.fn().mockReturnValue('redis://localhost:6379'),
  } as unknown as { get: (k: string) => string };

  const guard = new AiRateLimitGuard(reflector, config as never);

  const pipeline = {
    zremrangebyscore: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: opts.throwOnExec
      ? vi.fn().mockRejectedValue(new Error('redis down'))
      : vi.fn().mockResolvedValue([
          [null, 0],
          [null, 1],
          [null, opts.count],
          [null, 1],
        ]),
  };
  (guard as unknown as { redis: MockRedis }).redis = {
    multi: vi.fn().mockReturnValue(pipeline),
    on: vi.fn(),
    disconnect: vi.fn(),
  };
  return { guard, reflector };
}

describe('AiRateLimitGuard', () => {
  it('allows requests under the limit', async () => {
    const { guard } = makeGuard({ count: 5 });
    const ctx = makeContext('homtone');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects requests over the limit', async () => {
    const { guard } = makeGuard({ count: 11 });
    const ctx = makeContext('homtone');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });

  it('skips when no decorator metadata is present', async () => {
    const { guard, reflector } = makeGuard({ count: 999 });
    (reflector.getAllAndOverride as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const ctx = makeContext('homtone');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('fail-open when Redis is unreachable', async () => {
    const { guard } = makeGuard({ count: 0, throwOnExec: true });
    const ctx = makeContext('homtone');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
