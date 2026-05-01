'use client';

import { useState, type ReactNode } from 'react';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';

export function AdminShell({
  children,
  capabilities,
}: {
  children: ReactNode;
  capabilities?: string[];
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
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
  );
}
