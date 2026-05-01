import { LingxingError } from '../errors/lingxing-error';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  retryableStatuses?: number[];
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

function isRetryable(error: unknown, retryableStatuses: number[]): boolean {
  if (error instanceof LingxingError) {
    if (error.retryable) {
      return true;
    }
    if (error.status !== undefined && retryableStatuses.includes(error.status)) {
      return true;
    }
    return false;
  }
  return false;
}

export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const retryableStatuses = options?.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryable(error, retryableStatuses) || attempt === maxAttempts) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
