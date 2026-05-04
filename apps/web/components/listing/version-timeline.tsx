'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
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
  /**
   * Activates a version. The component shows a Radix Dialog for
   * confirmation before calling this — activation archives the current
   * active version, so it must be a deliberate operator action.
   */
  onActivate?: (v: ListingVersion) => Promise<void> | void;
  /** Disables the activate buttons while an upstream activate request is in flight. */
  activating?: boolean;
}

export function VersionTimeline({
  versions,
  selected,
  onSelect,
  onActivate,
  activating = false,
}: VersionTimelineProps) {
  const sorted = [...versions].sort((a, b) => b.number - a.number);
  const [confirm, setConfirm] = useState<ListingVersion | null>(null);
  const previousActive = sorted.find((v) => v.status === 'active');

  async function handleConfirm() {
    if (!confirm || !onActivate) {
      return;
    }
    await onActivate(confirm);
    setConfirm(null);
  }

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
            const canActivate = onActivate !== undefined && version.status !== 'active';

            return (
              <div
                key={version.id}
                className={cn(
                  'group relative rounded-md transition-colors',
                  isSelected ? 'bg-brand-primary/10' : 'hover:bg-zinc-100',
                )}
              >
                <button
                  onClick={() => onSelect(version)}
                  className="relative w-full px-2 py-2.5 text-left"
                >
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
                        <span className="text-sm font-medium text-brand-text">
                          v{version.number}
                        </span>
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
                {canActivate && (
                  <div className="absolute right-2 top-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirm(version);
                      }}
                      disabled={activating}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 opacity-0 shadow-xs transition-opacity hover:bg-emerald-50 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                      aria-label={`激活 v${version.number}`}
                    >
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      激活
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Dialog.Root
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !activating) {
            setConfirm(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none">
            <Dialog.Title className="text-base font-semibold text-zinc-900">
              确认激活此版本？
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-zinc-600">
              {confirm && (
                <>
                  即将把 <span className="font-medium text-zinc-900">v{confirm.number}</span> 设为{' '}
                  <span className="font-medium text-emerald-700">Active</span>
                  {previousActive && previousActive.id !== confirm.id ? (
                    <>
                      ，当前的 <span className="font-medium">v{previousActive.number}</span>{' '}
                      将被自动归档。
                    </>
                  ) : (
                    '。'
                  )}
                </>
              )}
            </Dialog.Description>
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              激活后，平台前台将立即指向该版本（受平台同步节奏影响，外部展示有延迟）。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={activating}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  取消
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={activating || !confirm}
                className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {activating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                确认激活
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
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
