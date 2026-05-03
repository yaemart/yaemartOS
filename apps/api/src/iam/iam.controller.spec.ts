import { describe, expect, it, vi } from 'vitest';
import { IamController } from './iam.controller';

function createController(overrides?: {
  enforce?: (ctx: unknown) => Promise<boolean>;
  isEnabled?: (flag: string) => Promise<boolean>;
}) {
  const casbin = {
    enforce: overrides?.enforce ?? vi.fn().mockResolvedValue(false),
  } as any;

  const tenantContext = {
    getTenant: vi.fn().mockReturnValue('homtone'),
  } as any;

  const featureFlag = {
    isEnabled: overrides?.isEnabled ?? vi.fn().mockResolvedValue(false),
  } as any;

  const controller = new IamController(casbin, tenantContext, featureFlag);
  return { controller, casbin, tenantContext, featureFlag };
}

function makeReq(user?: { id?: string; role?: string; brandId?: string }) {
  return { user } as any;
}

describe('IamController.getCapabilities', () => {
  it('returns empty capabilities when user has no role', async () => {
    const { controller } = createController();
    const result = await controller.getCapabilities(makeReq({ id: 'u1' }));
    expect(result.capabilities).toEqual([]);
    expect(result.availableActions).toEqual([]);
  });

  it('returns empty capabilities when user is undefined', async () => {
    const { controller } = createController();
    const result = await controller.getCapabilities(makeReq(undefined));
    expect(result.capabilities).toEqual([]);
    expect(result.availableActions).toEqual([]);
  });

  it('includes permitted casbin objects in capabilities', async () => {
    const { controller } = createController({
      enforce: async (ctx: any) => {
        return ctx.obj === 'listings' && ctx.act === 'read';
      },
    });

    const result = await controller.getCapabilities(
      makeReq({ id: 'u1', role: 'operator', brandId: 'homtone' }),
    );

    expect(result.capabilities).toContain('listings:read');
    expect(result.capabilities).not.toContain('listings:write');
    expect(result.capabilities).not.toContain('shops:read');
  });

  it('appends enabled feature flags to capabilities', async () => {
    const { controller } = createController({
      isEnabled: async (flag: string) => flag === 'LISTING_MATRIX',
    });

    const result = await controller.getCapabilities(
      makeReq({ id: 'u1', role: 'operator', brandId: 'homtone' }),
    );

    expect(result.capabilities).toContain('LISTING_MATRIX');
    expect(result.capabilities).not.toContain('LISTING_AI');
    expect(result.capabilities).not.toContain('BATCH_LISTING_GENERATE');
  });

  it('returns availableActions for each permitted casbin capability', async () => {
    const { controller } = createController({
      enforce: async (ctx: any) => ctx.obj === 'listings' && ctx.act === 'read',
    });

    const result = await controller.getCapabilities(
      makeReq({ id: 'u1', role: 'operator', brandId: 'homtone' }),
    );

    expect(result.availableActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'GET', path: '/listings' }),
        expect.objectContaining({ method: 'GET', path: '/listings/:id' }),
        expect.objectContaining({ method: 'GET', path: '/listings/matrix' }),
      ]),
    );
  });

  it('feature-flag capabilities do not add extra availableActions (no entry in CAPABILITY_ACTIONS)', async () => {
    const { controller } = createController({
      isEnabled: async () => true,
    });

    const result = await controller.getCapabilities(
      makeReq({ id: 'u1', role: 'operator', brandId: 'homtone' }),
    );

    // Feature flags appear in capabilities but have no REST action mappings
    expect(result.capabilities).toContain('LISTING_MATRIX');
    const matrixActions = (result.availableActions ?? []).filter(
      (a: { path: string }) => a.path === '/listings/matrix',
    );
    expect(matrixActions).toHaveLength(0);
  });

  it('availableActions is empty when no casbin permissions and no feature flags', async () => {
    const { controller } = createController();
    const result = await controller.getCapabilities(
      makeReq({ id: 'u1', role: 'viewer', brandId: 'homtone' }),
    );
    expect(result.availableActions).toEqual([]);
  });

  it('uses brandId from user when provided', async () => {
    const { controller, casbin } = createController();

    await controller.getCapabilities(makeReq({ id: 'u1', role: 'admin', brandId: 'spoonlemon' }));

    expect(casbin.enforce).toHaveBeenCalledWith(expect.objectContaining({ brand: 'spoonlemon' }));
  });

  it('falls back to tenantContext brand when user has no brandId', async () => {
    const { controller, casbin, tenantContext } = createController();
    tenantContext.getTenant.mockReturnValue('davivy');

    await controller.getCapabilities(makeReq({ id: 'u1', role: 'admin' }));

    expect(casbin.enforce).toHaveBeenCalledWith(expect.objectContaining({ brand: 'davivy' }));
  });

  it('locale_reviewer has listings:read and terminology:read in capabilities', async () => {
    const { controller } = createController({
      enforce: async (ctx: any) => {
        return (
          (ctx.sub === 'locale_reviewer' && ctx.obj === 'listings' && ctx.act === 'read') ||
          (ctx.sub === 'locale_reviewer' && ctx.obj === 'terminology' && ctx.act === 'read')
        );
      },
    });

    const result = await controller.getCapabilities(
      makeReq({ id: 'u1', role: 'locale_reviewer', brandId: 'homtone' }),
    );

    expect(result.capabilities).toContain('listings:read');
    expect(result.capabilities).toContain('terminology:read');
    expect(result.capabilities).not.toContain('listings:write');
    expect(result.capabilities).not.toContain('products:read');
  });

  it('locale_reviewer availableActions include GET /terminology and POST /terminology/import', async () => {
    const { controller } = createController({
      enforce: async (ctx: any) =>
        ctx.obj === 'terminology' && (ctx.act === 'read' || ctx.act === 'write'),
    });

    const result = await controller.getCapabilities(
      makeReq({ id: 'u1', role: 'locale_reviewer', brandId: 'homtone' }),
    );

    const paths = result.availableActions.map((a: { path: string }) => a.path);
    expect(paths).toContain('/terminology');
    expect(paths).toContain('/terminology/import');
  });

  it('parallelises feature flag checks (Promise.all pattern)', async () => {
    const callOrder: string[] = [];
    const isEnabled = vi.fn().mockImplementation(async (flag: string) => {
      callOrder.push(flag);
      return false;
    });

    const { controller } = createController({ isEnabled });

    await controller.getCapabilities(makeReq({ id: 'u1', role: 'admin', brandId: 'homtone' }));

    // All 3 flags should have been checked
    expect(callOrder).toHaveLength(3);
    expect(callOrder).toContain('LISTING_MATRIX');
    expect(callOrder).toContain('LISTING_AI');
    expect(callOrder).toContain('BATCH_LISTING_GENERATE');
  });
});
