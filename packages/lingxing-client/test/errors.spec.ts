import { describe, expect, it } from 'vitest';
import {
  AuthFailedError,
  BusinessError,
  LingxingError,
  LingxingErrorCode,
  NetworkError,
  RateLimitedError,
} from '../src';

describe('LingxingError hierarchy', () => {
  describe('RateLimitedError', () => {
    const error = new RateLimitedError('too many requests', 429);

    it('has correct code', () => {
      expect(error.code).toBe(LingxingErrorCode.RATE_LIMITED);
    });

    it('is retryable', () => {
      expect(error.retryable).toBe(true);
    });

    it('is instanceof LingxingError', () => {
      expect(error).toBeInstanceOf(LingxingError);
    });

    it('preserves status', () => {
      expect(error.status).toBe(429);
    });
  });

  describe('AuthFailedError', () => {
    const error = new AuthFailedError('invalid credentials', 401);

    it('has correct code', () => {
      expect(error.code).toBe(LingxingErrorCode.AUTH_FAILED);
    });

    it('is not retryable', () => {
      expect(error.retryable).toBe(false);
    });

    it('is instanceof LingxingError', () => {
      expect(error).toBeInstanceOf(LingxingError);
    });

    it('preserves status', () => {
      expect(error.status).toBe(401);
    });
  });

  describe('BusinessError', () => {
    const error = new BusinessError('invalid parameter', 400);

    it('has correct code', () => {
      expect(error.code).toBe(LingxingErrorCode.API_ERROR);
    });

    it('is not retryable', () => {
      expect(error.retryable).toBe(false);
    });

    it('is instanceof LingxingError', () => {
      expect(error).toBeInstanceOf(LingxingError);
    });

    it('preserves status', () => {
      expect(error.status).toBe(400);
    });
  });

  describe('NetworkError', () => {
    const error = new NetworkError('connection refused');

    it('has correct code', () => {
      expect(error.code).toBe(LingxingErrorCode.NETWORK_ERROR);
    });

    it('is retryable', () => {
      expect(error.retryable).toBe(true);
    });

    it('is instanceof LingxingError', () => {
      expect(error).toBeInstanceOf(LingxingError);
    });

    it('has no status', () => {
      expect(error.status).toBeUndefined();
    });
  });

  describe('error names', () => {
    it('each subclass has its own name', () => {
      expect(new RateLimitedError('x').name).toBe('RateLimitedError');
      expect(new AuthFailedError('x').name).toBe('AuthFailedError');
      expect(new BusinessError('x').name).toBe('BusinessError');
      expect(new NetworkError('x').name).toBe('NetworkError');
    });
  });
});
