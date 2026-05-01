import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { isTenantSchema } from '@yaemartos/db';
import type { Request } from 'express';
import { VALID_TENANTS, TENANT_HEADER, DEFAULT_TENANT } from './tenant.constants';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantContext: TenantContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const rawValue = req.headers[TENANT_HEADER] ?? req.headers['x-tenant'];
    const tenant = Array.isArray(rawValue) ? rawValue[0] : rawValue;

    if (typeof tenant === 'string' && tenant.length > 0 && !isTenantSchema(tenant)) {
      throw new BadRequestException(`invalid tenant: ${tenant}`);
    }

    const normalized =
      typeof tenant === 'string' && isTenantSchema(tenant) && VALID_TENANTS.includes(tenant)
        ? tenant
        : DEFAULT_TENANT;

    this.tenantContext.setTenant(normalized);
    return true;
  }
}
