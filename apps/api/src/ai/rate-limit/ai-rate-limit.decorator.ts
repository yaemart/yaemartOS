import { SetMetadata } from '@nestjs/common';

export const AI_RATE_LIMIT_KEY = 'ai-rate-limit';

export interface AiRateLimitOptions {
  /** Model slug used as part of the bucket key (e.g. 'glm-4-flash', 'gemini-2.5-flash'). */
  model: string;
  /** Maximum requests allowed per window per brand. */
  requestsPerMinute: number;
  /**
   * Per-user (cross-brand) ceiling. Defaults to `requestsPerMinute * 2` so a
   * multi-brand operator can still amortize across two brands but cannot stack
   * unbounded N-brand quotas to amplify cost. Set to `null` to disable the
   * user ceiling entirely.
   */
  userRequestsPerMinute?: number | null;
}

/**
 * Mark a controller route as rate-limited per (model × brand) sliding window
 * with an optional per-user ceiling (default 2× the brand limit).
 *
 * The accompanying `AiRateLimitGuard` reads this metadata to enforce two
 * Redis-backed sliding-window counters:
 *   1. brand bucket: `ai_rl:${model}:${brandId}`
 *   2. user bucket:  `ai_rl:${model}:user:${userId}` (only when userId resolved)
 * A request must pass BOTH before being admitted. The user bucket only writes
 * when the brand bucket admits, so 429s do not consume future quota.
 */
export const AiRateLimit = (options: AiRateLimitOptions) => SetMetadata(AI_RATE_LIMIT_KEY, options);
