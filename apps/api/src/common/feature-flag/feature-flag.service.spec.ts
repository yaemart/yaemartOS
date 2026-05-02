import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureFlagService } from './feature-flag.service';
import { ConfigService } from '@nestjs/config';

function makeService(envMap: Record<string, string>): FeatureFlagService {
  const config = {
    get: vi.fn((key: string) => envMap[key]),
  } as unknown as ConfigService;
  return new FeatureFlagService(config);
}

describe('FeatureFlagService', () => {
  describe('global flags only', () => {
    it('returns true when FEATURE_{FLAG}=true', () => {
      const svc = makeService({ FEATURE_LISTING_AI: 'true' });
      expect(svc.isEnabled('LISTING_AI')).toBe(true);
    });

    it('returns false when FEATURE_{FLAG}=false', () => {
      const svc = makeService({ FEATURE_LISTING_AI: 'false' });
      expect(svc.isEnabled('LISTING_AI')).toBe(false);
    });

    it('returns false when flag is not set (default-closed)', () => {
      const svc = makeService({});
      expect(svc.isEnabled('LISTING_AI')).toBe(false);
    });
  });

  describe('brand-scoped flags', () => {
    it('returns true when brand-level flag is true, even if global is false', () => {
      const svc = makeService({
        FEATURE_LISTING_AI: 'false',
        FEATURE_LISTING_AI_HOMTONE: 'true',
      });
      expect(svc.isEnabled('LISTING_AI', 'homtone')).toBe(true);
    });

    it('returns false when brand-level flag is false, even if global is true', () => {
      const svc = makeService({
        FEATURE_LISTING_AI: 'true',
        FEATURE_LISTING_AI_HOMTONE: 'false',
      });
      expect(svc.isEnabled('LISTING_AI', 'homtone')).toBe(false);
    });

    it('falls back to global flag when brand-level is not set', () => {
      const svc = makeService({ FEATURE_LISTING_AI: 'true' });
      expect(svc.isEnabled('LISTING_AI', 'spoonlemon')).toBe(true);
    });

    it('returns false when neither brand nor global flag is set', () => {
      const svc = makeService({});
      expect(svc.isEnabled('LISTING_AI', 'homtone')).toBe(false);
    });

    it('brand key is case-insensitive (uppercases brandId)', () => {
      const svc = makeService({ FEATURE_LISTING_AI_HOMTONE: 'true' });
      expect(svc.isEnabled('LISTING_AI', 'Homtone')).toBe(true);
    });

    it('flag name is case-insensitive (uppercases flag)', () => {
      const svc = makeService({ FEATURE_LISTING_AI: 'true' });
      expect(svc.isEnabled('listing_ai')).toBe(true);
    });
  });

  describe('when brandId is undefined', () => {
    it('only checks global flag when brandId is undefined', () => {
      const svc = makeService({
        FEATURE_LISTING_AI: 'true',
        FEATURE_LISTING_AI_HOMTONE: 'false',
      });
      expect(svc.isEnabled('LISTING_AI', undefined)).toBe(true);
    });
  });
});
