import { describe, it, expect } from 'vitest';
import { HealthController } from './health.controller';
import type { PrismaClientManager } from '../database/prisma.service';
import type { TenantContextService } from '../common/tenant/tenant-context.service';

describe('HealthController', () => {
  const prismaManager = {
    getPublicClient: () => ({ $queryRaw: async () => 1 }),
  } as unknown as PrismaClientManager;
  const tenantContext = {
    getTenant: () => 'homtone',
  } as unknown as TenantContextService;
  const controller = new HealthController(prismaManager, tenantContext);

  it('returns status ok', async () => {
    const result = await controller.check();
    expect(result.status).toBe('ok');
    expect(result.db).toBe('up');
  });

  it('returns ISO timestamp', async () => {
    const result = await controller.check();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
