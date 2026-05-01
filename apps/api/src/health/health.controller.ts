import { Controller, Get, Optional } from '@nestjs/common';
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

  @Get()
  async check() {
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
