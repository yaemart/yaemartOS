'use client';

import { useState, useTransition } from 'react';
import type { ShopItem, LingxingShop } from '@/lib/api/shop-client';

function BindDialog({
  shopId,
  lingxingShops,
  onBind,
  onCancel,
}: {
  shopId: string;
  lingxingShops: LingxingShop[];
  onBind: (shopId: string, lingxingShopId: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg">
        <h3 className="text-base font-semibold text-zinc-900">绑定领星店铺</h3>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="mt-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-[rgb(var(--brand-primary))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--brand-primary))]"
        >
          <option value="">选择领星店铺</option>
          {lingxingShops.map((ls) => (
            <option key={ls.id} value={ls.id}>
              {ls.name} ({ls.platform})
            </option>
          ))}
        </select>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => onBind(shopId, selected)}
            className="rounded-md bg-[rgb(var(--brand-primary))] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            绑定
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShopBindingList({
  shops,
  lingxingShops,
  capability,
  accessToken,
  brand,
}: {
  shops: ShopItem[];
  lingxingShops: LingxingShop[];
  capability?: string[];
  accessToken: string;
  brand?: string;
}) {
  const [items, setItems] = useState(shops);
  const [bindingShopId, setBindingShopId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canWrite = !capability || capability.includes('shops:write');

  const handleToggleSync = (shopId: string, currentValue: boolean) => {
    startTransition(async () => {
      const { toggleSync } = await import('@/lib/api/shop-client');
      const updated = await toggleSync(accessToken, shopId, !currentValue, brand);
      setItems((prev) => prev.map((s) => (s.id === shopId ? { ...s, binding: updated } : s)));
    });
  };

  const handleBind = (shopId: string, lingxingShopId: string) => {
    startTransition(async () => {
      const { bindShop } = await import('@/lib/api/shop-client');
      const binding = await bindShop(accessToken, shopId, { lingxingShopId }, brand);
      setItems((prev) => prev.map((s) => (s.id === shopId ? { ...s, binding } : s)));
      setBindingShopId(null);
    });
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-20 text-center">
        <p className="text-base font-medium text-zinc-600">暂无店铺</p>
        <p className="mt-1 text-sm text-zinc-400">还没有找到任何店铺数据</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">店铺名称</th>
              <th className="px-4 py-3">品牌</th>
              <th className="px-4 py-3">平台</th>
              <th className="px-4 py-3">领星店铺 ID</th>
              <th className="px-4 py-3">同步状态</th>
              {canWrite && <th className="px-4 py-3">操作</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((shop) => (
              <tr key={shop.id} className="border-t border-zinc-100">
                <td className="px-4 py-3 font-medium text-zinc-900">{shop.name}</td>
                <td className="px-4 py-3 text-zinc-600">{shop.brandId}</td>
                <td className="px-4 py-3 text-zinc-600">{shop.platform}</td>
                <td className="px-4 py-3 text-zinc-600">
                  {shop.binding ? (
                    <span className="font-mono text-xs">{shop.binding.lingxingShopId}</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                      未绑定
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {shop.binding && canWrite ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={shop.binding.syncEnabled}
                      disabled={isPending}
                      onClick={() => handleToggleSync(shop.id, shop.binding!.syncEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
                        shop.binding.syncEnabled ? 'bg-[rgb(var(--brand-primary))]' : 'bg-zinc-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                          shop.binding.syncEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                        }`}
                      />
                    </button>
                  ) : shop.binding && !canWrite ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        shop.binding.syncEnabled
                          ? 'bg-green-50 text-green-700'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {shop.binding.syncEnabled ? '已开启' : '已关闭'}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </td>
                {canWrite && (
                  <td className="px-4 py-3">
                    {!shop.binding ? (
                      <button
                        type="button"
                        onClick={() => setBindingShopId(shop.id)}
                        className="text-sm text-[rgb(var(--brand-primary))] hover:underline"
                      >
                        绑定
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-400">已绑定</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bindingShopId && (
        <BindDialog
          shopId={bindingShopId}
          lingxingShops={lingxingShops}
          onBind={handleBind}
          onCancel={() => setBindingShopId(null)}
        />
      )}
    </>
  );
}
