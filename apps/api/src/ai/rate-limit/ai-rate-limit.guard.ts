import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import Redis from 'ioredis';
import { AI_RATE_LIMIT_KEY, AiRateLimitOptions } from './ai-rate-limit.decorator';

const WINDOW_SECONDS = 60;

/**
 * Atomic sliding-window CAS:
 *   1. Trim entries outside the window.
 *   2. Read current count.
 *   3. If under limit: add the new entry + refresh TTL, return {1, count+1}.
 *      Else: do not write, return {0, count}.
 *
 * Running as a single Lua script ensures rejected requests do not pollute the
 * bucket and consume future quota.
 */
const CHECK_AND_ADD_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
local count = tonumber(redis.call('ZCARD', KEYS[1]))
local limit = tonumber(ARGV[3])
if count >= limit then
  return {0, count}
end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[5])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return {1, count + 1}
`;

interface AuthenticatedRequest extends Request {
  user?: { sub?: string; userId?: string };
  resolvedBrandId?: string;
}

/**
 * Per-(model × brand) sliding window rate limiter.
 *
 * Uses a Redis sorted set per bucket and a Lua script for atomic check-and-add.
 * Rejected requests do not write to the bucket — preventing the "poisoned bucket"
 * failure mode where 429s consume future window capacity.
 *
 * Fail-open: if Redis is unreachable, the guard logs a warning and allows the
 * request through rather than blocking AI calls due to infrastructure issues.
 */
@Injectable()
export class AiRateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(AiRateLimitGuard.name);
  private readonly redis: Redis;

  constructor(
    private readonly reflector: Reflector,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    this.redis.on('error', (err: Error) => {
      this.logger.warn(`Redis error in AiRateLimitGuard: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    this.redis.disconnect();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<AiRateLimitOptions | undefined>(
      AI_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = req.user?.sub ?? req.user?.userId;
    const brandId = req.resolvedBrandId ?? userId ?? 'anonymous';
    const brandBucket = `ai_rl:${options.model}:${brandId}`;
    const now = Date.now();
    const windowStart = now - WINDOW_SECONDS * 1000;

    // Resolve user-bucket policy. The user ceiling exists to prevent a
    // multi-brand operator from stacking N × brand quota by rotating brands.
    // Default: 2× the brand limit, so legitimate dual-brand work isn't blocked.
    const userLimit =
      options.userRequestsPerMinute === null
        ? null
        : (options.userRequestsPerMinute ?? options.requestsPerMinute * 2);
    const userBucket =
      userId && userLimit !== null && userId !== brandId
        ? `ai_rl:${options.model}:user:${userId}`
        : null;

    const res = context.switchToHttp().getResponse();

    try {
      // Step 1: brand bucket — atomic check-and-add.
      const brandResult = (await this.redis.eval(
        CHECK_AND_ADD_LUA,
        1,
        brandBucket,
        windowStart.toString(),
        now.toString(),
        options.requestsPerMinute.toString(),
        (WINDOW_SECONDS + 5).toString(),
        `${now}-${randomUUID()}`,
      )) as [number, number];
      const brandAllowed = Array.isArray(brandResult) ? Number(brandResult[0]) === 1 : true;
      const brandCount = Array.isArray(brandResult) ? Number(brandResult[1]) : 0;

      res.setHeader?.('X-RateLimit-Limit', options.requestsPerMinute);
      res.setHeader?.('X-RateLimit-Remaining', Math.max(0, options.requestsPerMinute - brandCount));

      if (!brandAllowed) {
        res.setHeader?.('Retry-After', WINDOW_SECONDS);
        throw new HttpException(
          `AI rate limit exceeded for ${options.model} (${options.requestsPerMinute}/min per brand). Retry in ${WINDOW_SECONDS}s.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Step 2: user bucket — only run when configured. We only get here when
      // the brand bucket already admitted, so the worst case is a redundant
      // brand-bucket member when the user bucket rejects. That cost is bounded
      // (single member per window) and acceptable.
      if (userBucket && userLimit !== null) {
        const userResult = (await this.redis.eval(
          CHECK_AND_ADD_LUA,
          1,
          userBucket,
          windowStart.toString(),
          now.toString(),
          userLimit.toString(),
          (WINDOW_SECONDS + 5).toString(),
          `${now}-${randomUUID()}`,
        )) as [number, number];
        const userAllowed = Array.isArray(userResult) ? Number(userResult[0]) === 1 : true;
        if (!userAllowed) {
          res.setHeader?.('Retry-After', WINDOW_SECONDS);
          throw new HttpException(
            `AI rate limit exceeded for ${options.model} (${userLimit}/min per user across brands). Retry in ${WINDOW_SECONDS}s.`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      return true;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Rate limiter Redis failure (fail-open): ${message}`);
      return true;
    }
  }
}
