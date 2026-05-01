import { LingxingErrorCode } from './error-codes';

export class LingxingError extends Error {
  constructor(
    message: string,
    public readonly code: LingxingErrorCode,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class RateLimitedError extends LingxingError {
  constructor(message: string, status?: number) {
    super(message, LingxingErrorCode.RATE_LIMITED, true, status);
  }
}

export class AuthFailedError extends LingxingError {
  constructor(message: string, status?: number) {
    super(message, LingxingErrorCode.AUTH_FAILED, false, status);
  }
}

export class BusinessError extends LingxingError {
  constructor(message: string, status?: number) {
    super(message, LingxingErrorCode.API_ERROR, false, status);
  }
}

export class NetworkError extends LingxingError {
  constructor(message: string) {
    super(message, LingxingErrorCode.NETWORK_ERROR, true);
  }
}
