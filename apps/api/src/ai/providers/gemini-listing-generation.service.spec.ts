import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiListingGenerationService } from './gemini-listing-generation.service';

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'Hello yaemartOS' }),
}));

describe('GeminiListingGenerationService', () => {
  let service: GeminiListingGenerationService;

  beforeEach(() => {
    const config = new ConfigService({
      GEMINI_API_KEY: 'test-key',
      GEMINI_FLASH_MODEL: 'gemini-2.0-flash',
    });
    service = new GeminiListingGenerationService(config);
  });

  it('helloWorld returns text containing yaemartOS', async () => {
    const text = await service.helloWorld();
    expect(text).toContain('yaemartOS');
  });

  it('generateListing throws NotImplementedException', async () => {
    await expect(
      service.generateListing({
        brandId: 'homtone',
        platform: 'amazon',
        productTitle: 'x',
        productCategory: 'y',
        targetLocale: 'en',
      }),
    ).rejects.toThrow(NotImplementedException);
  });
});
