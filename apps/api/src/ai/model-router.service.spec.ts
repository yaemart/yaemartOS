import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ModelRouterService } from './model-router.service';

function makeRouter(envMap: Record<string, string> = {}): ModelRouterService {
  const configService = {
    get: vi.fn().mockImplementation((key: string) => envMap[key] ?? undefined),
  } as unknown as ConfigService;
  return new ModelRouterService(configService);
}

describe('ModelRouterService', () => {
  describe('default routing table', () => {
    let router: ModelRouterService;
    beforeEach(() => {
      router = makeRouter();
    });

    it('routes faq/* to glm', () => {
      expect(router.getProviderType('faq', 'en')).toBe('glm');
      expect(router.getProviderType('faq', 'zh')).toBe('glm');
    });

    it('routes recipe/* to glm', () => {
      expect(router.getProviderType('recipe', 'en')).toBe('glm');
    });

    it('routes listing/en to gemini', () => {
      expect(router.getProviderType('listing', 'en')).toBe('gemini');
    });

    it('routes listing/zh to gemini (default until S3)', () => {
      expect(router.getProviderType('listing', 'zh')).toBe('gemini');
    });

    it('routes extraction/* to gemini', () => {
      expect(router.getProviderType('extraction', 'en')).toBe('gemini');
    });
  });

  describe('env var overrides (locale-specific)', () => {
    it('overrides faq/en → gemini when AI_TASK_ROUTER_FAQ_EN=gemini', () => {
      const router = makeRouter({ AI_TASK_ROUTER_FAQ_EN: 'gemini' });
      expect(router.getProviderType('faq', 'en')).toBe('gemini');
    });

    it('overrides listing/zh → glm when AI_TASK_ROUTER_LISTING_ZH=glm', () => {
      const router = makeRouter({ AI_TASK_ROUTER_LISTING_ZH: 'glm' });
      expect(router.getProviderType('listing', 'zh')).toBe('glm');
    });
  });

  describe('env var overrides (task-level)', () => {
    it('overrides all listing tasks → glm when AI_TASK_ROUTER_LISTING=glm', () => {
      const router = makeRouter({ AI_TASK_ROUTER_LISTING: 'glm' });
      expect(router.getProviderType('listing', 'en')).toBe('glm');
      expect(router.getProviderType('listing', 'de')).toBe('glm');
    });

    it('locale-specific override takes precedence over task-level override', () => {
      const router = makeRouter({
        AI_TASK_ROUTER_LISTING: 'glm',
        AI_TASK_ROUTER_LISTING_EN: 'gemini',
      });
      expect(router.getProviderType('listing', 'en')).toBe('gemini');
      expect(router.getProviderType('listing', 'de')).toBe('glm');
    });
  });

  describe('invalid override values', () => {
    it('ignores unknown override values and falls back to default', () => {
      const router = makeRouter({ AI_TASK_ROUTER_FAQ_EN: 'gpt-4' });
      expect(router.getProviderType('faq', 'en')).toBe('glm');
    });
  });
});
