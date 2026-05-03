'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { getListingMatrix } from '@/lib/api/listing-client';
import type { ListingMatrixResult, ListingMatrixEntry } from '@/lib/api/listing-client';

interface Props {
  productId: string;
  accessToken: string;
  brandId: string;
}

const STRATEGY_LABELS: Record<string, string> = {
  primary: '主打策略',
  variant: '变体策略',
  bundle: '组合套装',
  keyword_grab: '关键词抢占',
  seasonal: '季节性推广',
  cohort_test: '差异化测试',
};

function SimilarityCell({ value, isSelf }: { value: number | undefined; isSelf: boolean }) {
  if (isSelf) {
    return (
      <td className="px-3 py-2 text-center text-xs text-zinc-300 bg-zinc-50 border border-zinc-100">
        —
      </td>
    );
  }
  if (value === undefined || value === null) {
    return (
      <td className="px-3 py-2 text-center text-xs text-zinc-400 border border-zinc-100">-</td>
    );
  }
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)));
  const opacity = Math.min(0.6, Math.max(0.06, value * 0.6));
  return (
    <td
      className="px-3 py-2 text-center text-xs font-medium border border-zinc-100 transition-colors"
      style={{ backgroundColor: `rgb(var(--brand-primary) / ${opacity})` }}
      title={`相似度 ${pct}%`}
    >
      {pct}%
    </td>
  );
}

function SimilarityMatrix({
  listings,
  matrix,
}: {
  listings: ListingMatrixEntry[];
  matrix: Record<string, Record<string, number>>;
}) {
  const withTitle = listings.filter((l) => l.title);

  if (withTitle.length === 0) {
    return (
      <p className="text-sm text-zinc-400 py-4">所有 Listing 暂无标题数据，无法生成相似度评分。</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left font-medium text-zinc-500 bg-zinc-50 border border-zinc-100 w-32">
              平台 / 店铺
            </th>
            {withTitle.map((l) => (
              <th
                key={l.id}
                className="px-3 py-2 text-left font-medium text-zinc-500 bg-zinc-50 border border-zinc-100 max-w-[120px]"
              >
                <span className="block truncate" title={`${l.platformCode} · ${l.shopName}`}>
                  {l.platformCode}
                </span>
                <span className="block truncate text-zinc-400 font-normal" title={l.shopName}>
                  {l.shopName.slice(0, 12)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {withTitle.map((rowL) => (
            <tr key={rowL.id}>
              <td className="px-3 py-2 border border-zinc-100 text-zinc-600 font-medium max-w-[120px]">
                <span className="block truncate" title={rowL.title ?? ''}>
                  {(rowL.title ?? '').slice(0, 24)}
                </span>
                <span className="block text-zinc-400 text-[10px]">
                  {rowL.platformCode} · {rowL.shopName.slice(0, 10)}
                </span>
              </td>
              {withTitle.map((colL) => (
                <SimilarityCell
                  key={colL.id}
                  isSelf={rowL.id === colL.id}
                  value={matrix[rowL.id]?.[colL.id]}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StrategyChart({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return <p className="text-sm text-zinc-400 py-2">暂无策略分布数据。</p>;
  }

  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-2">
      {entries.map(([strategy, count]) => {
        const pct = Math.round((count / total) * 100);
        const label = STRATEGY_LABELS[strategy] ?? strategy;
        return (
          <div key={strategy} className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 w-24 shrink-0 truncate" title={label}>
              {label}
            </span>
            <div className="flex-1 h-4 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500 w-10 text-right shrink-0">
              {count}（{pct}%）
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SummaryCards({ listings }: { listings: ListingMatrixEntry[] }) {
  const platformCounts = listings.reduce<Record<string, number>>((acc, l) => {
    acc[l.platformCode] = (acc[l.platformCode] ?? 0) + 1;
    return acc;
  }, {});
  const primaryListing = listings.find((l) => l.isPrimary);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-lg border bg-white p-3">
        <p className="text-xs text-zinc-500">Listing 总数</p>
        <p className="text-2xl font-semibold text-zinc-800 mt-1">{listings.length}</p>
      </div>
      {Object.entries(platformCounts).map(([platform, count]) => (
        <div key={platform} className="rounded-lg border bg-white p-3">
          <p className="text-xs text-zinc-500">{platform}</p>
          <p className="text-2xl font-semibold text-zinc-800 mt-1">{count}</p>
        </div>
      ))}
      <div className="rounded-lg border bg-white p-3">
        <p className="text-xs text-zinc-500">主 Listing</p>
        <p className="text-sm font-medium text-zinc-800 mt-1 truncate">
          {primaryListing
            ? `${primaryListing.platformCode} · ${primaryListing.shopName}`
            : '未设置'}
        </p>
      </div>
    </div>
  );
}

export function ListingMatrixDashboard({ productId, accessToken, brandId }: Props) {
  const [data, setData] = useState<ListingMatrixResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    getListingMatrix(accessToken, productId, brandId, controller.signal)
      .then(setData)
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? '加载失败，请重试。');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [accessToken, productId, brandId, retryCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-sm">正在加载矩阵分析数据…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-4">
        <span>加载失败：{error}</span>
        <button
          type="button"
          onClick={() => setRetryCount((n) => n + 1)}
          className="shrink-0 flex items-center gap-1.5 text-amber-700 hover:text-amber-900 font-medium"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          重试
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { listings, similarityMatrix, strategyDistribution, salesAvailableFrom } = data;

  const comparableCount = listings.filter((l) => l.title).length;
  if (comparableCount < 2) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <p className="text-sm text-zinc-500">
          {listings.length === 0
            ? '当前产品暂无 Listing。'
            : `当前产品有 ${listings.length} 条 Listing，但含标题且可对比的仅 ${comparableCount} 条。`}
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          至少需要 2 条含标题的 Listing 才可生成相似度评分。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SummaryCards listings={listings} />

      <div className="rounded-xl border bg-white p-5">
        <h3 className="text-sm font-semibold text-zinc-700 mb-4">相似度评分矩阵</h3>
        <SimilarityMatrix listings={listings} matrix={similarityMatrix} />
        <p className="text-xs text-zinc-400 mt-3">
          数值为两条 Listing 标题的语义相似度（0–100%），数值越高表示差异化空间越小。
        </p>
      </div>

      <div className="rounded-xl border bg-white p-5">
        <h3 className="text-sm font-semibold text-zinc-700 mb-4">差异化建议 — 策略分布</h3>
        <StrategyChart distribution={strategyDistribution} />
      </div>

      {salesAvailableFrom === 'S4' && (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-4 text-sm text-zinc-400">
          销售数据（曝光量 / 转化率对比）将于 S4 上线后可用。
        </div>
      )}
    </div>
  );
}
