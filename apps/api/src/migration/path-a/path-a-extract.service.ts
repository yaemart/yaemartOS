import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import {
  pathAExtractionInputSchema,
  pathAExtractionModelOutputSchema,
  pathAExtractionResultSchema,
} from './schema';
import type { PathAExtractionInput, PathAExtractionResult } from './types';
import { buildPathAExtractionPrompt } from './prompt';

@Injectable()
export class PathAExtractService {
  private readonly logger = new Logger(PathAExtractService.name);

  constructor(private readonly config: ConfigService) {}

  async extract(input: PathAExtractionInput): Promise<PathAExtractionResult> {
    const parsedInput = pathAExtractionInputSchema.parse(input);
    const prompt = buildPathAExtractionPrompt(parsedInput.rawListing);
    const modelOutput = await this.generateFromModel(prompt);

    return pathAExtractionResultSchema.parse({
      runId: parsedInput.runId,
      sourceRecordId: parsedInput.sourceRecordId,
      ...modelOutput,
    });
  }

  protected async generateFromModel(prompt: string) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY missing for PathAExtractService');
    }

    const modelId = this.config.get<string>('GEMINI_FLASH_MODEL') ?? 'gemini-2.5-flash';
    const google = createGoogleGenerativeAI({ apiKey });
    const result = await generateText({
      model: google(modelId),
      prompt,
    });

    return this.parseModelJson(result.text);
  }

  private parseModelJson(text: string) {
    const jsonPayload = this.extractJsonObject(text);
    if (!jsonPayload) {
      this.logger.error('Path A extraction returned non-JSON payload');
      throw new Error('Path A extraction model output is not valid JSON');
    }

    try {
      const parsed = JSON.parse(jsonPayload);
      return pathAExtractionModelOutputSchema.parse(parsed);
    } catch (error) {
      this.logger.error('Path A extraction JSON parse/validation failed');
      throw error;
    }
  }

  private extractJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || start >= end) {
      return null;
    }
    return text.slice(start, end + 1);
  }
}
