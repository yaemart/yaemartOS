import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useEntityRevalidation } from './use-entity-revalidation';
import type { RealtimeEvent } from './realtime-types';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

type BusListener = (event: RealtimeEvent) => void;
const busListeners = new Map<string, Set<BusListener>>();
const fakeBus = {
  on: vi.fn((entity: string, fn: BusListener) => {
    let set = busListeners.get(entity);
    if (!set) {
      set = new Set();
      busListeners.set(entity, set);
    }
    set.add(fn);
    return () => set?.delete(fn);
  }),
  start: vi.fn(),
  stop: vi.fn(),
  onStatus: vi.fn(() => () => undefined),
};

vi.mock('./realtime-provider', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useRealtimeContext: () => ({ bus: fakeBus, status: 'open', disabled: false }),
  };
});

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    queryClient,
  };
}

const sample: RealtimeEvent = {
  entity: 'ad-suggestion',
  action: 'create',
  brandId: 'homtone',
  ids: ['sug_1'],
  actorType: 'agent',
  timestamp: 1,
};

function emit(entity: string, event: RealtimeEvent) {
  busListeners.get(entity)?.forEach((fn) => fn(event));
}

describe('useEntityRevalidation', () => {
  beforeEach(() => {
    busListeners.clear();
    refreshMock.mockReset();
  });

  it('auto mode: invalidates queries and triggers router.refresh on every event', () => {
    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useEntityRevalidation('ad-suggestion', { mode: 'auto' }), {
      wrapper,
    });

    act(() => emit('ad-suggestion', sample));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ad-suggestion'] });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(result.current.latestEvent).toEqual(sample);
    expect(result.current.pendingEvents).toHaveLength(0);
  });

  it('toast mode: queues events without invalidating until acceptPending', () => {
    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useEntityRevalidation('listing', { mode: 'toast' }), {
      wrapper,
    });

    act(() =>
      emit('listing', {
        ...sample,
        entity: 'listing',
        ids: ['lst_1'],
      }),
    );
    expect(result.current.pendingEvents).toHaveLength(1);
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();

    act(() => result.current.acceptPending());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['listing'] });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(result.current.pendingEvents).toHaveLength(0);
  });

  it('dismissPending discards events without refreshing', () => {
    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useEntityRevalidation('listing', { mode: 'toast' }), {
      wrapper,
    });

    act(() =>
      emit('listing', {
        ...sample,
        entity: 'listing',
        ids: ['lst_1'],
      }),
    );
    act(() => result.current.dismissPending());
    expect(result.current.pendingEvents).toHaveLength(0);
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('filterIds: ignores events that do not overlap', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useEntityRevalidation('listing', {
          mode: 'auto',
          filterIds: ['lst_keep'],
        }),
      { wrapper },
    );

    act(() =>
      emit('listing', {
        ...sample,
        entity: 'listing',
        ids: ['lst_other'],
      }),
    );
    expect(result.current.latestEvent).toBeNull();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('filterIds: matches when any id overlaps', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useEntityRevalidation('listing', {
          mode: 'auto',
          filterIds: ['lst_keep'],
        }),
      { wrapper },
    );

    act(() =>
      emit('listing', {
        ...sample,
        entity: 'listing',
        ids: ['lst_keep', 'lst_other'],
      }),
    );
    expect(result.current.latestEvent?.ids).toContain('lst_keep');
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('respects custom queryKeys', () => {
    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(
      () =>
        useEntityRevalidation('ad-change', {
          mode: 'auto',
          queryKeys: [['ad-change', 'list'], ['dashboard']],
        }),
      { wrapper },
    );

    act(() =>
      emit('ad-change', {
        ...sample,
        entity: 'ad-change',
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ad-change', 'list'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
  });

  it('calls onEvent before applying invalidations', () => {
    const onEvent = vi.fn();
    const { wrapper } = makeWrapper();
    renderHook(
      () =>
        useEntityRevalidation('listing', {
          mode: 'auto',
          onEvent,
        }),
      { wrapper },
    );

    act(() =>
      emit('listing', {
        ...sample,
        entity: 'listing',
      }),
    );
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.invocationCallOrder[0]).toBeLessThan(
      refreshMock.mock.invocationCallOrder[0] ?? Infinity,
    );
  });
});
