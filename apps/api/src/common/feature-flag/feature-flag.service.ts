import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Feature flag resolution with brand-level granularity.
 *
 * Priority (highest to lowest):
 *   1. FEATURE_{FLAG}_{BRAND_ID_UPPER}  — brand-scoped override
 *   2. FEATURE_{FLAG}                   — global default
 *   3. false                            — closed by default (safe fallback)
 *
 * Example env vars:
 *   FEATURE_LISTING_AI=false
 *   FEATURE_LISTING_AI_HOMTONE=true   ← enables only for Homtone brand
 *
 * Convention: flag names use UPPER_SNAKE_CASE without the FEATURE_ prefix.
 * Brand IDs match the BrandId union type values (homtone, spoonlemon, etc.).
 */
@Injectable()
export class FeatureFlagService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Returns true when the flag is enabled for the given brand (or globally
   * when no brandId is supplied).
   *
   * @param flag  Flag name without the FEATURE_ prefix, e.g. 'LISTING_AI'
   * @param brandId  Optional brand scope, e.g. 'homtone'. When provided the
   *                 brand-level override takes precedence over the global flag.
   */
  isEnabled(flag: string, brandId?: string): boolean {
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
}
