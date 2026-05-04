'use client';

import { useState, type ReactNode } from 'react';
import { RealtimeProvider } from '@/lib/realtime/realtime-provider';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
// SSE inbox URL. The backend gates this with the
// `feature_flag.AGENT_NATIVE_REALTIME_UI` flag; if disabled the connection
// fails fast and the client backs off after a few retries (see
// `realtime-bus.ts`). We always pass a URL so flag flips do not require a
// page reload — admins can toggle and the next reconnect attempt picks it up.
const SSE_URL = `${API_BASE}/realtime/inbox`;

export function AdminShell({
  children,
  capabilities,
}: {
  children: ReactNode;
  capabilities?: string[];
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <RealtimeProvider sseUrl={SSE_URL}>
      <div className="flex h-screen overflow-hidden">
        <AdminSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((p) => !p)}
          capabilities={capabilities}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AdminTopbar onToggleSidebar={() => setCollapsed((p) => !p)} />
          <main className="flex-1 overflow-auto bg-zinc-50 px-6 py-6">{children}</main>
        </div>
      </div>
    </RealtimeProvider>
  );
}
