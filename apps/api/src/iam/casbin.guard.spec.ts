import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CasbinGuard } from './casbin.guard';
import { CasbinService } from './casbin.service';

function createMockContext(
  user: Record<string, unknown> | undefined,
  headers: Record<string, string> = {},
): ExecutionContext {
  const req = { user, headers };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('CasbinGuard', () => {
  let guard: CasbinGuard;
  let casbinService: { enforce: ReturnType<typeof vi.fn> };
  let reflector: Reflector;

  beforeEach(() => {
    casbinService = { enforce: vi.fn() };
    reflector = new Reflector();
    const tenantContext = { getTenant: () => 'homtone' } as any;
    guard = new CasbinGuard(reflector, tenantContext, casbinService as unknown as CasbinService);
  });

  it('allows request when no policy metadata is set', async () => {
    vi.spyOn(reflector, 'get').mockReturnValue(undefined);
    const ctx = createMockContext({ id: '1', role: 'admin' });
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('throws UnauthorizedException when no user', async () => {
    vi.spyOn(reflector, 'get').mockReturnValue({ obj: 'listings', act: 'read' });
    const ctx = createMockContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException when policy denies', async () => {
    vi.spyOn(reflector, 'get').mockReturnValue({ obj: 'listings', act: 'write' });
    casbinService.enforce.mockResolvedValue(false);
    const ctx = createMockContext({ id: '1', role: 'operator', brandId: 'homtone' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows when policy permits', async () => {
    vi.spyOn(reflector, 'get').mockReturnValue({ obj: 'listings', act: 'read' });
    casbinService.enforce.mockResolvedValue(true);
    const ctx = createMockContext({ id: '1', role: 'admin', brandId: 'homtone' });
    expect(await guard.canActivate(ctx)).toBe(true);
  });
});
