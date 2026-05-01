import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import type { GenerateListingInput, ListingContent } from '@yaemartos/shared-types';
import { assembleAmazonEnPrompt } from '../../listing/prompts/assemble-listing-prompt';
import { AMAZON_EN_LIMITS } from '../../listing/rules/amazon-en-limits';
import { validateListingContent } from '../../listing/rules/validate-listing-content';
import type { IListingGenerationService } from '../interfaces/listing-generation.interface';
import { CostTrackingService } from '../cost-tracking.service';

const ListingContentSchema = z.object({
  title: z.string().max(AMAZON_EN_LIMITS.TITLE_MAX_CHARS),
  bullets: z.array(z.string().max(AMAZON_EN_LIMITS.BULLET_MAX_CHARS)).length(5),
  description: z.string().max(AMAZON_EN_LIMITS.DESCRIPTION_MAX_CHARS),
  aPlus: z.string().max(AMAZON_EN_LIMITS.APLUS_MAX_CHARS).optional(),
  searchTerms: z.array(z.string()),
});

@Injectable()
export class GeminiListingGenerationService implements IListingGenerationService {
  private readonly logger = new Logger(GeminiListingGenerationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly costTracking: CostTrackingService,
  ) {}

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

  async generateListing(input: GenerateListingInput): Promise<ListingContent> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY missing — returning mock listing content');
      return this.mockContent(input);
    }

    const modelId = this.config.get<string>('GEMINI_PRO_MODEL') ?? 'gemini-2.5-pro';
    const google = createGoogleGenerativeAI({ apiKey });

    const prompt = assembleAmazonEnPrompt(input);
    this.logger.log(`Generating listing for product="${input.productTitle}" model=${modelId}`);

    const start = Date.now();
    const { object, usage } = await generateObject({
      model: google(modelId),
      schema: ListingContentSchema,
      prompt,
    });
    const durationMs = Date.now() - start;

    void this.costTracking.record({
      model: modelId,
      taskType: 'listing',
      brandId: input.brandId,
      promptTokens: usage?.promptTokens ?? 0,
      completionTokens: usage?.completionTokens ?? 0,
      durationMs,
    });

    const content = object as ListingContent;

    const validation = validateListingContent(content);
    if (!validation.valid) {
      const summary = validation.violations.map((v) => `${v.field}: ${v.message}`).join('; ');
      this.logger.warn(`Generated listing failed character validation: ${summary}`);
      throw new Error(`AI output violates Amazon EN character rules: ${summary}`);
    }

    this.logger.log(`Listing generated successfully for product="${input.productTitle}"`);
    return content;
  }

  private mockContent(input: GenerateListingInput): ListingContent {
    return {
      title: `${input.brandId} ${input.productTitle}`.slice(0, AMAZON_EN_LIMITS.TITLE_MAX_CHARS),
      bullets: [
        'Premium Quality — Built with high-grade materials for lasting durability',
        'Easy to Use — Intuitive design requires no technical knowledge',
        'Versatile Performance — Suitable for a wide range of applications',
        'Compact Design — Space-saving form factor fits any environment',
        'Reliable Support — Backed by our responsive customer service team',
      ],
      description: `Introducing the ${input.productTitle} from ${input.brandId}. Designed with quality and convenience in mind, this product delivers outstanding performance for everyday use.`,
      searchTerms: (input.keywords ?? []).slice(0, 5),
    };
  }
}
