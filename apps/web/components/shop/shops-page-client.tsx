'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { useBrand } from '@/providers/brand-provider';
import { listShops, listLingxingShops } from '@/lib/api/shop-client';
import type { ShopItem, LingxingShop } from '@/lib/api/shop-client';
import { useEntityRevalidation } from '@/lib/realtime/use-entity-revalidation';
import { ShopBindingList } from './shop-binding-list';

interface ShopsPageClientProps {
  accessToken: string;
}

export function ShopsPageClient({ accessToken }: ShopsPageClientProps) {
  const { brand } = useBrand();
  const [shops, setShops] = useState<ShopItem[]>([]);
  const [lingxingShops, setLingxingShops] = useState<LingxingShop[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        listShops(accessToken, brand).catch(() => []),
        listLingxingShops(accessToken, brand).catch(() => []),
      ]);
      setShops(s);
      setLingxingShops(l);
    } finally {
      setLoading(false);
    }
  }, [accessToken, brand]);

  useEffect(() => {
    load();
  }, [load]);

  const { pendingEvents, dismissPending } = useEntityRevalidation('shop-binding', {
    mode: 'toast',
  });
  const newestPending = pendingEvents[pendingEvents.length - 1] ?? null;
  const pendingCount = pendingEvents.length;

  const applyPending = useCallback(() => {
    dismissPending();
    void load();
  }, [dismissPending, load]);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">店铺管理</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {loading ? '加载中…' : `共 ${shops.length} 个店铺`}
          </p>
        </div>
      </div>

      {newestPending && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span>
              {newestPending.actorType === 'agent' ? 'AI Agent' : '其他用户'} 已修改店铺绑定
              {pendingCount > 1 ? `（共 ${pendingCount} 项）` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={applyPending}
              className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
            >
              <RefreshCw className="h-3 w-3" />
              刷新
            </button>
            <button
              type="button"
              onClick={dismissPending}
              aria-label="忽略"
              className="rounded-md p-1 text-amber-700 hover:bg-amber-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-zinc-400">加载中…</div>
      ) : (
        <ShopBindingList
          key={brand}
          shops={shops}
          lingxingShops={lingxingShops}
          accessToken={accessToken}
          brand={brand}
        />
      )}
    </div>
  );
}
