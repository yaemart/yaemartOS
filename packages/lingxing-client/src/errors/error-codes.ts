export const LingxingErrorCode = {
  RATE_LIMITED: 'RATE_LIMITED',
  AUTH_FAILED: 'AUTH_FAILED',
  API_ERROR: 'API_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

export type LingxingErrorCode = (typeof LingxingErrorCode)[keyof typeof LingxingErrorCode];
