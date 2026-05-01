'use client';

import { cn } from '@/lib/utils';
import {
  Sparkles,
  Wand2,
  RefreshCw,
  Brain,
  Zap,
  FileText,
  Target,
  ArrowRightLeft,
} from 'lucide-react';
import type { ListingVersion } from '@/lib/mock-data';

interface AiCopilotPanelProps {
  currentVersion: ListingVersion;
  onGenerate: () => void;
  disabled: boolean;
}

export function AiCopilotPanel({ currentVersion, onGenerate, disabled }: AiCopilotPanelProps) {
  return (
    <div className="flex h-full flex-col p-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-100">
          <Sparkles className="h-4 w-4 text-violet-600" />
        </div>
        <h3 className="text-sm font-semibold text-brand-text">AI Copilot</h3>
      </div>

      {/* Context Card */}
      <div className="mb-4 rounded-lg border bg-violet-50/50 p-3">
        <p className="text-xs text-violet-700">
          当前版本: <span className="font-medium">v{currentVersion.number}</span>
          {currentVersion.source === 'ai_generated' && ' (AI 生成)'}
        </p>
        <p className="mt-1 text-xs text-violet-600/80">
          AI 建议基于产品属性、竞品分析和平台 SEO 规则生成
        </p>
      </div>

      {/* Primary Actions */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-secondary">
          生成操作
        </h4>

        <ActionButton
          icon={FileText}
          label="Generate Full Listing"
          description="生成完整 Title + Bullets + Description"
          onClick={onGenerate}
          disabled={disabled}
          primary
        />

        <ActionButton
          icon={Target}
          label="Optimize Keywords"
          description="分析搜索趋势，优化后端关键词"
          onClick={() => {}}
          disabled={disabled}
        />

        <ActionButton
          icon={RefreshCw}
          label="Rewrite Title"
          description="基于当前内容重写标题提升 CTR"
          onClick={() => {}}
          disabled={disabled}
        />
      </div>

      {/* Separator */}
      <div className="my-4 h-px bg-zinc-200" />

      {/* Analysis Actions */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-secondary">
          分析工具
        </h4>

        <ActionButton
          icon={ArrowRightLeft}
          label="Compare with v1"
          description="与 Active 版本逐字段对比"
          onClick={() => {}}
          disabled={disabled}
        />

        <ActionButton
          icon={Brain}
          label="SEO Score"
          description="评估搜索相关性和可读性"
          onClick={() => {}}
          disabled={disabled}
        />

        <ActionButton
          icon={Zap}
          label="Competitor Analysis"
          description="对比同类 ASIN 前 10 Listing"
          onClick={() => {}}
          disabled={disabled}
        />
      </div>

      {/* Footer tip */}
      <div className="mt-auto pt-4">
        <p className="text-[11px] text-brand-text-secondary/70 text-center">
          ⌘G 快速生成 · AI 结果仅写入 Draft
        </p>
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  description,
  onClick,
  disabled,
  primary,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
  disabled: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full rounded-lg border p-3 text-left transition-all',
        'hover:shadow-xs hover:border-violet-300 hover:bg-violet-50/50',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:bg-transparent disabled:hover:border-zinc-200',
        primary && 'border-violet-200 bg-violet-50/30',
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0',
            primary ? 'text-violet-600' : 'text-brand-text-secondary',
          )}
        />
        <div className="min-w-0">
          <p className={cn('text-sm font-medium', primary ? 'text-violet-700' : 'text-brand-text')}>
            {label}
          </p>
          <p className="mt-0.5 text-[11px] text-brand-text-secondary leading-tight">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}
