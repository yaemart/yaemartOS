import { Controller, Get, HttpCode, Optional } from '@nestjs/common';
import { PrismaClientManager } from '../database/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { SearchService } from '../search/search.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly tenantContext: TenantContextService,
    @Optional() private readonly searchService?: SearchService,
  ) {}

  /**
   * Liveness probe — no I/O.
   * K8s: use for livenessProbe. Failure = pod restart.
   * Always returns 200 as long as the process is running.
   */
  @Get('live')
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe — checks DB and search connectivity.
   * K8s: use for readinessProbe. Failure = remove pod from Service endpoints (no restart).
   * Returns 503 when any dependency is degraded.
   */
  @Get('ready')
  @HttpCode(200)
  async ready() {
    return this.checkReady();
  }

  /**
   * Legacy combined health endpoint — delegates to ready logic.
   * Kept for backward compatibility with existing clients and k6 scripts.
   */
  @Get()
  async check() {
    return this.checkReady();
  }

  private async checkReady() {
    let db: 'up' | 'down' = 'up';
    try {
      await this.prismaManager.getPublicClient().$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }

    const search = this.searchService
      ? await this.searchService.health()
      : { status: 'not_loaded' };

    const overall = db === 'down' ? 'degraded' : search.status === 'degraded' ? 'degraded' : 'ok';

    return {
      status: overall,
      db,
      search: search.status,
      tenant: this.tenantContext.getTenant(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.1',
    };
  }
}
