import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { CasbinGuard } from './casbin.guard';
import { CasbinService } from './casbin.service';
import { POLICY_METADATA_KEY, type PolicyRequirement } from './require-policy.decorator';

const DEFAULT_REQUIREMENT: PolicyRequirement = { obj: 'listing:read', act: 'read' };

function makeContext(overrides: {
  user?: { id?: string; role?: string; brandId?: string };
  headers?: Record<string, string>;
}): ExecutionContext & { _req: Record<string, unknown> } {
  const req: Record<string, unknown> = {
    user: overrides.user,
    headers: overrides.headers ?? {},
  };
  return {
    _req: req,
    getHandler: () => ({}),
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext & { _req: Record<string, unknown> };
}

describe('CasbinGuard', () => {
  let guard: CasbinGuard;
  let reflector: Reflector;
  let tenantContext: TenantContextService;
  let casbinService: CasbinService;

  beforeEach(() => {
    reflector = {
      get: vi.fn().mockReturnValue(DEFAULT_REQUIREMENT),
    } as unknown as Reflector;

    tenantContext = {
      getTenant: vi.fn().mockReturnValue('homtone'),
    } as unknown as TenantContextService;

    casbinService = {
      enforce: vi.fn().mockResolvedValue(true),
    } as unknown as CasbinService;

    guard = new CasbinGuard(reflector, tenantContext, casbinService);
  });

  it('returns true when no policy requirement is set on handler', async () => {
    (reflector.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const ctx = makeContext({ user: { id: 'u1', role: 'operator', brandId: 'homtone' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(casbinService.enforce).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when req.user is absent', async () => {
    const ctx = makeContext({ user: undefined });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when user has no role', async () => {
    const ctx = makeContext({ user: { id: 'u1' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException when main enforce denies access', async () => {
    (casbinService.enforce as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const ctx = makeContext({ user: { id: 'u1', role: 'operator', brandId: 'homtone' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  describe('resolvedBrandId assignment', () => {
    it('sets resolvedBrandId to user.brandId when no x-yaemart-brand header', async () => {
      const ctx = makeContext({ user: { id: 'u1', role: 'operator', brandId: 'homtone' } });
      await guard.canActivate(ctx);
      expect(ctx._req.resolvedBrandId).toBe('homtone');
      expect(casbinService.enforce).toHaveBeenCalledTimes(1);
    });

    it('sets resolvedBrandId to user.brandId when header equals user.brandId (no extra enforce call)', async () => {
      const ctx = makeContext({
        user: { id: 'u1', role: 'operator', brandId: 'homtone' },
        headers: { 'x-yaemart-brand': 'homtone' },
      });
      await guard.canActivate(ctx);
      expect(ctx._req.resolvedBrandId).toBe('homtone');
      expect(casbinService.enforce).toHaveBeenCalledTimes(1);
    });

    it('sets resolvedBrandId to headerBrand when user has permission for target brand', async () => {
      (casbinService.enforce as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(true) // main check passes
        .mockResolvedValueOnce(true); // brand-override check passes

      const ctx = makeContext({
        user: { id: 'u1', role: 'admin', brandId: 'homtone' },
        headers: { 'x-yaemart-brand': 'spoonlemon' },
      });
      await guard.canActivate(ctx);
      expect(ctx._req.resolvedBrandId).toBe('spoonlemon');
      expect(casbinService.enforce).toHaveBeenCalledTimes(2);
      const secondCall = (casbinService.enforce as ReturnType<typeof vi.fn>).mock.calls[1][0];
      expect(secondCall.brand).toBe('spoonlemon');
    });

    it('silently falls back to user.brandId when user lacks permission for target brand', async () => {
      (casbinService.enforce as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(true) // main check passes
        .mockResolvedValueOnce(false); // brand-override check denied

      const ctx = makeContext({
        user: { id: 'u1', role: 'operator', brandId: 'homtone' },
        headers: { 'x-yaemart-brand': 'davivy' },
      });
      await guard.canActivate(ctx);
      expect(ctx._req.resolvedBrandId).toBe('homtone');
    });

    it('uses tenantContext brand as baseBrand when user.brandId is absent', async () => {
      const ctx = makeContext({ user: { id: 'u1', role: 'operator' } });
      await guard.canActivate(ctx);
      expect(ctx._req.resolvedBrandId).toBe('homtone');
      expect(tenantContext.getTenant).toHaveBeenCalled();
    });
  });

  describe('brand-override enforce call uses same obj/act/field as main check', () => {
    it('passes requirement obj, act, and derived field to the override enforce call', async () => {
      (casbinService.enforce as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const ctx = makeContext({
        user: { id: 'u1', role: 'admin', brandId: 'homtone' },
        headers: { 'x-yaemart-brand': 'tysun' },
      });
      await guard.canActivate(ctx);

      const [mainArgs, overrideArgs] = (casbinService.enforce as ReturnType<typeof vi.fn>).mock
        .calls;
      expect(overrideArgs[0].obj).toBe(mainArgs[0].obj);
      expect(overrideArgs[0].act).toBe(mainArgs[0].act);
      expect(overrideArgs[0].field).toBe(mainArgs[0].field);
      expect(overrideArgs[0].brand).toBe('tysun');
    });
  });

  describe('POLICY_METADATA_KEY usage', () => {
    it('passes the correct metadata key to reflector', async () => {
      const ctx = makeContext({ user: { id: 'u1', role: 'operator', brandId: 'homtone' } });
      await guard.canActivate(ctx);
      expect(reflector.get).toHaveBeenCalledWith(POLICY_METADATA_KEY, expect.anything());
    });
  });
});
