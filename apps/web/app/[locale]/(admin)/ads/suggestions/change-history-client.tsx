'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { rollbackAdChange, type AdChange, type ListResponse } from '@/lib/api/ad-suggestion-client';
import { useEntityRevalidation } from '@/lib/realtime/use-entity-revalidation';

const STATUS_BADGE: Record<string, string> = {
  executed: 'bg-emerald-100 text-emerald-800',
  rolled_back: 'bg-zinc-100 text-zinc-600',
};

const STATUS_LABEL: Record<string, string> = {
  executed: '已执行',
  rolled_back: '已回滚',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

export function AdChangeHistoryClient({
  accessToken,
  brandId,
  initialData,
  fetchError,
}: {
  accessToken: string;
  brandId: string;
  initialData: ListResponse<AdChange> | null;
  fetchError: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AdChange | null>(null);

  // Realtime: change history is read-only (operators only press 回滚 here),
  // so `auto` is appropriate. We listen on both `ad-change` (rollback) and
  // `ad-suggestion` (execute creates a new change row).
  const [showRefreshRibbon, setShowRefreshRibbon] = useState(false);
  useEntityRevalidation('ad-change', {
    mode: 'auto',
    onEvent: () => setShowRefreshRibbon(true),
  });
  useEntityRevalidation('ad-suggestion', {
    mode: 'auto',
    onEvent: () => setShowRefreshRibbon(true),
  });
  useEffect(() => {
    if (!showRefreshRibbon) {
      return;
    }
    const t = setTimeout(() => setShowRefreshRibbon(false), 5000);
    return () => clearTimeout(t);
  }, [showRefreshRibbon]);

  const records = initialData?.records ?? [];
  const now = Date.now();

  async function handleConfirmRollback() {
    if (!confirmTarget) {
      return;
    }
    const change = confirmTarget;
    setBusy(change.id);
    setFeedback(null);
    try {
      await rollbackAdChange(accessToken, brandId, change.id);
      setFeedback(`已回滚 campaign ${change.campaignId}`);
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : '回滚失败');
    } finally {
      setBusy(null);
      setConfirmTarget(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>变更历史</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          最近 {records.length} 条变更 · 24 小时内可回滚
        </p>
      </CardHeader>
      <CardContent>
        {fetchError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {fetchError}
          </div>
        )}
        {feedback && (
          <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            {feedback}
          </div>
        )}
        {showRefreshRibbon && (
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-3 py-1 text-xs text-violet-700">
            <Sparkles className="h-3 w-3 text-violet-500" />
            刚刚有新变更，已自动刷新
          </div>
        )}
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无变更记录。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr className="border-b border-zinc-200">
                  <th className="py-2 pr-4">Campaign</th>
                  <th className="py-2 pr-4">字段</th>
                  <th className="py-2 pr-4">变更</th>
                  <th className="py-2 pr-4">执行时间</th>
                  <th className="py-2 pr-4">回滚截止</th>
                  <th className="py-2 pr-4">状态</th>
                  <th className="py-2 pr-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((c) => {
                  const reversible =
                    c.status === 'executed' && new Date(c.reversibleBefore).getTime() > now;
                  return (
                    <tr key={c.id} className="border-b border-zinc-100">
                      <td className="py-2 pr-4 font-medium text-zinc-900">{c.campaignId}</td>
                      <td className="py-2 pr-4">{c.field}</td>
                      <td className="py-2 pr-4 text-xs">
                        <span className="text-zinc-500">{c.valueBefore ?? '—'}</span>
                        <span className="mx-1 text-zinc-400">→</span>
                        <span className="font-medium text-zinc-900">{c.valueAfter ?? '—'}</span>
                      </td>
                      <td className="py-2 pr-4 text-xs text-zinc-600">
                        {formatDate(c.executedAt)}
                      </td>
                      <td className="py-2 pr-4 text-xs text-zinc-600">
                        {formatDate(c.reversibleBefore)}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_BADGE[c.status] ?? 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {STATUS_LABEL[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        {reversible ? (
                          <button
                            type="button"
                            onClick={() => setConfirmTarget(c)}
                            disabled={busy === c.id}
                            className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                          >
                            {busy === c.id && <Loader2 className="h-3 w-3 animate-spin" />}
                            回滚
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <Dialog.Root
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setConfirmTarget(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
            <Dialog.Title className="text-base font-semibold text-zinc-900">
              确认回滚此变更？
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-zinc-600">
              {confirmTarget && (
                <>
                  Campaign <span className="font-medium">{confirmTarget.campaignId}</span> · 字段{' '}
                  <span className="font-medium">{confirmTarget.field}</span>
                  <br />
                  <span className="text-zinc-500">{confirmTarget.valueAfter ?? '—'}</span>
                  <span className="mx-1 text-zinc-400">→</span>
                  <span className="font-medium text-zinc-900">
                    {confirmTarget.valueBefore ?? '—'}
                  </span>
                </>
              )}
            </Dialog.Description>
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              MVP：本次回滚仅回退本地记录，不会推送至领星
              ERP。如需同步真实广告，请在领星后台手动恢复。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={busy !== null}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  取消
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleConfirmRollback}
                disabled={busy !== null}
                className="flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                确认回滚
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Card>
  );
}
