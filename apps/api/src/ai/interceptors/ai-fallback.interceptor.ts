import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, of, retry, timer } from 'rxjs';

export const AI_DEGRADED_SIGNAL = 'AI_DEGRADED' as const;

export interface AiDegradedResult {
  status: typeof AI_DEGRADED_SIGNAL;
  reason: string;
}

export function isAiDegraded(value: unknown): value is AiDegradedResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as AiDegradedResult).status === AI_DEGRADED_SIGNAL
  );
}

/**
 * Wraps AI service calls with retry and graceful degradation.
 * On 5xx / timeout: retries up to MAX_RETRIES times with exponential backoff.
 * After exhausting retries, returns an AiDegradedResult instead of throwing.
 *
 * Usage: apply @UseInterceptors(AiFallbackInterceptor) on AI-facing controller
 * methods, or bind it to specific service calls via RxJS composition.
 */
@Injectable()
export class AiFallbackInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AiFallbackInterceptor.name);
  private static readonly MAX_RETRIES = 2;
  private static readonly BASE_DELAY_MS = 500;

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      retry({
        count: AiFallbackInterceptor.MAX_RETRIES,
        delay: (_error, attempt) => {
          const delayMs = AiFallbackInterceptor.BASE_DELAY_MS * Math.pow(2, attempt - 1);
          this.logger.warn(`AI call failed (attempt ${attempt}), retrying in ${delayMs}ms…`);
          return timer(delayMs);
        },
        resetOnSuccess: true,
      }),
      catchError((err: unknown) => {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.error(`AI call exhausted all retries: ${reason}`);
        const degraded: AiDegradedResult = {
          status: AI_DEGRADED_SIGNAL,
          reason,
        };
        return of(degraded);
      }),
    );
  }
}
