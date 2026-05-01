'use client';

import { cn } from '@/lib/utils';

interface CharCounterProps {
  current: number;
  max: number;
}

export function CharCounter({ current, max }: CharCounterProps) {
  const percentage = current / max;
  const isOver = current > max;
  const isNear = percentage > 0.85 && !isOver;

  return (
    <span
      className={cn(
        'text-xs font-mono tabular-nums',
        isOver && 'text-red-600 font-medium',
        isNear && 'text-amber-600',
        !isOver && !isNear && 'text-zinc-400',
      )}
    >
      {current}/{max}
    </span>
  );
}
