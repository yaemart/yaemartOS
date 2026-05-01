import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { LingxingClientOptions } from './lingxing-client.options';
import { LINGXING_CLIENT_OPTIONS, REDIS_CLIENT } from './lingxing-client.module';
import { HttpTransport } from './client/http-transport';
import { RateLimiter } from './decorators/rate-limiter';
import { ListingsOperations } from './operations/listings';
import { InventoryOperations } from './operations/inventory';
import { ShopsOperations } from './operations/shops';

@Injectable()
export class LingxingClient {
  public readonly listings: ListingsOperations;
  public readonly inventory: InventoryOperations;
  public readonly shops: ShopsOperations;

  constructor(
    @Inject(LINGXING_CLIENT_OPTIONS) options: LingxingClientOptions,
    transport: HttpTransport,
    @Inject(REDIS_CLIENT) redis: Redis,
  ) {
    const rateLimiter = new RateLimiter(redis, options.rateLimitRps ?? 1);
    const prefix = options.cachePrefix ?? 'lingxing:cache';
    this.listings = new ListingsOperations(transport, rateLimiter, redis, prefix);
    this.inventory = new InventoryOperations(transport, rateLimiter, redis, prefix);
    this.shops = new ShopsOperations(transport, rateLimiter);
  }
}
