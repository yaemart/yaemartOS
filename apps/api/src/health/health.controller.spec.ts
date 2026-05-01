import { describe, it, expect } from 'vitest';
import { HealthController } from './health.controller';
import type { PrismaClientManager } from '../database/prisma.service';
import type { TenantContextService } from '../common/tenant/tenant-context.service';

const tenantContext = {
  getTenant: () => 'homtone',
} as unknown as TenantContextService;

describe('HealthController', () => {
  describe('GET /health/live', () => {
    const controller = new HealthController({} as unknown as PrismaClientManager, tenantContext);

    it('returns status ok without any I/O', () => {
      const result = controller.live();
      expect(result.status).toBe('ok');
    });

    it('returns ISO timestamp', () => {
      const result = controller.live();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it('does not include db or search fields', () => {
      const result = controller.live() as Record<string, unknown>;
      expect(result['db']).toBeUndefined();
      expect(result['search']).toBeUndefined();
    });
  });

  describe('GET /health/ready and GET /health', () => {
    const healthyPrisma = {
      getPublicClient: () => ({ $queryRaw: async () => 1 }),
    } as unknown as PrismaClientManager;

    const failingPrisma = {
      getPublicClient: () => ({
        $queryRaw: async () => {
          throw new Error('DB down');
        },
      }),
    } as unknown as PrismaClientManager;

    it('returns status ok when DB is reachable', async () => {
      const controller = new HealthController(healthyPrisma, tenantContext);
      const result = await controller.ready();
      expect(result.status).toBe('ok');
      expect(result.db).toBe('up');
    });

    it('returns status degraded when DB is down', async () => {
      const controller = new HealthController(failingPrisma, tenantContext);
      const result = await controller.ready();
      expect(result.status).toBe('degraded');
      expect(result.db).toBe('down');
    });

    it('GET /health (legacy) returns same structure as /health/ready', async () => {
      const controller = new HealthController(healthyPrisma, tenantContext);
      const legacy = await controller.check();
      const ready = await controller.ready();
      expect(legacy.status).toBe(ready.status);
      expect(legacy.db).toBe(ready.db);
      expect(Object.keys(legacy)).toEqual(Object.keys(ready));
    });

    it('returns ISO timestamp', async () => {
      const controller = new HealthController(healthyPrisma, tenantContext);
      const result = await controller.ready();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });
});
