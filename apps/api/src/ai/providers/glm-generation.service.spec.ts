import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { GlmGenerationService } from './glm-generation.service';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GlmGenerationService', () => {
  let service: GlmGenerationService;

  describe('when ZHIPU_API_KEY is missing', () => {
    beforeEach(() => {
      const configService = {
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as ConfigService;
      service = new GlmGenerationService(configService);
      mockFetch.mockClear();
    });

    it('helloWorld() returns mock string without throwing', async () => {
      const result = await service.helloWorld();
      expect(result).toBe('Hello yaemartOS (mock — set ZHIPU_API_KEY)');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('generateText() returns mock string without throwing', async () => {
      const result = await service.generateText('test prompt');
      expect(result).toContain('Mock GLM response');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('when ZHIPU_API_KEY is set', () => {
    beforeEach(() => {
      const configService = {
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'ZHIPU_API_KEY') {
            return 'test-key';
          }
          if (key === 'GLM_MODEL') {
            return 'glm-4-flash';
          }
          return undefined;
        }),
      } as unknown as ConfigService;
      service = new GlmGenerationService(configService);
      mockFetch.mockReset();
    });

    it('generateText() calls GLM API and returns content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '  Hello yaemartOS  ' } }],
        }),
      });

      const result = await service.generateText('Hello?');
      expect(result).toBe('Hello yaemartOS');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/completions'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
        }),
      );
    });

    it('helloWorld() calls generateText with hello prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello yaemartOS' } }],
        }),
      });

      const result = await service.helloWorld();
      expect(result).toBe('Hello yaemartOS');
    });

    it('generateText() throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(service.generateText('prompt')).rejects.toThrow('GLM API error 401');
    });
  });

  it('service instantiates without error', () => {
    const configService = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    expect(() => new GlmGenerationService(configService)).not.toThrow();
  });
});
