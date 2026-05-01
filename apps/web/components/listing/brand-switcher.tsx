'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBrand, type Brand } from '@/providers/brand-provider';

const BRANDS: { id: Brand; name: string; dot: string }[] = [
  { id: 'homtone', name: 'Homtone', dot: 'bg-amber-500' },
  { id: 'spoonlemon', name: 'Spoonlemon', dot: 'bg-emerald-500' },
  { id: 'davivy', name: 'Davivy', dot: 'bg-zinc-800' },
  { id: 'tysun', name: 'Tysun', dot: 'bg-blue-600' },
];

export function BrandSwitcher() {
  const { brand, setBrand } = useBrand();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = BRANDS.find((b) => b.id === brand)!;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-zinc-50 transition-colors"
      >
        <div className={cn('h-2.5 w-2.5 rounded-full', current.dot)} />
        <span className="font-medium text-brand-text">{current.name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-brand-text-secondary" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border bg-white py-1 shadow-md z-dropdown">
          {BRANDS.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                setBrand(b.id);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                b.id === brand
                  ? 'bg-brand-primary/10 text-brand-text font-medium'
                  : 'text-brand-text-secondary hover:bg-zinc-50 hover:text-brand-text',
              )}
            >
              <div className={cn('h-2.5 w-2.5 rounded-full', b.dot)} />
              {b.name}
              {b.id === brand && <span className="ml-auto text-xs text-brand-primary">●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
