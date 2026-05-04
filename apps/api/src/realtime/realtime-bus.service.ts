import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Subject, type Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { REALTIME_PUBSUB_CHANNEL, type RealtimeEvent } from './realtime.types';

/**
 * Cross-pod realtime fanout.
 *
 * Producers (controllers / services) call `publish()` after a successful
 * write. The event is broadcast on the `REALTIME_PUBSUB_CHANNEL` Redis
 * pub/sub channel; every API pod is subscribed and re-broadcasts to its
 * in-process RxJS Subject, where SSE controllers fan out to live
 * EventSource connections filtered by brand.
 *
 * Two Redis connections are required because ioredis blocks the connection
 * once it enters subscriber mode. Both fail-open: if Redis is unreachable
 * we log and continue (no realtime, but no business impact).
 *
 * See ADR-011 §D2.
 */
@Injectable()
export class RealtimeBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeBusService.name);
  private readonly pub: Redis;
  private readonly sub: Redis;
  private readonly local$ = new Subject<RealtimeEvent>();

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.pub = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    this.sub = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });

    const onError = (label: string) => (err: Error) => {
      this.logger.warn(`Redis ${label} error in RealtimeBusService: ${err.message}`);
    };
    this.pub.on('error', onError('publisher'));
    this.sub.on('error', onError('subscriber'));
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.sub.connect();
      await this.sub.subscribe(REALTIME_PUBSUB_CHANNEL);
      this.sub.on('message', (channel, raw) => {
        if (channel !== REALTIME_PUBSUB_CHANNEL) {
          return;
        }
        try {
          const evt = JSON.parse(raw) as RealtimeEvent;
          this.local$.next(evt);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Discarding malformed realtime payload: ${message}`);
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Realtime subscriber failed to start (fail-open): ${message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.local$.complete();
    try {
      await this.sub.unsubscribe();
    } catch {
      // ignore — connection may already be torn down
    }
    this.sub.disconnect();
    this.pub.disconnect();
  }

  /**
   * Publish a realtime event for cross-pod fanout.
   *
   * Always returns; never throws. Connectivity issues are logged.
   */
  async publish(event: RealtimeEvent): Promise<void> {
    try {
      // Lazy connect: the publisher is dormant until the first write.
      if (this.pub.status === 'wait' || this.pub.status === 'end') {
        await this.pub.connect().catch(() => undefined);
      }
      await this.pub.publish(REALTIME_PUBSUB_CHANNEL, JSON.stringify(event));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`publish() Redis failure (fail-open): ${message}`);
    }
  }

  /**
   * Brand-scoped event stream consumed by the SSE controller. Cross-tenant
   * leakage is impossible because the filter runs server-side before the
   * event leaves the bus.
   */
  subscribeForBrand(brandId: string): Observable<RealtimeEvent> {
    return this.local$.asObservable().pipe(filter((e) => e.brandId === brandId));
  }

  /** Test/diagnostic hook: lets unit tests inject events without Redis. */
  emitLocalForTest(event: RealtimeEvent): void {
    this.local$.next(event);
  }
}
