import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `vi.mock` is hoisted above `import` statements, so any state it touches
// must come from `vi.hoisted` (which is also hoisted) rather than from
// regular module-level consts. Without this, FakeRedis would be referenced
// before its declaration.
const { subscribed, messageHandlers, FakeRedis } = vi.hoisted(() => {
  type Handler = (channel: string, message: string) => void;
  const subscribed = new Set<string>();
  const messageHandlers = new Set<Handler>();
  const FakeRedis = vi.fn().mockImplementation(() => ({
    status: 'wait',
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn((channel: string) => {
      subscribed.add(channel);
      return Promise.resolve();
    }),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn((channel: string, msg: string) => {
      messageHandlers.forEach((fn) => fn(channel, msg));
      return Promise.resolve(messageHandlers.size);
    }),
    disconnect: vi.fn(),
  }));
  return { subscribed, messageHandlers, FakeRedis };
});

vi.mock('ioredis', () => ({ default: FakeRedis }));

import { ConfigService } from '@nestjs/config';
import { firstValueFrom, take, toArray } from 'rxjs';
import { RealtimeBusService } from './realtime-bus.service';
import { REALTIME_PUBSUB_CHANNEL, type RealtimeEvent } from './realtime.types';

type Handler = (channel: string, message: string) => void;

/**
 * Bridge the fake Redis subscriber's `on('message', ...)` callback into our
 * test-controlled `messageHandlers` set so that `publish()` round-trips
 * through the same path the production code uses.
 */
function installMessageInterception(svcInstance: { sub: unknown }): void {
  const sub = svcInstance.sub as { on: (event: string, fn: Handler) => void };
  sub.on = (event: string, fn: Handler) => {
    if (event === 'message') {
      messageHandlers.add(fn);
    }
  };
}

const baseEvent: RealtimeEvent = {
  entity: 'listing',
  action: 'update',
  brandId: 'homtone',
  ids: ['lst_1'],
  actorType: 'agent',
  actorId: 'agent-1',
  timestamp: 1_700_000_000_000,
};

describe('RealtimeBusService', () => {
  let service: RealtimeBusService;

  beforeEach(async () => {
    subscribed.clear();
    messageHandlers.clear();
    FakeRedis.mockClear();
    const config = new ConfigService({ REDIS_URL: 'redis://localhost:6379' });
    service = new RealtimeBusService(config);
    installMessageInterception(service as unknown as { sub: unknown });
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('subscribes to the well-known channel on init', () => {
    expect(subscribed.has(REALTIME_PUBSUB_CHANNEL)).toBe(true);
  });

  it('publishes a JSON envelope without throwing', async () => {
    await expect(service.publish(baseEvent)).resolves.toBeUndefined();
  });

  it('delivers events to brand subscribers', async () => {
    const collected = firstValueFrom(service.subscribeForBrand('homtone').pipe(take(1), toArray()));
    await service.publish(baseEvent);
    const events = await collected;
    expect(events).toHaveLength(1);
    expect(events[0].entity).toBe('listing');
    expect(events[0].brandId).toBe('homtone');
  });

  it('does not leak events across brands', async () => {
    let resolved = false;
    const otherBrand = firstValueFrom(
      service.subscribeForBrand('spoonlemon').pipe(take(1), toArray()),
    ).then((evts) => {
      resolved = true;
      return evts;
    });
    await service.publish(baseEvent);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(resolved).toBe(false);
    void otherBrand; // keep ref so the promise isn't unhandled
  });

  it('discards malformed Redis payloads without crashing', () => {
    expect(() => {
      messageHandlers.forEach((fn) => fn(REALTIME_PUBSUB_CHANNEL, '<<not-json>>'));
    }).not.toThrow();
  });

  it('emitLocalForTest bypasses Redis and reaches subscribers', async () => {
    const promise = firstValueFrom(service.subscribeForBrand('homtone').pipe(take(1), toArray()));
    service.emitLocalForTest(baseEvent);
    await expect(promise).resolves.toHaveLength(1);
  });
});
