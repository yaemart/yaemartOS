'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  RefreshCw,
  Brain,
  Zap,
  FileText,
  Target,
  ArrowRightLeft,
  Loader2,
} from 'lucide-react';
import type { ListingVersion } from '@/lib/mock-data';
import type { KeywordSuggestion } from '@/lib/api/ai-mcp-client';

interface AiCopilotPanelProps {
  currentVersion: ListingVersion;
  onGenerate: () => void;
  disabled: boolean;
  /** Called when user requests keyword suggestions from Lingxing MCP. */
  onKeywordSuggestions?: () => Promise<KeywordSuggestion[]>;
  /** Called when user requests the ASIN listing summary from Lingxing MCP. */
  onListingSummary?: () => Promise<{ title?: string; bullets?: string[] }>;
}

export function AiCopilotPanel({
  currentVersion,
  onGenerate,
  disabled,
  onKeywordSuggestions,
  onListingSummary,
}: AiCopilotPanelProps) {
  const [keywords, setKeywords] = useState<KeywordSuggestion[] | null>(null);
  const [loadingKeywords, setLoadingKeywords] = useState(false);
  const [keywordError, setKeywordError] = useState('');

  const [summary, setSummary] = useState<{ title?: string; bullets?: string[] } | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  async function handleKeywords() {
    if (!onKeywordSuggestions) {
      return;
    }
    setLoadingKeywords(true);
    setKeywordError('');
    setKeywords(null);
    try {
      const result = await onKeywordSuggestions();
      setKeywords(result);
    } catch {
      setKeywordError('获取关键词失败，请确认领星配置');
    } finally {
      setLoadingKeywords(false);
    }
  }

  async function handleListingSummary() {
    if (!onListingSummary) {
      return;
    }
    setLoadingSummary(true);
    setSummary(null);
    try {
      const result = await onListingSummary();
      setSummary(result);
    } finally {
      setLoadingSummary(false);
    }
  }

  return (
    <div className="flex h-full flex-col p-4 overflow-y-auto">
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
          description="从领星获取关键词建议（需绑定店铺）"
          onClick={handleKeywords}
          disabled={disabled || loadingKeywords || !onKeywordSuggestions}
          loading={loadingKeywords}
          badge={onKeywordSuggestions ? undefined : '需配置'}
        />

        {/* Keyword results */}
        {keywordError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{keywordError}</p>
        )}
        {keywords && keywords.length > 0 && (
          <div className="rounded-md border border-violet-100 bg-violet-50/30 p-2">
            <p className="mb-1.5 text-[11px] font-medium text-violet-700">推荐关键词</p>
            <div className="flex flex-wrap gap-1">
              {keywords.slice(0, 12).map((kw) => (
                <span
                  key={kw.keyword}
                  className="rounded-full bg-white border border-violet-200 px-2 py-0.5 text-[11px] text-violet-700"
                >
                  {kw.keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        <ActionButton
          icon={ArrowRightLeft}
          label="Lingxing Listing 摘要"
          description="拉取领星当前 ASIN 的线上 Listing 内容"
          onClick={handleListingSummary}
          disabled={disabled || loadingSummary || !onListingSummary}
          loading={loadingSummary}
          badge={onListingSummary ? undefined : '需配置'}
        />

        {/* Summary result */}
        {summary && (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2 space-y-1">
            {summary.title && (
              <p className="text-[11px] text-zinc-700 leading-snug">
                <span className="font-medium">Title: </span>
                {summary.title}
              </p>
            )}
            {summary.bullets?.slice(0, 2).map((b, i) => (
              <p key={i} className="text-[11px] text-zinc-500 leading-snug">
                • {b}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="my-4 h-px bg-zinc-200" />

      {/* Analysis Actions (placeholder — coming soon) */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-secondary">
          分析工具
        </h4>

        <ActionButton
          icon={Brain}
          label="SEO Score"
          description="评估搜索相关性和可读性"
          onClick={() => {}}
          disabled={true}
          badge="即将推出"
        />

        <ActionButton
          icon={Zap}
          label="Competitor Analysis"
          description="对比同类 ASIN 前 10 Listing"
          onClick={() => {}}
          disabled={true}
          badge="即将推出"
        />

        <ActionButton
          icon={RefreshCw}
          label="Rewrite Title"
          description="基于当前内容重写标题提升 CTR"
          onClick={() => {}}
          disabled={true}
          badge="即将推出"
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
  loading,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
  disabled: boolean;
  primary?: boolean;
  loading?: boolean;
  badge?: string;
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
        {loading ? (
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-violet-500" />
        ) : (
          <Icon
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0',
              primary ? 'text-violet-600' : 'text-brand-text-secondary',
            )}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p
              className={cn('text-sm font-medium', primary ? 'text-violet-700' : 'text-brand-text')}
            >
              {label}
            </p>
            {badge && (
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 font-medium">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-brand-text-secondary leading-tight">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}
