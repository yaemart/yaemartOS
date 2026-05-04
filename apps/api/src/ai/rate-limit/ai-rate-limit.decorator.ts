import { SetMetadata } from '@nestjs/common';

export const AI_RATE_LIMIT_KEY = 'ai-rate-limit';

export interface AiRateLimitOptions {
  /** Model slug used as part of the bucket key (e.g. 'glm-4-flash', 'gemini-2.5-flash'). */
  model: string;
  /** Maximum requests allowed per window per brand. */
  requestsPerMinute: number;
}

/**
 * Mark a controller route as rate-limited per (model × brand) sliding window.
 *
 * The accompanying `AiRateLimitGuard` reads this metadata to enforce a Redis-backed
 * sliding-window counter keyed by `${model}:${brandId}`. If the brand is not yet
 * resolved on the request, the guard falls back to per-user limits.
 */
export const AiRateLimit = (options: AiRateLimitOptions) => SetMetadata(AI_RATE_LIMIT_KEY, options);
