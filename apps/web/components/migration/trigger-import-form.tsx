'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { triggerPathAImport } from '@/lib/api/migration-client';
import type { PathAPlatformCode, TriggerPathAImportResult } from '@/lib/api/migration-client';
import { ImportJobProgress } from './import-job-progress';

interface TriggerImportFormProps {
  token: string;
  defaultBrandId?: string;
}

const BRANDS = [
  { value: 'homtone', label: 'Homtone' },
  { value: 'spoonlemon', label: 'Spoonlemon' },
] as const;

const PLATFORMS: { value: PathAPlatformCode; label: string }[] = [
  { value: 'amazon', label: 'Amazon' },
  { value: 'walmart', label: 'Walmart' },
];

export function TriggerImportForm({ token, defaultBrandId }: TriggerImportFormProps) {
  const [brandId, setBrandId] = useState(defaultBrandId ?? 'homtone');
  const [platformCode, setPlatformCode] = useState<PathAPlatformCode>('amazon');
  const [shopIds, setShopIds] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TriggerPathAImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);

    try {
      const ids = shopIds
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (ids.length === 0) {
        throw new Error('请至少输入一个店铺 ID');
      }

      const res = await triggerPathAImport(
        { brandId, marketCode: 'US', platformCode, shopIds: ids },
        token,
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '触发失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">品牌</label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary))]"
            >
              {BRANDS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">平台</label>
            <select
              value={platformCode}
              onChange={(e) => setPlatformCode(e.target.value as PathAPlatformCode)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary))]"
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            领星店铺 ID
            <span className="ml-1 text-zinc-400 font-normal">（多个用逗号或换行分隔）</span>
          </label>
          <textarea
            value={shopIds}
            onChange={(e) => setShopIds(e.target.value)}
            rows={3}
            placeholder="shop-001, shop-002"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary))]"
          />
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-md bg-[rgb(var(--brand-primary))] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? '提交中…' : '开始导入'}
        </button>
      </form>

      {result && (
        <div>
          <p className="mb-3 text-sm text-zinc-600">任务已提交，正在追踪进度…</p>
          <ImportJobProgress jobId={result.jobId} token={token} />
        </div>
      )}
    </div>
  );
}
