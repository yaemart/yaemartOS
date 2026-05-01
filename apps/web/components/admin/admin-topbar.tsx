'use client';

import { Bell, Menu, User } from 'lucide-react';
import { useBrand, type Brand } from '@/providers/brand-provider';

const BRANDS: { id: Brand; label: string }[] = [
  { id: 'homtone', label: 'Homtone' },
  { id: 'spoonlemon', label: 'Spoonlemon' },
  { id: 'davivy', label: 'Davivy' },
  { id: 'tysun', label: 'Tysun' },
];

export function AdminTopbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { brand, setBrand } = useBrand();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>

        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value as Brand)}
          className="h-8 rounded-md border-0 bg-[rgb(var(--brand-primary)/0.1)] pl-2 pr-3 text-sm font-medium text-[rgb(var(--brand-primary))]"
        >
          {BRANDS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600"
          aria-label="User menu"
        >
          <User className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
