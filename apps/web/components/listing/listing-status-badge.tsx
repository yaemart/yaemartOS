const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  published: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-orange-100 text-orange-700',
  archived: 'bg-zinc-100 text-zinc-500',
};

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  review: '审核中',
  approved: '已通过',
  published: '已发布',
  paused: '已暂停',
  archived: '已归档',
};

export function ListingStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-zinc-100 text-zinc-600';
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}
