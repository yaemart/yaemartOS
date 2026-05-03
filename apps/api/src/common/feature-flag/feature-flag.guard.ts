import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { FeatureFlagService } from './feature-flag.service';

export const FEATURE_FLAG_KEY = 'feature_flag';

/** Mark a controller or handler with the required feature flag name. */
export const RequireFeatureFlag = (flag: string): ClassDecorator & MethodDecorator =>
  SetMetadata(FEATURE_FLAG_KEY, flag);

/**
 * Guard that checks whether a feature flag is enabled for the current brand × market × language.
 * Uses async DB + env resolution from FeatureFlagService.
 *
 * Dimension sources (in priority order):
 *  - brand:    CLS `tenantId` (set by CustomerTenantGuard / TenantGuard)
 *  - market:   CLS `market`  → x-yaemart-market header
 *  - language: CLS `language` → Accept-Language header (first tag only)
 *
 * Apply AFTER CustomerTenantGuard so that the tenantId is already set in CLS.
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlag: FeatureFlagService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flag = this.reflector.getAllAndOverride<string | undefined>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!flag) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();

    const brandId = this.cls.get<string | undefined>('tenantId');
    const market =
      (this.cls.get<string | undefined>('market') ??
        (req.headers['x-yaemart-market'] as string | undefined)) ||
      undefined;
    const language =
      (this.cls.get<string | undefined>('language') ??
        (req.headers['accept-language'] as string | undefined)
          ?.split(',')[0]
          ?.split(';')[0]
          ?.trim()) ||
      undefined;

    const enabled = await this.featureFlag.isEnabled(flag, { brand: brandId, market, language });

    if (!enabled) {
      throw new ForbiddenException(
        `Feature '${flag}' is not enabled${brandId ? ` for brand '${brandId}'` : ''}`,
      );
    }

    return true;
  }
}
