import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { CasbinService } from './casbin.service';

const KNOWN_OBJECTS = [
  'dashboard:read',
  'products:read',
  'products:write',
  'listings:read',
  'listings:write',
  'categories:read',
  'categories:write',
  'shops:read',
  'shops:write',
  'settings:read',
  'settings:write',
  'iam:read',
  'iam:write',
] as const;

@Controller('iam')
export class IamController {
  constructor(
    private readonly casbin: CasbinService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get('capabilities')
  @UseGuards(JwtAuthGuard)
  async getCapabilities(@Req() req: Request) {
    const user = req.user as { id?: string; role?: string; brandId?: string } | undefined;
    if (!user?.role) {
      return { capabilities: [] };
    }

    const brand = user.brandId ?? this.tenantContext.getTenant();
    const capabilities: string[] = [];

    for (const obj of KNOWN_OBJECTS) {
      const [resource, action] = obj.split(':');
      const allowed = await this.casbin.enforce({
        sub: user.role,
        obj: resource,
        act: action,
        brand,
        market: '*',
        platform: '*',
        shop: '*',
        category: '*',
        field: '*',
      });
      if (allowed) {
        capabilities.push(obj);
      }
    }

    return { capabilities };
  }
}
