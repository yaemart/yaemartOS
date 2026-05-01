import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { TenantContextService } from './tenant-context.service';
import { TenantGuard } from './tenant.guard';

function makeExecutionContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('TenantGuard', () => {
  it('uses default tenant when header missing', () => {
    const setTenantCalls: string[] = [];
    const ctx = {
      setTenant: (value: string) => setTenantCalls.push(value),
    } as unknown as TenantContextService;
    const guard = new TenantGuard(ctx);

    expect(guard.canActivate(makeExecutionContext({}))).toBe(true);
    expect(setTenantCalls).toEqual(['homtone']);
  });

  it('throws 400 when tenant header is invalid', () => {
    const ctx = {
      setTenant: () => undefined,
    } as unknown as TenantContextService;
    const guard = new TenantGuard(ctx);

    expect(() =>
      guard.canActivate(makeExecutionContext({ 'x-yaemart-brand': 'unknown-brand' })),
    ).toThrow(BadRequestException);
  });
});
