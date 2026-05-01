import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { GenerateListingInput, ListingContent } from '@yaemartos/shared-types';
import type { IListingGenerationService } from '../interfaces/listing-generation.interface';

@Injectable()
export class GeminiListingGenerationService implements IListingGenerationService {
  private readonly logger = new Logger(GeminiListingGenerationService.name);

  constructor(private readonly config: ConfigService) {}

  async helloWorld(): Promise<string> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY missing — skipping live Gemini call');
      return 'Hello yaemartOS (mock — set GEMINI_API_KEY)';
    }

    const modelId = this.config.get<string>('GEMINI_FLASH_MODEL') ?? 'gemini-2.0-flash';

    const google = createGoogleGenerativeAI({ apiKey });

    const result = await generateText({
      model: google(modelId),
      prompt: 'Reply with exactly one line: Hello yaemartOS',
    });

    return result.text.trim();
  }

  async generateListing(_input: GenerateListingInput): Promise<ListingContent> {
    throw new NotImplementedException('generateListing is implemented in S1 W9+');
  }
}
