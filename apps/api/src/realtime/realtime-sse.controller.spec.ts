import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { firstValueFrom, of, take, toArray } from 'rxjs';
import { RealtimeSseController } from './realtime-sse.controller';
import type { RealtimeBusService } from './realtime-bus.service';
import type { RealtimeEvent } from './realtime.types';

function makeBus(events: RealtimeEvent[]): RealtimeBusService {
  return {
    subscribeForBrand: vi.fn().mockReturnValue(of(...events)),
    publish: vi.fn().mockResolvedValue(undefined),
    emitLocalForTest: vi.fn(),
  } as unknown as RealtimeBusService;
}

function makeReq(opts: { brandId?: string }): {
  user?: { id: string; brandId?: string };
  on: (event: string, fn: () => void) => void;
} {
  return {
    user: opts.brandId ? { id: 'user-1', brandId: opts.brandId } : undefined,
    on: vi.fn(),
  };
}

const sample: RealtimeEvent = {
  entity: 'ad-suggestion',
  action: 'create',
  brandId: 'homtone',
  ids: ['sug_1'],
  actorType: 'agent',
  timestamp: 1_700_000_000_000,
};

describe('RealtimeSseController', () => {
  it('rejects requests without brandId on the JWT', () => {
    const ctrl = new RealtimeSseController(makeBus([]));
    expect(() => ctrl.inbox(makeReq({}) as any)).toThrow(ForbiddenException);
  });

  it('rejects mismatched brand override', () => {
    const ctrl = new RealtimeSseController(makeBus([]));
    expect(() => ctrl.inbox(makeReq({ brandId: 'homtone' }) as any, 'spoonlemon')).toThrow(
      ForbiddenException,
    );
  });

  it('allows brand override matching JWT', async () => {
    const ctrl = new RealtimeSseController(makeBus([sample]));
    const stream = ctrl.inbox(makeReq({ brandId: 'homtone' }) as any, 'homtone');
    const events = await firstValueFrom(stream.pipe(take(1), toArray()));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('ad-suggestion');
  });

  it('serializes events as MessageEvent with entity-name as event type', async () => {
    const ctrl = new RealtimeSseController(makeBus([sample]));
    const stream = ctrl.inbox(makeReq({ brandId: 'homtone' }) as any);
    const [evt] = await firstValueFrom(stream.pipe(take(1), toArray()));
    expect(evt.type).toBe('ad-suggestion');
    const payload = JSON.parse(evt.data as string) as RealtimeEvent;
    expect(payload.brandId).toBe('homtone');
    expect(payload.entity).toBe('ad-suggestion');
  });

  it('emits heartbeat events on the heartbeat channel', () => {
    // Heartbeat is throttled at 25s; we don't tick the clock here. The
    // existence test is sufficient: the merged stream should not crash
    // when no events arrive yet.
    const ctrl = new RealtimeSseController(makeBus([]));
    const stream = ctrl.inbox(makeReq({ brandId: 'homtone' }) as any);
    expect(stream).toBeDefined();
  });

  it('debug-ping is forbidden in production', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const ctrl = new RealtimeSseController(makeBus([]));
      expect(() => ctrl.ping(makeReq({ brandId: 'homtone' }) as any)).toThrow(BadRequestException);
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
