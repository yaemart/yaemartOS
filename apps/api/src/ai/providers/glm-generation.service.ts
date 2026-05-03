import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GLM_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';

@Injectable()
export class GlmGenerationService {
  private readonly logger = new Logger(GlmGenerationService.name);

  constructor(private readonly config: ConfigService) {}

  async helloWorld(): Promise<string> {
    const apiKey = this.config.get<string>('ZHIPU_API_KEY');
    if (!apiKey) {
      this.logger.warn('ZHIPU_API_KEY missing — skipping live GLM call');
      return 'Hello yaemartOS (mock — set ZHIPU_API_KEY)';
    }

    return this.generateText('Reply with exactly one line: Hello yaemartOS');
  }

  async generateText(prompt: string): Promise<string> {
    return this.chat([{ role: 'user', content: prompt }]);
  }

  /**
   * Calls GLM with `response_format: { type: 'json_object' }` and returns the
   * parsed JSON. The caller is responsible for validating the schema.
   */
  async generateJson<T = unknown>(systemPrompt: string, userPrompt: string): Promise<T> {
    const apiKey = this.config.get<string>('ZHIPU_API_KEY');
    if (!apiKey) {
      this.logger.warn('ZHIPU_API_KEY missing — returning mock JSON response');
      return {} as T;
    }

    const modelId = this.config.get<string>('GLM_MODEL') ?? 'glm-4-flash';
    const ac = new AbortController();
    const timeoutHandle = setTimeout(() => ac.abort(), 30_000);

    let res: globalThis.Response;
    try {
      res = await fetch(`${GLM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.5,
          response_format: { type: 'json_object' },
        }),
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GLM API error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    const raw = data.choices[0]?.message?.content?.trim() ?? '{}';
    return JSON.parse(raw) as T;
  }

  private async chat(messages: { role: string; content: string }[]): Promise<string> {
    const apiKey = this.config.get<string>('ZHIPU_API_KEY');
    if (!apiKey) {
      this.logger.warn('ZHIPU_API_KEY missing — returning mock generateText response');
      return `Mock GLM response`;
    }

    const modelId = this.config.get<string>('GLM_MODEL') ?? 'glm-4-flash';
    this.logger.log(`Generating text with GLM model=${modelId}`);

    const ac = new AbortController();
    const timeoutHandle = setTimeout(() => ac.abort(), 30_000);

    let res: globalThis.Response;
    try {
      res = await fetch(`${GLM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: modelId, messages, temperature: 0.7 }),
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GLM API error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content?.trim() ?? '';
  }
}
