import { Injectable, Logger } from '@nestjs/common';
import { PrismaClientManager } from '../database/prisma.service';

/**
 * AI pricing constants (USD per 1K tokens).
 * Updated quarterly from provider pricing pages.
 * Values are approximate and for trend analysis only.
 */
const PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-2.0-flash': { input: 0.000075, output: 0.0003 },
  'glm-4-flash': { input: 0.0001, output: 0.0001 },
};

const DEFAULT_PRICING = { input: 0.001, output: 0.002 };

export type AiCallLogInput = {
  model: string;
  taskType: string;
  brandId?: string;
  marketId?: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
};

@Injectable()
export class CostTrackingService {
  private readonly logger = new Logger(CostTrackingService.name);

  constructor(private readonly prismaManager: PrismaClientManager) {}

  async record(input: AiCallLogInput): Promise<void> {
    try {
      const pricing = PRICING[input.model] ?? DEFAULT_PRICING;
      const estimatedCostUsd =
        (input.promptTokens / 1000) * pricing.input +
        (input.completionTokens / 1000) * pricing.output;

      const prisma = this.prismaManager.getPublicClient() as any;
      await prisma.aiCallLog.create({
        data: {
          model: input.model,
          taskType: input.taskType,
          brandId: input.brandId,
          marketId: input.marketId,
          promptTokens: input.promptTokens,
          completionTokens: input.completionTokens,
          estimatedCostUsd,
          durationMs: input.durationMs,
        },
      });
    } catch (err) {
      this.logger.warn(`AI cost tracking write failed (best-effort): ${String(err)}`);
    }
  }
}
