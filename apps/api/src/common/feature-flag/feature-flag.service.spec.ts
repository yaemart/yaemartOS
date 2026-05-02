import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureFlagService } from './feature-flag.service';
import { ConfigService } from '@nestjs/config';
import { PrismaClientManager } from '../../database/prisma.service';

function makeService(envMap: Record<string, string>): FeatureFlagService {
  const config = {
    get: vi.fn((key: string) => envMap[key]),
  } as unknown as ConfigService;

  const prismaManager = {
    getPublicClient: () => ({
      systemConfig: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    }),
  } as unknown as PrismaClientManager;

  return new FeatureFlagService(config, prismaManager);
}

describe('FeatureFlagService', () => {
  describe('global flags only (env, no DB override)', () => {
    it('returns true when FEATURE_{FLAG}=true', async () => {
      const svc = makeService({ FEATURE_LISTING_AI: 'true' });
      expect(await svc.isEnabled('LISTING_AI')).toBe(true);
    });

    it('returns false when FEATURE_{FLAG}=false', async () => {
      const svc = makeService({ FEATURE_LISTING_AI: 'false' });
      expect(await svc.isEnabled('LISTING_AI')).toBe(false);
    });

    it('returns false when flag is not set (default-closed)', async () => {
      const svc = makeService({});
      expect(await svc.isEnabled('LISTING_AI')).toBe(false);
    });
  });

  describe('brand-scoped flags', () => {
    it('returns true when brand-level flag is true, even if global is false', async () => {
      const svc = makeService({
        FEATURE_LISTING_AI: 'false',
        FEATURE_LISTING_AI_HOMTONE: 'true',
      });
      expect(await svc.isEnabled('LISTING_AI', 'homtone')).toBe(true);
    });

    it('returns false when brand-level flag is false, even if global is true', async () => {
      const svc = makeService({
        FEATURE_LISTING_AI: 'true',
        FEATURE_LISTING_AI_HOMTONE: 'false',
      });
      expect(await svc.isEnabled('LISTING_AI', 'homtone')).toBe(false);
    });

    it('falls back to global flag when brand-level is not set', async () => {
      const svc = makeService({ FEATURE_LISTING_AI: 'true' });
      expect(await svc.isEnabled('LISTING_AI', 'spoonlemon')).toBe(true);
    });

    it('returns false when neither brand nor global flag is set', async () => {
      const svc = makeService({});
      expect(await svc.isEnabled('LISTING_AI', 'homtone')).toBe(false);
    });

    it('brand key is case-insensitive (uppercases brandId)', async () => {
      const svc = makeService({ FEATURE_LISTING_AI_HOMTONE: 'true' });
      expect(await svc.isEnabled('LISTING_AI', 'Homtone')).toBe(true);
    });

    it('flag name is case-insensitive (uppercases flag)', async () => {
      const svc = makeService({ FEATURE_LISTING_AI: 'true' });
      expect(await svc.isEnabled('listing_ai')).toBe(true);
    });
  });

  describe('isEnabledSync (env-only, no DB)', () => {
    it('returns true synchronously for set env flags', () => {
      const svc = makeService({ FEATURE_LISTING_AI: 'true' });
      expect(svc.isEnabledSync('LISTING_AI')).toBe(true);
    });

    it('returns false when flag not set', () => {
      const svc = makeService({});
      expect(svc.isEnabledSync('LISTING_AI')).toBe(false);
    });
  });

  describe('when brandId is undefined', () => {
    it('only checks global flag when brandId is undefined', async () => {
      const svc = makeService({
        FEATURE_LISTING_AI: 'true',
        FEATURE_LISTING_AI_HOMTONE: 'false',
      });
      expect(await svc.isEnabled('LISTING_AI', undefined)).toBe(true);
    });
  });
});
