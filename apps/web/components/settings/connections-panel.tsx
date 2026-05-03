'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import type { ConnectionHealth } from '@/lib/api/settings-client';

export function ConnectionsPanel({ connections }: { connections: ConnectionHealth[] }) {
  if (connections.length === 0) {
    return <div className="py-8 text-center text-sm text-zinc-400">无法加载连接状态</div>;
  }

  return (
    <div className="space-y-0 divide-y divide-zinc-100">
      <p className="pb-3 pt-4 text-xs font-medium uppercase tracking-wide text-zinc-400">
        服务连接（只读 — 变更请修改环境变量）
      </p>
      {connections.map((conn) => (
        <div key={conn.id} className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-zinc-900">{conn.label}</p>
            <p className="mt-0.5 font-mono text-xs text-zinc-400">{conn.envKey}</p>
          </div>
          {conn.configured ? (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              已配置
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-red-500">
              <XCircle className="h-4 w-4" />
              未配置
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
