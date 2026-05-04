import type { RealtimeEntity, RealtimeEvent } from './realtime-types';

type Listener = (event: RealtimeEvent) => void;

const RECONNECT_BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;
const MAX_FAILED_RECONNECTS = 6;

/**
 * Browser-side realtime bus.
 *
 * Holds a single EventSource connection per tab, fans events out to
 * per-entity listeners, and reconnects with exponential backoff. Designed
 * to be instantiated once via `RealtimeProvider`; do not new this up
 * directly in components.
 *
 * Failure modes:
 *  - Server returns 401/403 → stop reconnecting (feature flag off, or
 *    cookie expired). The hook surfaces this so callers can prompt re-login.
 *  - Server returns 5xx / connection drops → exponential backoff capped at
 *    `MAX_FAILED_RECONNECTS` retries; after that we go silent and let the
 *    user manually refresh.
 *
 * See ADR-011.
 */
export class RealtimeBus {
  private source: EventSource | null = null;
  private listeners = new Map<RealtimeEntity | '*', Set<Listener>>();
  private retryAttempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private statusListeners = new Set<(status: BusStatus) => void>();
  private status: BusStatus = 'idle';

  constructor(
    private readonly url: string,
    private readonly options: { withCredentials?: boolean } = { withCredentials: true },
  ) {}

  start(): void {
    if (this.source || this.closed) {
      return;
    }
    this.openConnection();
  }

  stop(): void {
    this.closed = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.source?.close();
    this.source = null;
    this.setStatus('idle');
  }

  on(entity: RealtimeEntity | '*', listener: Listener): () => void {
    let set = this.listeners.get(entity);
    if (!set) {
      set = new Set();
      this.listeners.set(entity, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }

  onStatus(listener: (status: BusStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private openConnection(): void {
    try {
      this.source = new EventSource(this.url, { withCredentials: this.options.withCredentials });
    } catch {
      // EventSource throws synchronously only on malformed URL; treat as fatal.
      this.setStatus('error');
      return;
    }
    this.setStatus('connecting');

    this.source.onopen = () => {
      this.retryAttempt = 0;
      this.setStatus('open');
    };

    // Each entity is a named SSE event. We register one handler per entity
    // up-front so the browser dispatches them via `addEventListener` rather
    // than the unnamed `onmessage` channel (which is reserved for the
    // server's default-event stream — currently unused).
    const entities: (RealtimeEntity | 'heartbeat')[] = [
      'listing',
      'listing-version',
      'ad-suggestion',
      'ad-change',
      'ad-daily-stat',
      'shop-binding',
      'system-config',
      'migration-job',
      'terminology',
      'heartbeat',
    ];
    entities.forEach((evt) => {
      this.source!.addEventListener(evt, (raw) => {
        if (evt === 'heartbeat') {
          return;
        }
        const data = (raw as MessageEvent).data;
        if (typeof data !== 'string') {
          return;
        }
        try {
          const parsed = JSON.parse(data) as RealtimeEvent;
          this.dispatch(parsed);
        } catch {
          // Discard malformed payload silently — we never want to crash
          // the live page over a bad event.
        }
      });
    });

    this.source.onerror = () => {
      // EventSource auto-reconnects, but we want bounded retries with
      // backoff so a server-down state doesn't run an infinite tight loop.
      this.source?.close();
      this.source = null;

      if (this.closed) {
        return;
      }
      if (this.retryAttempt >= MAX_FAILED_RECONNECTS) {
        this.setStatus('error');
        return;
      }
      const delay =
        RECONNECT_BACKOFF_MS[Math.min(this.retryAttempt, RECONNECT_BACKOFF_MS.length - 1)];
      this.retryAttempt += 1;
      this.setStatus('reconnecting');
      this.retryTimer = setTimeout(() => this.openConnection(), delay);
    };
  }

  private dispatch(event: RealtimeEvent): void {
    this.listeners.get(event.entity)?.forEach((fn) => fn(event));
    this.listeners.get('*')?.forEach((fn) => fn(event));
  }

  private setStatus(status: BusStatus): void {
    if (this.status === status) {
      return;
    }
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status));
  }
}

export type BusStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'error';
