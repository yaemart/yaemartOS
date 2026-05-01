import { Global, Module, Scope } from '@nestjs/common';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { PRISMA_PUBLIC_CLIENT, PRISMA_TENANT_CLIENT } from './database.tokens';
import { PrismaClientManager } from './prisma.service';

@Global()
@Module({
  providers: [
    TenantContextService,
    PrismaClientManager,
    {
      provide: PRISMA_PUBLIC_CLIENT,
      useFactory: (manager: PrismaClientManager) => manager.getPublicClient(),
      inject: [PrismaClientManager],
    },
    {
      provide: PRISMA_TENANT_CLIENT,
      scope: Scope.REQUEST,
      useFactory: (manager: PrismaClientManager, tenantContext: TenantContextService) =>
        manager.getTenantClient(tenantContext.getTenant()),
      inject: [PrismaClientManager, TenantContextService],
    },
  ],
  exports: [TenantContextService, PrismaClientManager, PRISMA_PUBLIC_CLIENT, PRISMA_TENANT_CLIENT],
})
export class DatabaseModule {}
