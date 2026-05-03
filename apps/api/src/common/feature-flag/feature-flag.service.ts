import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClientManager } from '../../database/prisma.service';

export interface FeatureFlagContext {
  brand?: string;
  market?: string;
  language?: string;
}

/**
 * Feature flag resolution with brand × market × language granularity.
 *
 * Priority (highest → lowest):
 *   DB  1. feature_flag.{FLAG}.{brand}.{market}.{language}  — most specific
 *   DB  2. feature_flag.{FLAG}.{brand}.{market}
 *   DB  3. feature_flag.{FLAG}.{brand}
 *   DB  4. feature_flag.{FLAG}                              — global DB
 *   Env 5. FEATURE_{FLAG}_{BRAND}_{MARKET}_{LANGUAGE}
 *   Env 6. FEATURE_{FLAG}_{BRAND}_{MARKET}
 *   Env 7. FEATURE_{FLAG}_{BRAND}
 *   Env 8. FEATURE_{FLAG}                                   — global env
 *       9. false                                            — closed by default
 *
 * DB values take precedence over env vars, enabling runtime configuration
 * via the Settings UI without requiring a redeploy.
 *
 * The legacy signature `isEnabled(flag, brandId?)` is preserved for backward
 * compatibility — it maps to `isEnabled(flag, { brand: brandId })`.
 */
@Injectable()
export class FeatureFlagService {
  constructor(
    private readonly config: ConfigService,
    private readonly prismaManager: PrismaClientManager,
  ) {}

  async isEnabled(flag: string, brandOrCtx?: string | FeatureFlagContext): Promise<boolean> {
    const ctx: FeatureFlagContext =
      typeof brandOrCtx === 'string' ? { brand: brandOrCtx } : (brandOrCtx ?? {});
    const upperFlag = flag.toUpperCase();
    const brand = ctx.brand?.toLowerCase();
    const market = ctx.market?.toLowerCase();
    const language = ctx.language?.toLowerCase();

    // DB lookups from most to least specific
    const dbKeys: string[] = [];
    if (brand && market && language) {
      dbKeys.push(`feature_flag.${upperFlag}.${brand}.${market}.${language}`);
    }
    if (brand && market) {
      dbKeys.push(`feature_flag.${upperFlag}.${brand}.${market}`);
    }
    if (brand) {
      dbKeys.push(`feature_flag.${upperFlag}.${brand}`);
    }
    dbKeys.push(`feature_flag.${upperFlag}`);

    for (const key of dbKeys) {
      const val = await this.getDbValue(key);
      if (val !== null) {
        return val === 'true';
      }
    }

    // Env lookups from most to least specific
    const envKeys: string[] = [];
    const B = brand?.toUpperCase() ?? '';
    const M = market?.toUpperCase() ?? '';
    const L = language?.toUpperCase() ?? '';
    if (B && M && L) {
      envKeys.push(`FEATURE_${upperFlag}_${B}_${M}_${L}`);
    }
    if (B && M) {
      envKeys.push(`FEATURE_${upperFlag}_${B}_${M}`);
    }
    if (B) {
      envKeys.push(`FEATURE_${upperFlag}_${B}`);
    }
    envKeys.push(`FEATURE_${upperFlag}`);

    for (const key of envKeys) {
      const val = this.config.get<string>(key);
      if (val !== undefined) {
        return val === 'true';
      }
    }

    return false;
  }

  /** Synchronous check using only env vars (for performance-critical hot paths). */
  isEnabledSync(flag: string, brandOrCtx?: string | FeatureFlagContext): boolean {
    const ctx: FeatureFlagContext =
      typeof brandOrCtx === 'string' ? { brand: brandOrCtx } : (brandOrCtx ?? {});
    const upperFlag = flag.toUpperCase();
    const B = ctx.brand?.toUpperCase() ?? '';
    const M = ctx.market?.toUpperCase() ?? '';
    const L = ctx.language?.toUpperCase() ?? '';

    const envKeys: string[] = [];
    if (B && M && L) {
      envKeys.push(`FEATURE_${upperFlag}_${B}_${M}_${L}`);
    }
    if (B && M) {
      envKeys.push(`FEATURE_${upperFlag}_${B}_${M}`);
    }
    if (B) {
      envKeys.push(`FEATURE_${upperFlag}_${B}`);
    }
    envKeys.push(`FEATURE_${upperFlag}`);

    for (const key of envKeys) {
      const val = this.config.get<string>(key);
      if (val !== undefined) {
        return val === 'true';
      }
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
