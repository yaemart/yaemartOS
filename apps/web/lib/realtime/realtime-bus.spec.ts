import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeBus } from './realtime-bus';

type Listener = (evt: MessageEvent) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  withCredentials: boolean;
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, Set<Listener>>();
  closed = false;

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    FakeEventSource.instances.push(this);
  }

  addEventListener(event: string, fn: Listener) {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
  }

  close() {
    this.closed = true;
  }

  // Test helpers
  emit(event: string, payload: unknown) {
    const evt = new MessageEvent(event, { data: JSON.stringify(payload) });
    this.listeners.get(event)?.forEach((fn) => fn(evt));
  }

  fireOpen() {
    this.onopen?.();
  }

  fireError() {
    this.onerror?.();
  }
}

describe('RealtimeBus', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.useFakeTimers();
    (globalThis as { EventSource?: unknown }).EventSource = FakeEventSource;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens an EventSource on start() and reports status', () => {
    const bus = new RealtimeBus('http://api/realtime/inbox');
    const statuses: string[] = [];
    bus.onStatus((s) => statuses.push(s));
    bus.start();

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe('http://api/realtime/inbox');
    expect(statuses).toContain('connecting');
    FakeEventSource.instances[0].fireOpen();
    expect(statuses).toContain('open');
  });

  it('dispatches typed events to entity listeners', () => {
    const bus = new RealtimeBus('http://api/realtime/inbox');
    const seen: unknown[] = [];
    bus.on('ad-suggestion', (evt) => seen.push(evt));
    bus.start();

    const source = FakeEventSource.instances[0];
    source.fireOpen();
    source.emit('ad-suggestion', {
      entity: 'ad-suggestion',
      action: 'create',
      brandId: 'homtone',
      ids: ['sug_1'],
      actorType: 'agent',
      timestamp: 1,
    });

    expect(seen).toHaveLength(1);
  });

  it('discards malformed JSON without crashing', () => {
    const bus = new RealtimeBus('http://api/realtime/inbox');
    bus.start();
    const source = FakeEventSource.instances[0];
    source.fireOpen();
    expect(() => {
      const evt = new MessageEvent('listing', { data: '<<not-json>>' });
      source.listeners.get('listing')?.forEach((fn) => fn(evt));
    }).not.toThrow();
  });

  it('reconnects with exponential backoff', () => {
    const bus = new RealtimeBus('http://api/realtime/inbox');
    bus.start();
    const first = FakeEventSource.instances[0];
    first.fireError();
    // First retry is 1000ms.
    vi.advanceTimersByTime(1_000);
    expect(FakeEventSource.instances).toHaveLength(2);

    FakeEventSource.instances[1].fireError();
    vi.advanceTimersByTime(2_000);
    expect(FakeEventSource.instances).toHaveLength(3);
  });

  it('gives up after MAX_FAILED_RECONNECTS retries', () => {
    const bus = new RealtimeBus('http://api/realtime/inbox');
    const statuses: string[] = [];
    bus.onStatus((s) => statuses.push(s));
    bus.start();

    // Trigger 6 failures back-to-back; we need to also advance the timers.
    const failures = 7;
    for (let i = 0; i < failures; i += 1) {
      const src = FakeEventSource.instances[FakeEventSource.instances.length - 1];
      src.fireError();
      vi.advanceTimersByTime(60_000);
    }
    expect(statuses).toContain('error');
  });

  it('stop() prevents further reconnects', () => {
    const bus = new RealtimeBus('http://api/realtime/inbox');
    bus.start();
    FakeEventSource.instances[0].fireError();
    bus.stop();
    vi.advanceTimersByTime(60_000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
