import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { FeatureFlagService } from './feature-flag.service';

export const FEATURE_FLAG_KEY = 'feature_flag';

/** Mark a controller or handler with the required feature flag name. */
export const RequireFeatureFlag = (flag: string): ClassDecorator & MethodDecorator =>
  SetMetadata(FEATURE_FLAG_KEY, flag);

/**
 * Guard that checks whether a feature flag is enabled for the current brand.
 * Uses async DB + env resolution from FeatureFlagService.
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

    const brandId = this.cls.get<string | undefined>('tenantId');
    const enabled = await this.featureFlag.isEnabled(flag, brandId);

    if (!enabled) {
      throw new ForbiddenException(
        `Feature '${flag}' is not enabled${brandId ? ` for brand '${brandId}'` : ''}`,
      );
    }

    return true;
  }
}
