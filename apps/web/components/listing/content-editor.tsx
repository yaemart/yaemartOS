'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, Sparkles } from 'lucide-react';
import { CharCounter } from './char-counter';
import type { ListingVersion } from '@/lib/mock-data';

const TABS = ['Title', 'Bullets', 'Description', 'A+', 'Keywords'] as const;
type Tab = (typeof TABS)[number];

const PLATFORM_LIMITS = {
  title: 200,
  bullet: 500,
  description: 2000,
  keywords: 250,
};

interface ContentEditorProps {
  version: ListingVersion;
  disabled: boolean;
}

export function ContentEditor({ version, disabled }: ContentEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Title');

  return (
    <div className={cn('space-y-5', disabled && 'pointer-events-none select-none')}>
      {/* Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusStepper status={version.status} />
          {version.status === 'active' && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              <Star className="h-3 w-3" /> Primary Listing
            </span>
          )}
        </div>
        <span className="text-xs text-brand-text-secondary">
          {version.source === 'ai_generated' ? '✨ AI Generated' : '✏️ Manual'}
        </span>
      </div>

      {/* Tabs */}
      <nav className="flex gap-0.5 border-b">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'relative px-3 py-2 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'text-brand-primary'
                : 'text-brand-text-secondary hover:text-brand-text',
            )}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-primary rounded-full" />
            )}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'Title' && <TitleEditor title={version.title} />}
        {activeTab === 'Bullets' && <BulletsEditor bullets={version.bullets} />}
        {activeTab === 'Description' && <DescriptionEditor description={version.description} />}
        {activeTab === 'A+' && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-brand-text-secondary">A+ 内容暂未填写</p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs text-violet-700">
              <Sparkles className="h-3 w-3 text-violet-500" />
              A+ 自动生成功能将在 S5 开放，目前请手动编辑或拷贝模板
            </p>
          </div>
        )}
        {activeTab === 'Keywords' && <KeywordsEditor keywords={version.keywords} />}
      </div>
    </div>
  );
}

function TitleEditor({ title }: { title: string }) {
  const [value, setValue] = useState(title);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-brand-text">Product Title</label>
        <CharCounter current={value.length} max={PLATFORM_LIMITS.title} />
      </div>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          className={cn(
            'w-full rounded-md border bg-white px-3 py-2.5 text-sm text-brand-text',
            'placeholder:text-brand-text-secondary/60',
            'focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary',
            'transition-all resize-none',
            value.length > PLATFORM_LIMITS.title && 'border-red-500 focus:ring-red-200',
          )}
        />
        {value.length < 80 && (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-violet-700">
            <Sparkles className="h-2.5 w-2.5 text-violet-500" />
            标题偏短，可在右侧 AI 助手面板中调用「优化标题」获取建议
          </p>
        )}
      </div>
    </div>
  );
}

function BulletsEditor({ bullets }: { bullets: string[] }) {
  const [values, setValues] = useState(bullets);

  return (
    <div className="space-y-3">
      {values.map((bullet, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-brand-text-secondary">Bullet {i + 1}</label>
            <CharCounter current={bullet.length} max={PLATFORM_LIMITS.bullet} />
          </div>
          <textarea
            value={bullet}
            onChange={(e) => {
              const next = [...values];
              next[i] = e.target.value;
              setValues(next);
            }}
            rows={2}
            className={cn(
              'w-full rounded-md border bg-white px-3 py-2 text-sm text-brand-text',
              'focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary',
              'transition-all resize-none',
              bullet.length > PLATFORM_LIMITS.bullet && 'border-red-500',
            )}
          />
        </div>
      ))}
    </div>
  );
}

function DescriptionEditor({ description }: { description: string }) {
  const [value, setValue] = useState(description);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-brand-text">Product Description</label>
        <CharCounter current={value.length} max={PLATFORM_LIMITS.description} />
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={8}
        className={cn(
          'w-full rounded-md border bg-white px-3 py-2.5 text-sm text-brand-text leading-relaxed',
          'focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary',
          'transition-all resize-y',
          value.length > PLATFORM_LIMITS.description && 'border-red-500',
        )}
      />
    </div>
  );
}

function KeywordsEditor({ keywords }: { keywords: string }) {
  const [value, setValue] = useState(keywords);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-brand-text">Backend Keywords</label>
        <CharCounter current={value.length} max={PLATFORM_LIMITS.keywords} />
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        className={cn(
          'w-full rounded-md border bg-white px-3 py-2.5 text-sm text-brand-text font-mono',
          'focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary',
          'transition-all resize-y',
          value.length > PLATFORM_LIMITS.keywords && 'border-red-500',
        )}
        placeholder="Enter keywords separated by spaces or commas..."
      />
      {!keywords && (
        <p className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs text-violet-700">
          <Sparkles className="h-3 w-3 text-violet-500" />
          可在右侧 AI 助手面板点击「建议 keywords」获取候选词
        </p>
      )}
    </div>
  );
}

function StatusStepper({ status }: { status: string }) {
  const steps = [
    { key: 'draft', label: 'Draft', color: 'slate' },
    { key: 'review', label: 'Review', color: 'amber' },
    { key: 'active', label: 'Active', color: 'emerald' },
  ];

  const currentIdx = steps.findIndex((s) => s.key === status) ?? 0;
  const aiDraft = status === 'ai_draft';

  if (aiDraft) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
        ✨ AI Draft
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const isActive = i <= currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                isActive ? `bg-${step.color}-500` : 'bg-zinc-200',
              )}
            />
            <span
              className={cn(
                'text-[11px]',
                isActive ? 'text-brand-text font-medium' : 'text-zinc-400',
              )}
            >
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <div className={cn('h-px w-3', isActive ? 'bg-zinc-400' : 'bg-zinc-200')} />
            )}
          </div>
        );
      })}
    </div>
  );
}
