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

  describe('three-dimensional context (brand × market × language)', () => {
    it('brand+market+language env key wins over brand+market', async () => {
      const svc = makeService({
        FEATURE_WARRANTY_REGISTRATION_HOMTONE_US: 'false',
        FEATURE_WARRANTY_REGISTRATION_HOMTONE_US_EN: 'true',
      });
      expect(
        await svc.isEnabled('WARRANTY_REGISTRATION', {
          brand: 'homtone',
          market: 'us',
          language: 'en',
        }),
      ).toBe(true);
    });

    it('brand+market env key wins over brand-only when language not provided', async () => {
      const svc = makeService({
        FEATURE_WARRANTY_REGISTRATION_HOMTONE: 'false',
        FEATURE_WARRANTY_REGISTRATION_HOMTONE_US: 'true',
      });
      expect(await svc.isEnabled('WARRANTY_REGISTRATION', { brand: 'homtone', market: 'us' })).toBe(
        true,
      );
    });

    it('falls back through brand → global when market/language not set', async () => {
      const svc = makeService({
        FEATURE_WARRANTY_REGISTRATION: 'true',
      });
      expect(await svc.isEnabled('WARRANTY_REGISTRATION', { brand: 'homtone' })).toBe(true);
    });

    it('legacy string signature maps to brand-only context (backward compat)', async () => {
      const svc = makeService({ FEATURE_LISTING_AI_HOMTONE: 'true' });
      expect(await svc.isEnabled('LISTING_AI', 'homtone')).toBe(true);
    });

    it('context object with no keys behaves like global lookup', async () => {
      const svc = makeService({ FEATURE_ORDER_LOOKUP: 'true' });
      expect(await svc.isEnabled('ORDER_LOOKUP', {})).toBe(true);
    });

    it('returns false when no matching key at any dimension', async () => {
      const svc = makeService({});
      expect(
        await svc.isEnabled('MANUAL_DOWNLOAD', { brand: 'davivy', market: 'uk', language: 'en' }),
      ).toBe(false);
    });

    describe('isEnabledSync three-dimensional', () => {
      it('checks brand+market+language env key', () => {
        const svc = makeService({ FEATURE_MANUAL_DOWNLOAD_HOMTONE_US_ES: 'true' });
        expect(
          svc.isEnabledSync('MANUAL_DOWNLOAD', { brand: 'homtone', market: 'us', language: 'es' }),
        ).toBe(true);
      });

      it('falls back to brand-only when market/language missing', () => {
        const svc = makeService({ FEATURE_MANUAL_DOWNLOAD_SPOONLEMON: 'true' });
        expect(svc.isEnabledSync('MANUAL_DOWNLOAD', { brand: 'spoonlemon' })).toBe(true);
      });
    });
  });
});
