import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { CasbinService } from './casbin.service';
import { POLICY_METADATA_KEY, type PolicyRequirement } from './require-policy.decorator';

@Injectable()
export class CasbinGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
    private readonly casbinService: CasbinService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.get<PolicyRequirement>(
      POLICY_METADATA_KEY,
      context.getHandler(),
    );
    if (!requirement) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as { id?: string; role?: string; brandId?: string } | undefined;
    if (!user?.id || !user.role) {
      throw new UnauthorizedException('Authentication required');
    }

    const market = this.readHeader(req, 'x-market', '*');
    const platform = this.readHeader(req, 'x-platform', '*');
    const shop = this.readHeader(req, 'x-shop', '*');
    const category = this.readHeader(req, 'x-category', '*');
    const field = requirement.field ?? this.readHeader(req, 'x-field', '*');

    const allowed = await this.casbinService.enforce({
      sub: user.role,
      obj: requirement.obj,
      act: requirement.act,
      brand: user.brandId ?? this.tenantContext.getTenant(),
      market,
      platform,
      shop,
      category,
      field,
    });

    if (!allowed) {
      throw new ForbiddenException('Policy denied');
    }

    (req as any).allowedFields = field === '*' ? ['*'] : field.split(',').map((f) => f.trim());

    const baseBrand = user.brandId ?? this.tenantContext.getTenant();
    const headerBrand = this.readHeader(req, 'x-yaemart-brand', '');

    if (headerBrand && headerBrand !== baseBrand) {
      const brandAllowed = await this.casbinService.enforce({
        sub: user.role,
        obj: requirement.obj,
        act: requirement.act,
        brand: headerBrand,
        market,
        platform,
        shop,
        category,
        field,
      });
      (req as any).resolvedBrandId = brandAllowed ? headerBrand : baseBrand;
    } else {
      (req as any).resolvedBrandId = baseBrand;
    }

    return true;
  }

  private readHeader(req: Request, header: string, fallback: string): string {
    const value = req.headers[header];
    if (!value) {
      return fallback;
    }
    return Array.isArray(value) ? value[0] : value;
  }
}
