import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { isTenantSchema, type TenantSchema } from '@yaemartos/db';
import type { Request } from 'express';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { TENANT_HEADER } from '../common/tenant/tenant.constants';

@Injectable()
export class CustomerTenantGuard implements CanActivate {
  constructor(private readonly tenantContext: TenantContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const rawValue = req.headers[TENANT_HEADER];
    const brand = Array.isArray(rawValue) ? rawValue[0] : rawValue;

    if (!brand || !isTenantSchema(brand)) {
      throw new BadRequestException('Missing or invalid x-yaemart-brand header');
    }

    this.tenantContext.setTenant(brand as TenantSchema);
    return true;
  }
}
