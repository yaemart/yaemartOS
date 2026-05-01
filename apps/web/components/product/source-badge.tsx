import { cn } from '@/lib/utils';

export function SourceBadge({ source }: { source: string }) {
  const label =
    source === 'category_inherit'
      ? '继承自品类模板'
      : source === 'manual'
        ? '运营手动填写'
        : source === 'ai_generated'
          ? 'AI 生成'
          : source;

  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs',
        source === 'category_inherit'
          ? 'bg-blue-50 text-blue-600'
          : source === 'manual'
            ? 'bg-zinc-100 text-zinc-500'
            : source === 'ai_generated'
              ? 'bg-violet-50 text-violet-600'
              : 'bg-zinc-100 text-zinc-500',
      )}
    >
      {label}
    </span>
  );
}
