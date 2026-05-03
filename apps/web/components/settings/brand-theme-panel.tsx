'use client';

import { useState, useTransition } from 'react';
import type { BrandTheme } from '@/lib/api/settings-client';

const PRESET_COLORS = [
  '#b45309',
  '#d97706',
  '#ca8a04',
  '#16a34a',
  '#059669',
  '#0d9488',
  '#7c3aed',
  '#9333ea',
  '#c026d3',
  '#0284c7',
  '#0369a1',
  '#1d4ed8',
  '#dc2626',
  '#e11d48',
  '#be123c',
  '#374151',
  '#1f2937',
  '#111827',
];

function BrandCard({ brand, accessToken }: { brand: BrandTheme; accessToken: string }) {
  const [themeColor, setThemeColor] = useState(brand.themeColor ?? '#374151');
  const [name, setName] = useState(brand.name);
  const [logoUrl, setLogoUrl] = useState(brand.logoUrl ?? '');
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function handleSave() {
    setError('');
    startTransition(async () => {
      try {
        const { updateBrandTheme } = await import('@/lib/api/settings-client');
        await updateBrandTheme(accessToken, brand.id, {
          themeColor,
          logoUrl: logoUrl || undefined,
          name,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : '保存失败');
      }
    });
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg shadow-sm" style={{ backgroundColor: themeColor }} />
        <div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="block w-full rounded border-0 bg-transparent text-sm font-semibold text-zinc-900 focus:outline-none"
          />
          <p className="font-mono text-xs text-zinc-400">{brand.slug}</p>
        </div>
      </div>

      <div className="mb-3">
        <p className="mb-1.5 text-xs text-zinc-500">主题色</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setThemeColor(c)}
              className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${themeColor === c ? 'ring-2 ring-offset-1 ring-zinc-900' : ''}`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          <input
            type="color"
            value={themeColor}
            onChange={(e) => setThemeColor(e.target.value)}
            className="h-6 w-6 cursor-pointer rounded-full border-0 p-0"
            title="自定义颜色"
          />
        </div>
      </div>

      <div className="mb-3">
        <p className="mb-1 text-xs text-zinc-500">Logo URL</p>
        <input
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://..."
          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none"
        />
      </div>

      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {saved ? '已保存 ✓' : '保存'}
      </button>
    </div>
  );
}

export function BrandThemePanel({
  accessToken,
  brands,
}: {
  accessToken: string;
  brands: BrandTheme[];
}) {
  if (brands.length === 0) {
    return <div className="py-8 text-center text-sm text-zinc-400">无品牌数据</div>;
  }

  return (
    <div>
      <p className="pb-3 pt-4 text-xs font-medium uppercase tracking-wide text-zinc-400">
        4 品牌主题色与 Logo
      </p>
      <div className="grid grid-cols-2 gap-3">
        {brands.map((b) => (
          <BrandCard key={b.id} brand={b} accessToken={accessToken} />
        ))}
      </div>
    </div>
  );
}
