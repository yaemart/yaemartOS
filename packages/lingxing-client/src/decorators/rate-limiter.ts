import Redis from 'ioredis';
import { RateLimitedError } from '../errors/lingxing-error';

const LUA_TOKEN_BUCKET = `
local key = KEYS[1]
local rps = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local maxTokens = rps * 2

local raw = redis.call('GET', key)
local tokens, lastRefill

if raw then
  local state = cjson.decode(raw)
  tokens = tonumber(state.tokens)
  lastRefill = tonumber(state.lastRefill)
else
  tokens = rps
  lastRefill = now
end

local elapsed = (now - lastRefill) / 1000
local refilled = tokens + elapsed * rps
if refilled > maxTokens then
  refilled = maxTokens
end

if refilled >= 1 then
  refilled = refilled - 1
  redis.call('SET', key, cjson.encode({tokens = refilled, lastRefill = now}), 'EX', 60)
  return 1
else
  redis.call('SET', key, cjson.encode({tokens = refilled, lastRefill = now}), 'EX', 60)
  return 0
end
`;

const RETRY_INTERVAL_MS = 200;
const WARN_THRESHOLD_MS = 5000;

export class RateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly rps: number = 1,
    private readonly maxWaitMs: number = 30000,
    private readonly keyPrefix: string = 'lingxing:ratelimit',
  ) {}

  async acquire(): Promise<void> {
    const key = `${this.keyPrefix}:bucket`;
    let waited = 0;

    while (waited <= this.maxWaitMs) {
      const now = Date.now();
      let result: unknown;
      try {
        result = await this.redis.eval(LUA_TOKEN_BUCKET, 1, key, this.rps, now);
      } catch {
        // Redis unavailable — degrade gracefully and allow the request
        return;
      }

      if (result === 1) {
        return;
      }

      if (waited + RETRY_INTERVAL_MS > this.maxWaitMs) {
        break;
      }

      await this.sleep(RETRY_INTERVAL_MS);
      waited += RETRY_INTERVAL_MS;

      if (waited >= WARN_THRESHOLD_MS) {
        console.warn(`RateLimiter: waited ${waited}ms for token acquisition`);
      }
    }

    throw new RateLimitedError(
      `Rate limit exceeded: waited ${waited}ms (max ${this.maxWaitMs}ms)`,
      429,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
