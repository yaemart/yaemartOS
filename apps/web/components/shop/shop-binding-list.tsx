'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Loader2 } from 'lucide-react';
import type { ShopItem, LingxingShop } from '@/lib/api/shop-client';

// ---------------------------------------------------------------------------
// Shared confirmation dialog (replaces shadcn AlertDialog)
// ---------------------------------------------------------------------------
function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-lg focus:outline-none">
          <Dialog.Title className="text-base font-semibold text-zinc-900">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-zinc-600">
            {description}
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                destructive
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-[rgb(var(--brand-primary))] hover:opacity-90'
              }`}
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Bind dialog — select a Lingxing shop before confirming
// ---------------------------------------------------------------------------
function BindDialog({
  shopId,
  shopName,
  lingxingShops,
  onBind,
  onCancel,
}: {
  shopId: string;
  shopName: string;
  lingxingShops: LingxingShop[];
  onBind: (shopId: string, lingxingShopId: string, lingxingShopName: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState('');
  const [confirming, setConfirming] = useState(false);

  const selectedShop = lingxingShops.find((s) => s.shopId === selected);

  return (
    <>
      <Dialog.Root open onOpenChange={(o) => !o && !confirming && onCancel()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-40 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-lg focus:outline-none">
            <Dialog.Title className="text-base font-semibold text-zinc-900">
              绑定领星店铺
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-zinc-500">
              为「{shopName}」选择对应的领星店铺
            </Dialog.Description>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-[rgb(var(--brand-primary))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--brand-primary))]"
            >
              <option value="">选择领星店铺…</option>
              {lingxingShops.map((ls) => (
                <option key={ls.shopId} value={ls.shopId}>
                  {ls.shopName}
                  {!ls.isActive && ' (已停用)'}
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
                onClick={() => setConfirming(true)}
                className="rounded-md bg-[rgb(var(--brand-primary))] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                下一步
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {confirming && selectedShop && (
        <ConfirmDialog
          open
          title="确认绑定"
          description={`将「${shopName}」绑定至领星店铺「${selectedShop.shopName}」？数据同步将在下次调度时启动。`}
          confirmLabel="确认绑定"
          onConfirm={() => onBind(shopId, selectedShop.shopId, selectedShop.shopName)}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
type PendingAction =
  | { type: 'unbind'; shopId: string; shopName: string }
  | { type: 'toggleSync'; shopId: string; shopName: string; nextValue: boolean };

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
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canWrite = !capability || capability.includes('shops:write');

  const bindingShop = bindingShopId ? items.find((s) => s.id === bindingShopId) : null;

  const handleBind = async (shopId: string, lingxingShopId: string, _lingxingShopName: string) => {
    setLoading(true);
    setError(null);
    try {
      const { bindShop } = await import('@/lib/api/shop-client');
      const binding = await bindShop(accessToken, shopId, { lingxingShopId }, brand);
      setItems((prev) => prev.map((s) => (s.id === shopId ? { ...s, binding } : s)));
      setBindingShopId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '绑定失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (pendingAction.type === 'unbind') {
        const { unbindShop } = await import('@/lib/api/shop-client');
        const binding = await unbindShop(accessToken, pendingAction.shopId, brand);
        setItems((prev) =>
          prev.map((s) => (s.id === pendingAction.shopId ? { ...s, binding } : s)),
        );
      } else {
        const { toggleSync } = await import('@/lib/api/shop-client');
        const binding = await toggleSync(
          accessToken,
          pendingAction.shopId,
          pendingAction.nextValue,
          brand,
        );
        setItems((prev) =>
          prev.map((s) => (s.id === pendingAction.shopId ? { ...s, binding } : s)),
        );
      }
      setPendingAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const confirmDialogProps = pendingAction
    ? pendingAction.type === 'unbind'
      ? {
          title: '确认解绑',
          description: `解除「${pendingAction.shopName}」的领星绑定？同步将停止，已有数据保留。`,
          confirmLabel: '确认解绑',
          destructive: true as const,
        }
      : {
          title: `确认${pendingAction.nextValue ? '启用' : '停止'}同步`,
          description: `「${pendingAction.shopName}」的数据同步将${pendingAction.nextValue ? '立即启用' : '停止'}。`,
          confirmLabel: pendingAction.nextValue ? '启用同步' : '停止同步',
          destructive: false as const,
        }
    : null;

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
      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">店铺名称</th>
              <th className="px-4 py-3">平台</th>
              <th className="px-4 py-3">市场</th>
              <th className="px-4 py-3">领星店铺</th>
              <th className="px-4 py-3">同步状态</th>
              {canWrite && <th className="px-4 py-3">操作</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((shop) => (
              <tr key={shop.id} className="border-t border-zinc-100">
                <td className="px-4 py-3 font-medium text-zinc-900">{shop.name}</td>
                <td className="px-4 py-3 text-zinc-600">{shop.platform?.name ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-600">{shop.market?.name ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-600">
                  {shop.binding?.lingxingShopId ? (
                    <span className="font-mono text-xs">{shop.binding.lingxingShopId}</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                      未绑定
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {shop.binding?.lingxingShopId && canWrite ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={shop.binding.syncEnabled}
                      disabled={loading}
                      onClick={() =>
                        setPendingAction({
                          type: 'toggleSync',
                          shopId: shop.id,
                          shopName: shop.name,
                          nextValue: !shop.binding!.syncEnabled,
                        })
                      }
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
                  ) : shop.binding?.lingxingShopId && !canWrite ? (
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
                    <div className="flex items-center gap-3">
                      {!shop.binding?.lingxingShopId ? (
                        <button
                          type="button"
                          onClick={() => setBindingShopId(shop.id)}
                          className="text-sm text-[rgb(var(--brand-primary))] hover:underline"
                        >
                          绑定
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() =>
                            setPendingAction({
                              type: 'unbind',
                              shopId: shop.id,
                              shopName: shop.name,
                            })
                          }
                          className="text-sm text-red-500 hover:underline disabled:opacity-50"
                        >
                          解绑
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bindingShopId && bindingShop && (
        <BindDialog
          shopId={bindingShopId}
          shopName={bindingShop.name}
          lingxingShops={lingxingShops}
          onBind={handleBind}
          onCancel={() => setBindingShopId(null)}
        />
      )}

      {pendingAction && confirmDialogProps && (
        <ConfirmDialog
          open
          {...confirmDialogProps}
          loading={loading}
          onConfirm={handleConfirmAction}
          onCancel={() => {
            if (!loading) {
              setPendingAction(null);
            }
          }}
        />
      )}
    </>
  );
}
