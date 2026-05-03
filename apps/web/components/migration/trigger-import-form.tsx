'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { triggerPathAImport, listAvailableShops } from '@/lib/api/migration-client';
import type {
  PathAPlatformCode,
  TriggerPathAImportResult,
  AvailableShop,
} from '@/lib/api/migration-client';
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
  const params = useParams<{ locale?: string }>();
  const localePrefix = params?.locale ? `/${params.locale}` : '';

  const [brandId, setBrandId] = useState(defaultBrandId ?? 'homtone');
  const [platformCode, setPlatformCode] = useState<PathAPlatformCode>('amazon');
  const [availableShops, setAvailableShops] = useState<AvailableShop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsError, setShopsError] = useState<string | null>(null);
  const [selectedShopIds, setSelectedShopIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TriggerPathAImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setShopsLoading(true);
    setShopsError(null);
    setSelectedShopIds([]);

    listAvailableShops(token, brandId, platformCode, controller.signal)
      .then((shops) => setAvailableShops(shops))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setShopsError('无法加载店铺列表，请检查网络或重试');
        setAvailableShops([]);
      })
      .finally(() => setShopsLoading(false));

    return () => controller.abort();
  }, [token, brandId, platformCode]);

  const allSelected = availableShops.length > 0 && selectedShopIds.length === availableShops.length;
  const toggleAll = () => {
    setSelectedShopIds(allSelected ? [] : availableShops.map((s) => s.lingxingShopId));
  };
  const toggleShop = (id: string) => {
    setSelectedShopIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (selectedShopIds.length === 0) {
      setError('请至少选择一个店铺');
      return;
    }

    setSubmitting(true);
    try {
      const res = await triggerPathAImport(
        { brandId, marketCode: 'US', platformCode, shopIds: selectedShopIds },
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
              onChange={(e) => {
                setBrandId(e.target.value);
                setResult(null);
              }}
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
              onChange={(e) => {
                setPlatformCode(e.target.value as PathAPlatformCode);
                setResult(null);
              }}
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
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700">
              选择店铺
              {availableShops.length > 0 && (
                <span className="ml-1 font-normal text-zinc-400">
                  （{availableShops.length} 个已绑定领星）
                </span>
              )}
            </label>
            {availableShops.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-[rgb(var(--brand-primary))] hover:underline"
              >
                {allSelected ? '取消全选' : '全选'}
              </button>
            )}
          </div>

          {shopsLoading ? (
            <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>加载店铺列表…</span>
            </div>
          ) : shopsError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              {shopsError}
            </div>
          ) : availableShops.length === 0 ? (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500">
              该品牌+平台下暂无绑定领星 ID 的店铺。请先在{' '}
              <a href={`${localePrefix}/shops`} className="underline">
                店铺管理
              </a>{' '}
              页面绑定领星店铺。
            </div>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-zinc-200 bg-white p-2">
              {availableShops.map((shop) => (
                <label
                  key={shop.lingxingShopId}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedShopIds.includes(shop.lingxingShopId)}
                    onChange={() => toggleShop(shop.lingxingShopId)}
                    className="h-4 w-4 rounded border-zinc-300 accent-[rgb(var(--brand-primary))]"
                  />
                  <span className="flex-1 text-zinc-700">{shop.shopName}</span>
                  <span className="text-xs text-zinc-400">
                    {shop.platformName} · {shop.marketName}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || selectedShopIds.length === 0}
          className="flex items-center gap-2 rounded-md bg-[rgb(var(--brand-primary))] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting
            ? '提交中…'
            : `开始导入${selectedShopIds.length > 0 ? `（${selectedShopIds.length} 个店铺）` : ''}`}
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
