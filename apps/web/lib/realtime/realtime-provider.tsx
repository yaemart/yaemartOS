'use client';

import { QueryClient, QueryClientProvider, type QueryClientConfig } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { RealtimeBus, type BusStatus } from './realtime-bus';

const DEFAULT_QUERY_CONFIG: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // Listing pages stay reasonably fresh on their own; SSE handles
      // out-of-band invalidations. Keep a short staleTime so user-driven
      // navigation still feels live without spamming refetches.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
};

interface RealtimeContextValue {
  bus: RealtimeBus | null;
  status: BusStatus;
  /** True when the feature flag / config opted us out of realtime. */
  disabled: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  bus: null,
  status: 'idle',
  disabled: true,
});

interface RealtimeProviderProps {
  children: ReactNode;
  /**
   * Absolute SSE URL — typically `${NEXT_PUBLIC_API_URL}/realtime/inbox`.
   * Pass an empty string or omit to disable realtime entirely (e.g. when
   * the feature flag is off for the current brand).
   */
  sseUrl: string | null;
  queryClientConfig?: QueryClientConfig;
}

/**
 * Combined provider for `@tanstack/react-query` and the realtime SSE bus.
 *
 * Mount once at the admin shell root. The bus is kept null when `sseUrl`
 * is null so the feature flag can disable realtime without conditional
 * rendering of the provider tree.
 *
 * See ADR-011.
 */
export function RealtimeProvider({
  children,
  sseUrl,
  queryClientConfig = DEFAULT_QUERY_CONFIG,
}: RealtimeProviderProps) {
  const [queryClient] = useState(() => new QueryClient(queryClientConfig));
  const [status, setStatus] = useState<BusStatus>('idle');

  const bus = useMemo(() => {
    if (!sseUrl) {
      return null;
    }
    return new RealtimeBus(sseUrl, { withCredentials: true });
  }, [sseUrl]);

  useEffect(() => {
    if (!bus) {
      return;
    }
    bus.start();
    const detach = bus.onStatus((next) => setStatus(next));
    return () => {
      detach();
      bus.stop();
    };
  }, [bus]);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      bus,
      status,
      disabled: bus === null,
    }),
    [bus, status],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
    </QueryClientProvider>
  );
}

export function useRealtimeContext(): RealtimeContextValue {
  return useContext(RealtimeContext);
}
