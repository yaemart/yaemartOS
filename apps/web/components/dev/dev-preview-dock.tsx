'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Tablet, Smartphone, Settings, Globe, Eye, Keyboard, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useDevPreview,
  type Locale,
  type Viewport,
  type ViewMode,
} from '@/providers/dev-preview-provider';
import type { Brand } from '@/providers/brand-provider';

const VIEW_PRESETS: {
  key: string;
  label: string;
  shortcut: string;
  mode: ViewMode;
  brand: Brand;
  dot: string;
}[] = [
  {
    key: 'admin',
    label: 'Admin',
    shortcut: '1',
    mode: 'admin',
    brand: 'homtone',
    dot: 'bg-zinc-700',
  },
  {
    key: 'homtone',
    label: 'Homtone',
    shortcut: '2',
    mode: 'portal',
    brand: 'homtone',
    dot: 'bg-amber-500',
  },
  {
    key: 'spoonlemon',
    label: 'Spoonlemon',
    shortcut: '3',
    mode: 'portal',
    brand: 'spoonlemon',
    dot: 'bg-emerald-500',
  },
  {
    key: 'davivy',
    label: 'Davivy',
    shortcut: '4',
    mode: 'portal',
    brand: 'davivy',
    dot: 'bg-zinc-800',
  },
  {
    key: 'tysun',
    label: 'Tysun',
    shortcut: '5',
    mode: 'portal',
    brand: 'tysun',
    dot: 'bg-blue-600',
  },
];

const LOCALES: { id: Locale; label: string }[] = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'EN' },
  { id: 'es', label: 'ES' },
  { id: 'fr', label: 'FR' },
  { id: 'de', label: 'DE' },
  { id: 'it', label: 'IT' },
];

const VIEWPORTS: { id: Viewport; icon: typeof Monitor; label: string; width: string }[] = [
  { id: 'desktop', icon: Monitor, label: '桌面', width: '100%' },
  { id: 'tablet', icon: Tablet, label: '平板', width: '768px' },
  { id: 'mobile', icon: Smartphone, label: '手机', width: '375px' },
];

export function DevPreviewDock() {
  const { state, setMode, setBrand, setLocale, setViewport, switchTo } = useDevPreview();
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(true);

  const activePreset = state.mode === 'admin' ? 'admin' : state.brand;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.metaKey && !e.ctrlKey) {
        return;
      }

      const num = parseInt(e.key);
      if (num >= 1 && num <= 5) {
        e.preventDefault();
        const preset = VIEW_PRESETS[num - 1];
        switchTo({
          mode: preset.mode,
          brand: preset.brand,
          locale: preset.mode === 'admin' ? 'zh' : 'en',
          viewport: state.viewport,
        });
      }

      if (e.key === '`') {
        e.preventDefault();
        setVisible((v) => !v);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.viewport, switchTo]);

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] h-6 w-6 rounded-full bg-zinc-900/60 flex items-center justify-center hover:bg-zinc-900/90 transition-colors"
        title="显示 Dev Dock (⌘`)"
      >
        <Eye className="h-3 w-3 text-white/70" />
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-[100]',
        'rounded-2xl border border-white/10 bg-zinc-900/85 backdrop-blur-xl shadow-2xl',
        'transition-opacity duration-200',
        !expanded && 'hover:opacity-100 opacity-80',
      )}
    >
      {/* Compact Bar */}
      <div className="flex items-center gap-1 px-3 py-2">
        {/* View Presets */}
        <div className="flex items-center gap-0.5">
          {VIEW_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() =>
                switchTo({
                  mode: preset.mode,
                  brand: preset.brand,
                  locale:
                    preset.mode === 'admin'
                      ? 'zh'
                      : state.locale === 'zh' && preset.mode === 'portal'
                        ? 'en'
                        : state.locale,
                  viewport: state.viewport,
                })
              }
              title={`${preset.label} (⌘${preset.shortcut})`}
              className={cn(
                'relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                activePreset === preset.key
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5',
              )}
            >
              <div className={cn('h-2 w-2 rounded-full', preset.dot)} />
              <span>{preset.label}</span>
              <kbd className="ml-0.5 text-[9px] text-white/30 font-mono">{preset.shortcut}</kbd>
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="mx-2 h-5 w-px bg-white/10" />

        {/* Locale */}
        <div className="flex items-center gap-0.5">
          <Globe className="mr-1 h-3 w-3 text-white/40" />
          {LOCALES.filter((l) => (state.mode === 'admin' ? l.id === 'zh' : true)).map((locale) => (
            <button
              key={locale.id}
              onClick={() => setLocale(locale.id)}
              className={cn(
                'rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors',
                state.locale === locale.id
                  ? 'bg-white/15 text-white'
                  : 'text-white/40 hover:text-white/70',
              )}
            >
              {locale.label}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="mx-2 h-5 w-px bg-white/10" />

        {/* Viewport */}
        <div className="flex items-center gap-0.5">
          {VIEWPORTS.map((vp) => {
            const Icon = vp.icon;
            return (
              <button
                key={vp.id}
                onClick={() => setViewport(vp.id)}
                title={`${vp.label} (${vp.width})`}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  state.viewport === vp.id
                    ? 'bg-white/15 text-white'
                    : 'text-white/40 hover:text-white/70',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>

        {/* Separator */}
        <div className="mx-2 h-5 w-px bg-white/10" />

        {/* Hide */}
        <button
          onClick={() => setVisible(false)}
          title="隐藏 (⌘`)"
          className="rounded-md p-1.5 text-white/30 hover:text-white/60 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Status line */}
      <div className="border-t border-white/5 px-3 py-1">
        <p className="text-[10px] text-white/30 text-center tabular-nums">
          {state.mode === 'admin' ? '运营后台' : `${state.brand} 客服门户`}
          {' · '}
          {LOCALES.find((l) => l.id === state.locale)?.label}
          {' · '}
          {VIEWPORTS.find((v) => v.id === state.viewport)?.width}
          <span className="ml-2">
            <Keyboard className="inline h-2.5 w-2.5" /> ⌘1-5 切换 · ⌘` 隐藏
          </span>
        </p>
      </div>
    </motion.div>
  );
}
