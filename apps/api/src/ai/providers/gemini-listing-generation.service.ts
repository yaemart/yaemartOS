import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import type { GenerateListingInput, ListingContent, Platform } from '@yaemartos/shared-types';
import { assembleAmazonEnPrompt } from '../../listing/prompts/assemble-listing-prompt';
import { assembleWalmartEnPrompt } from '../../listing/prompts/assemble-walmart-en-prompt';
import { amazonEnRules } from '../../listing/rules/amazon-en-limits';
import { walmartEnRules } from '../../listing/rules/walmart-en-limits';
import type { PlatformListingRules } from '../../listing/rules/platform-listing-rules.interface';
import { validateListingContent } from '../../listing/rules/validate-listing-content';
import type { IListingGenerationService } from '../interfaces/listing-generation.interface';
import { CostTrackingService } from '../cost-tracking.service';

/** Error thrown when `generateListing` is called for an unsupported platform. */
export class UnsupportedPlatformError extends Error {
  constructor(platform: string) {
    super(`Listing generation is not supported for platform: ${platform}`);
    this.name = 'UnsupportedPlatformError';
  }
}

interface PlatformContext {
  rules: PlatformListingRules;
  schema: z.ZodType<ListingContent>;
  assemblePrompt: (input: GenerateListingInput) => string;
}

/** Builds a Zod schema from platform rules so limits are validated at parse time. */
function buildListingSchema(rules: PlatformListingRules): z.ZodType<ListingContent> {
  return z.object({
    title: z.string().max(rules.titleMaxChars),
    bullets: z.array(z.string().max(rules.bulletMaxChars)).max(rules.bulletsMaxCount),
    description: z.string().max(rules.descriptionMaxChars),
    aPlus:
      rules.aPlusMaxChars !== undefined
        ? z.string().max(rules.aPlusMaxChars).optional()
        : z.string().optional(),
    searchTerms: z.array(z.string()),
  }) as z.ZodType<ListingContent>;
}

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
    const ctx = this.buildPlatformContext(input.platform);

    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY missing — returning mock listing content');
      return this.mockContent(input, ctx.rules);
    }

    const modelId = this.config.get<string>('GEMINI_PRO_MODEL') ?? 'gemini-2.5-pro';
    const google = createGoogleGenerativeAI({ apiKey });

    const prompt = ctx.assemblePrompt(input);
    this.logger.log(
      `Generating listing for product="${input.productTitle}" platform=${input.platform} model=${modelId}`,
    );

    const start = Date.now();
    const { object, usage } = await generateObject({
      model: google(modelId),
      schema: ctx.schema,
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

    const validation = validateListingContent(content, ctx.rules);
    if (!validation.valid) {
      const summary = validation.violations.map((v) => `${v.field}: ${v.message}`).join('; ');
      this.logger.warn(`Generated listing failed character validation: ${summary}`);
      throw new Error(
        `AI output violates ${ctx.rules.platformCode.toUpperCase()} EN character rules: ${summary}`,
      );
    }

    this.logger.log(`Listing generated successfully for product="${input.productTitle}"`);
    return content;
  }

  /** Returns the rules, Zod schema, and prompt assembler for the given platform. */
  private buildPlatformContext(platform: Platform): PlatformContext {
    switch (platform) {
      case 'amazon':
        return {
          rules: amazonEnRules,
          schema: buildListingSchema(amazonEnRules),
          assemblePrompt: assembleAmazonEnPrompt,
        };
      case 'walmart':
        return {
          rules: walmartEnRules,
          schema: buildListingSchema(walmartEnRules),
          assemblePrompt: assembleWalmartEnPrompt,
        };
      default:
        throw new UnsupportedPlatformError(platform);
    }
  }

  private mockContent(input: GenerateListingInput, rules: PlatformListingRules): ListingContent {
    const bulletCount = Math.min(5, rules.bulletsMaxCount);
    const bulletText = [
      'Premium Quality — Built with high-grade materials for lasting durability',
      'Easy to Use — Intuitive design requires no technical knowledge',
      'Versatile Performance — Suitable for a wide range of applications',
      'Compact Design — Space-saving form factor fits any environment',
      'Reliable Support — Backed by our responsive customer service team',
    ];

    return {
      title: `${input.brandId} ${input.productTitle}`.slice(0, rules.titleMaxChars),
      bullets: bulletText.slice(0, bulletCount),
      description:
        `Introducing the ${input.productTitle} from ${input.brandId}. Designed with quality and convenience in mind, this product delivers outstanding performance for everyday use.`.slice(
          0,
          rules.descriptionMaxChars,
        ),
      searchTerms: (input.keywords ?? []).slice(0, 5),
    };
  }
}
