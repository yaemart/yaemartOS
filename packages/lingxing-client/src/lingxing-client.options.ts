export interface LingxingClientOptions {
  appKey: string;
  appSecret: string;
  baseUrl: string;
  redisUrl: string;
  rateLimitRps?: number;
  cachePrefix?: string;
}
