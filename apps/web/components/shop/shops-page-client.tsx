'use client';

import { useEffect, useState, useCallback } from 'react';
import { useBrand } from '@/providers/brand-provider';
import { listShops, listLingxingShops } from '@/lib/api/shop-client';
import type { ShopItem, LingxingShop } from '@/lib/api/shop-client';
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
