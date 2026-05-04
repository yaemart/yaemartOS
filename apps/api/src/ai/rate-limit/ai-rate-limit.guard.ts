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
import type { Request } from 'express';
import Redis from 'ioredis';
import { AI_RATE_LIMIT_KEY, AiRateLimitOptions } from './ai-rate-limit.decorator';

const WINDOW_SECONDS = 60;

interface AuthenticatedRequest extends Request {
  user?: { sub?: string; userId?: string };
  resolvedBrandId?: string;
}

/**
 * Per-(model × brand) sliding window rate limiter.
 *
 * Uses Redis sorted sets keyed by bucket; entries older than the window are
 * trimmed on every request and the resulting cardinality is compared against
 * the configured `requestsPerMinute`.
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
    const brandId = req.resolvedBrandId ?? req.user?.sub ?? req.user?.userId ?? 'anonymous';
    const bucket = `ai_rl:${options.model}:${brandId}`;
    const now = Date.now();
    const windowStart = now - WINDOW_SECONDS * 1000;

    try {
      const pipeline = this.redis.multi();
      pipeline.zremrangebyscore(bucket, 0, windowStart);
      pipeline.zadd(bucket, now, `${now}-${Math.random()}`);
      pipeline.zcard(bucket);
      pipeline.expire(bucket, WINDOW_SECONDS + 5);
      const results = await pipeline.exec();

      if (!results) {
        return true;
      }
      const cardEntry = results[2];
      const count = (Array.isArray(cardEntry) ? cardEntry[1] : 0) as number;

      if (count > options.requestsPerMinute) {
        const retryAfter = WINDOW_SECONDS;
        const res = context.switchToHttp().getResponse();
        res.setHeader?.('X-RateLimit-Limit', options.requestsPerMinute);
        res.setHeader?.('X-RateLimit-Remaining', 0);
        res.setHeader?.('Retry-After', retryAfter);
        throw new HttpException(
          `AI rate limit exceeded for ${options.model} (${options.requestsPerMinute}/min per brand). Retry in ${retryAfter}s.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
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
