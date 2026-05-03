import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClientManager } from '../../database/prisma.service';

/**
 * Feature flag resolution with brand-level granularity.
 *
 * Priority (highest to lowest):
 *   1. DB: SystemConfig key "feature_flag.{FLAG}_{BRAND_ID_UPPER}" — brand-scoped DB override
 *   2. DB: SystemConfig key "feature_flag.{FLAG}"                  — global DB value
 *   3. Env: FEATURE_{FLAG}_{BRAND_ID_UPPER}                        — brand-scoped env override
 *   4. Env: FEATURE_{FLAG}                                         — global env default
 *   5. false                                                        — closed by default
 *
 * DB values take precedence over env vars, enabling runtime configuration
 * via the Settings UI without requiring a redeploy.
 */
@Injectable()
export class FeatureFlagService {
  constructor(
    private readonly config: ConfigService,
    private readonly prismaManager: PrismaClientManager,
  ) {}

  async isEnabled(flag: string, brandId?: string): Promise<boolean> {
    const upperFlag = flag.toUpperCase();

    if (brandId) {
      const brandDbKey = `feature_flag.${upperFlag}.${brandId.toLowerCase()}`;
      const brandDbValue = await this.getDbValue(brandDbKey);
      if (brandDbValue !== null) {
        return brandDbValue === 'true';
      }

      const brandEnvKey = `FEATURE_${upperFlag}_${brandId.toUpperCase()}`;
      const brandEnvValue = this.config.get<string>(brandEnvKey);
      if (brandEnvValue !== undefined) {
        return brandEnvValue === 'true';
      }
    }

    const globalDbKey = `feature_flag.${upperFlag}`;
    const globalDbValue = await this.getDbValue(globalDbKey);
    if (globalDbValue !== null) {
      return globalDbValue === 'true';
    }

    const globalEnvKey = `FEATURE_${upperFlag}`;
    const globalEnvValue = this.config.get<string>(globalEnvKey);
    if (globalEnvValue !== undefined) {
      return globalEnvValue === 'true';
    }

    return false;
  }

  /** Synchronous check using only env vars (for performance-critical hot paths). */
  isEnabledSync(flag: string, brandId?: string): boolean {
    const upperFlag = flag.toUpperCase();

    if (brandId) {
      const brandKey = `FEATURE_${upperFlag}_${brandId.toUpperCase()}`;
      const brandValue = this.config.get<string>(brandKey);
      if (brandValue !== undefined) {
        return brandValue === 'true';
      }
    }

    const globalKey = `FEATURE_${upperFlag}`;
    const globalValue = this.config.get<string>(globalKey);
    if (globalValue !== undefined) {
      return globalValue === 'true';
    }

    return false;
  }

  private async getDbValue(key: string): Promise<string | null> {
    try {
      const row = await this.prismaManager
        .getPublicClient()
        .systemConfig.findUnique({ where: { key }, select: { value: true } });
      return row?.value ?? null;
    } catch {
      return null;
    }
  }
}
