import { Injectable } from '@nestjs/common';
import { type TenantSchema } from '@yaemartos/db';
import { ClsService } from 'nestjs-cls';
import { DEFAULT_TENANT } from './tenant.constants';

type TenantStore = {
  tenant?: TenantSchema;
};

@Injectable()
export class TenantContextService {
  constructor(private readonly cls: ClsService<TenantStore>) {}

  setTenant(tenant: TenantSchema) {
    this.cls.set('tenant', tenant);
  }

  getTenant(): TenantSchema {
    return this.cls.get('tenant') ?? DEFAULT_TENANT;
  }
}
