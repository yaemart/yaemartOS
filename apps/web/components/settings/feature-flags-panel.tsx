'use client';

import { useState, useTransition } from 'react';
import type { SystemConfig } from '@/lib/api/settings-client';

const FLAG_LABELS: Record<string, string> = {
  'feature_flag.LISTING_AI': 'AI 生成 Listing',
  'feature_flag.GLM_GENERATION': 'GLM 模型路由',
  'feature_flag.LINGXING_SYNC': '领星数据同步',
  'feature_flag.PATH_A_IMPORT': '路径 A 数据导入',
};

const BRAND_IDS = ['homtone', 'spoonlemon', 'davivy', 'tysun'];

function getFlagLabel(key: string): string {
  return FLAG_LABELS[key] ?? key.replace('feature_flag.', '').replace(/_/g, ' ');
}

function isBrandScoped(key: string): boolean {
  return BRAND_IDS.some((b) => key.endsWith(`.${b}`));
}

function getBrandScope(key: string): string {
  for (const b of BRAND_IDS) {
    if (key.endsWith(`.${b}`)) {
      return b;
    }
  }
  return '';
}

function FlagRow({
  config,
  accessToken,
  onToggle,
}: {
  config: SystemConfig;
  accessToken: string;
  onToggle: (key: string, newValue: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const isOn = config.value === 'true';
  const brandScope = getBrandScope(config.key);

  function handleToggle() {
    startTransition(async () => {
      const { upsertFeatureFlag } = await import('@/lib/api/settings-client');
      await upsertFeatureFlag(
        accessToken,
        config.key,
        isOn ? 'false' : 'true',
        config.label ?? undefined,
      );
      onToggle(config.key, !isOn);
    });
  }

  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-zinc-900">{getFlagLabel(config.key)}</p>
        {brandScope && (
          <span className="mt-0.5 inline-block rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-500">
            {brandScope}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        disabled={isPending}
        onClick={handleToggle}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${isOn ? 'bg-[rgb(var(--brand-primary))]' : 'bg-zinc-200'}`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${isOn ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
}

export function FeatureFlagsPanel({
  accessToken,
  featureFlags: initialFlags,
}: {
  accessToken: string;
  featureFlags: SystemConfig[];
}) {
  const [flags, setFlags] = useState(initialFlags);

  const globalFlags = flags.filter((f) => !isBrandScoped(f.key));
  const brandFlags = flags.filter((f) => isBrandScoped(f.key));

  function handleToggle(key: string, newValue: boolean) {
    setFlags((prev) =>
      prev.map((f) => (f.key === key ? { ...f, value: newValue ? 'true' : 'false' } : f)),
    );
  }

  if (flags.length === 0) {
    return <div className="py-8 text-center text-sm text-zinc-400">无功能开关数据</div>;
  }

  return (
    <div className="space-y-0">
      <p className="pb-3 pt-4 text-xs font-medium uppercase tracking-wide text-zinc-400">
        全局开关
      </p>
      <div className="divide-y divide-zinc-100">
        {globalFlags.map((f) => (
          <FlagRow key={f.key} config={f} accessToken={accessToken} onToggle={handleToggle} />
        ))}
      </div>

      {brandFlags.length > 0 && (
        <>
          <p className="pb-3 pt-6 text-xs font-medium uppercase tracking-wide text-zinc-400">
            品牌级覆盖
          </p>
          <div className="divide-y divide-zinc-100">
            {brandFlags.map((f) => (
              <FlagRow key={f.key} config={f} accessToken={accessToken} onToggle={handleToggle} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
