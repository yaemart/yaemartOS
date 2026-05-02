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
    const apiKey = this.config.get<string>('ZHIPU_API_KEY');
    if (!apiKey) {
      this.logger.warn('ZHIPU_API_KEY missing — returning mock generateText response');
      return `Mock GLM response for: ${prompt}`;
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
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
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

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };

    return data.choices[0]?.message?.content?.trim() ?? '';
  }
}
