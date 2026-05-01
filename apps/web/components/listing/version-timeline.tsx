'use client';

import { cn } from '@/lib/utils';
import { Sparkles, AlertTriangle } from 'lucide-react';
import type { ListingVersion, VersionStatus } from '@/lib/mock-data';

const STATUS_CONFIG: Record<VersionStatus, { dot: string; badge: string; label: string }> = {
  active: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
    label: 'Active',
  },
  draft: {
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600',
    label: 'Draft',
  },
  ai_draft: {
    dot: 'bg-violet-500',
    badge: 'bg-violet-100 text-violet-700',
    label: 'AI Draft',
  },
  review: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    label: 'In Review',
  },
  archived: {
    dot: 'bg-zinc-400',
    badge: 'bg-zinc-100 text-zinc-500',
    label: 'Archived',
  },
};

interface VersionTimelineProps {
  versions: ListingVersion[];
  selected: ListingVersion;
  onSelect: (v: ListingVersion) => void;
}

export function VersionTimeline({ versions, selected, onSelect }: VersionTimelineProps) {
  const sorted = [...versions].sort((a, b) => b.number - a.number);

  return (
    <div className="p-3">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-text-secondary">
        版本历史
      </h3>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-zinc-200" />

        <div className="space-y-1">
          {sorted.map((version) => {
            const config = STATUS_CONFIG[version.status];
            const isSelected = version.id === selected.id;

            return (
              <button
                key={version.id}
                onClick={() => onSelect(version)}
                className={cn(
                  'relative w-full rounded-md px-2 py-2.5 text-left transition-colors',
                  isSelected ? 'bg-brand-primary/10' : 'hover:bg-zinc-100',
                )}
              >
                {/* Dot */}
                <div className="flex items-start gap-2.5">
                  <div
                    className={cn(
                      'mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border-2 border-white shadow-xs',
                      config.dot,
                      isSelected && 'ring-2 ring-brand-primary/30',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-brand-text">v{version.number}</span>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
                          config.badge,
                        )}
                      >
                        {version.source === 'ai_generated' && (
                          <Sparkles className="mr-0.5 h-2.5 w-2.5" />
                        )}
                        {config.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-brand-text-secondary truncate">
                      {formatDate(version.createdAt)}
                    </p>
                    <p className="text-[11px] text-brand-text-secondary truncate">
                      {version.author}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
