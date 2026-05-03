import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PrismaClientManager } from '../database/prisma.service';
import { ModelRouterService } from './model-router.service';

function makeRouter(envMap: Record<string, string> = {}): ModelRouterService {
  const configService = {
    get: vi.fn().mockImplementation((key: string) => envMap[key] ?? undefined),
  } as unknown as ConfigService;

  const prismaManager = {
    getPublicClient: () => ({
      systemConfig: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    }),
  } as unknown as PrismaClientManager;

  return new ModelRouterService(configService, prismaManager);
}

describe('ModelRouterService', () => {
  describe('default routing table (env-only, no DB overrides)', () => {
    let router: ModelRouterService;
    beforeEach(() => {
      router = makeRouter();
    });

    it('routes faq/* to glm', async () => {
      expect(await router.getProviderType('faq', 'en')).toBe('glm');
      expect(await router.getProviderType('faq', 'zh')).toBe('glm');
    });

    it('routes recipe/* to glm', async () => {
      expect(await router.getProviderType('recipe', 'en')).toBe('glm');
    });

    it('routes listing/en to gemini', async () => {
      expect(await router.getProviderType('listing', 'en')).toBe('gemini');
    });

    it('routes listing/zh to gemini (default until S3)', async () => {
      expect(await router.getProviderType('listing', 'zh')).toBe('gemini');
    });

    it('routes extraction/* to gemini', async () => {
      expect(await router.getProviderType('extraction', 'en')).toBe('gemini');
    });
  });

  describe('env var overrides (locale-specific)', () => {
    it('overrides faq/en → gemini when AI_TASK_ROUTER_FAQ_EN=gemini', async () => {
      const router = makeRouter({ AI_TASK_ROUTER_FAQ_EN: 'gemini' });
      expect(await router.getProviderType('faq', 'en')).toBe('gemini');
    });

    it('overrides listing/zh → glm when AI_TASK_ROUTER_LISTING_ZH=glm', async () => {
      const router = makeRouter({ AI_TASK_ROUTER_LISTING_ZH: 'glm' });
      expect(await router.getProviderType('listing', 'zh')).toBe('glm');
    });
  });

  describe('env var overrides (task-level)', () => {
    it('overrides all listing tasks → glm when AI_TASK_ROUTER_LISTING=glm', async () => {
      const router = makeRouter({ AI_TASK_ROUTER_LISTING: 'glm' });
      expect(await router.getProviderType('listing', 'en')).toBe('glm');
      expect(await router.getProviderType('listing', 'de')).toBe('glm');
    });

    it('locale-specific override takes precedence over task-level override', async () => {
      const router = makeRouter({
        AI_TASK_ROUTER_LISTING: 'glm',
        AI_TASK_ROUTER_LISTING_EN: 'gemini',
      });
      expect(await router.getProviderType('listing', 'en')).toBe('gemini');
      expect(await router.getProviderType('listing', 'de')).toBe('glm');
    });
  });

  describe('sync fallback', () => {
    it('getProviderTypeSync uses env only and returns correct default', () => {
      const router = makeRouter({ AI_TASK_ROUTER_FAQ_EN: 'gemini' });
      expect(router.getProviderTypeSync('faq', 'en')).toBe('gemini');
      expect(router.getProviderTypeSync('listing', 'en')).toBe('gemini');
    });
  });

  describe('invalid override values', () => {
    it('ignores unknown override values and falls back to default', async () => {
      const router = makeRouter({ AI_TASK_ROUTER_FAQ_EN: 'gpt-4' });
      expect(await router.getProviderType('faq', 'en')).toBe('glm');
    });
  });
});
