'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  generateAdSuggestions,
  executeAdSuggestion,
  rejectAdSuggestion,
  type AdSuggestion,
  type ListResponse,
} from '@/lib/api/ad-suggestion-client';
import { useEntityRevalidation } from '@/lib/realtime/use-entity-revalidation';

const ACTION_LABELS: Record<string, string> = {
  increase_bid: '提高出价',
  decrease_bid: '降低出价',
  pause: '暂停广告',
  enable: '启用广告',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-blue-100 text-blue-800',
  rejected: 'bg-zinc-100 text-zinc-700',
  executed: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-zinc-100 text-zinc-500',
};

const STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  accepted: '已接受',
  rejected: '已拒绝',
  executed: '已执行',
  expired: '已过期',
};

interface ConfirmState {
  open: boolean;
  suggestion: AdSuggestion | null;
  action: 'execute' | 'reject' | null;
}

export function AdSuggestionListClient({
  accessToken,
  brandId,
  initialData,
  fetchError,
  shopIdFilter,
}: {
  accessToken: string;
  brandId: string;
  initialData: ListResponse<AdSuggestion> | null;
  fetchError: string | null;
  shopIdFilter?: string;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [shopInput, setShopInput] = useState(shopIdFilter ?? '');
  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false,
    suggestion: null,
    action: null,
  });
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Realtime: list page is read-mostly, so `auto` mode is safe — every
  // generate/execute/reject/rollback in another tab or by an agent
  // immediately re-runs the server fetch via router.refresh().
  //
  // We surface a transient "刚刚刷新" ribbon so users notice the page mutated
  // under them (otherwise silent updates erode trust — see ADR-011 §D3).
  const [showRefreshRibbon, setShowRefreshRibbon] = useState(false);
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

  async function handleGenerate() {
    if (!shopInput.trim()) {
      setFeedback('请输入 shopId 后再生成建议');
      return;
    }
    setGenerating(true);
    setFeedback(null);
    try {
      const res = await generateAdSuggestions(accessToken, brandId, { shopId: shopInput.trim() });
      setFeedback(res.message);
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : '生成建议失败');
    } finally {
      setGenerating(false);
    }
  }

  async function handleConfirm() {
    if (!confirm.suggestion || !confirm.action) {
      return;
    }
    setWorking(true);
    setFeedback(null);
    try {
      if (confirm.action === 'execute') {
        await executeAdSuggestion(accessToken, brandId, confirm.suggestion.id);
        setFeedback(`已执行：${confirm.suggestion.campaignName ?? confirm.suggestion.campaignId}`);
      } else {
        await rejectAdSuggestion(accessToken, brandId, confirm.suggestion.id);
        setFeedback(`已拒绝：${confirm.suggestion.campaignName ?? confirm.suggestion.campaignId}`);
      }
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : '操作失败');
    } finally {
      setWorking(false);
      setConfirm({ open: false, suggestion: null, action: null });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle>建议列表</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            共 {initialData?.total ?? 0} 条 · 仅显示前 {records.length} 条
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={shopInput}
            onChange={(e) => setShopInput(e.target.value)}
            placeholder="shopId"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary))]"
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !shopInput.trim()}
            className="flex items-center gap-2 rounded-md bg-[rgb(var(--brand-primary))] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {generating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            生成新建议
          </button>
        </div>
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
            刚刚收到新建议，已自动刷新
          </div>
        )}
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无建议。点击右上角"生成新建议"开始。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr className="border-b border-zinc-200">
                  <th className="py-2 pr-4">Campaign</th>
                  <th className="py-2 pr-4">建议动作</th>
                  <th className="py-2 pr-4">字段</th>
                  <th className="py-2 pr-4">当前值</th>
                  <th className="py-2 pr-4">建议值</th>
                  <th className="py-2 pr-4">原因</th>
                  <th className="py-2 pr-4">状态</th>
                  <th className="py-2 pr-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-4">
                      <div className="font-medium text-zinc-900">
                        {s.campaignName ?? s.campaignId}
                      </div>
                      <div className="text-xs text-zinc-500">{s.adType}</div>
                    </td>
                    <td className="py-2 pr-4">{ACTION_LABELS[s.actionType] ?? s.actionType}</td>
                    <td className="py-2 pr-4">{s.field}</td>
                    <td className="py-2 pr-4">{s.currentValue ?? '—'}</td>
                    <td className="py-2 pr-4 font-medium text-zinc-900">
                      {s.suggestedValue ?? '—'}
                    </td>
                    <td className="py-2 pr-4 max-w-xs text-xs text-zinc-600">{s.reason}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[s.status] ?? 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {s.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setConfirm({ open: true, suggestion: s, action: 'execute' })
                            }
                            className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            执行
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirm({ open: true, suggestion: s, action: 'reject' })
                            }
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            拒绝
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog.Root
        open={confirm.open}
        onOpenChange={(o) =>
          !o && !working && setConfirm({ open: false, suggestion: null, action: null })
        }
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-lg focus:outline-none">
            <Dialog.Title className="text-base font-semibold text-zinc-900">
              {confirm.action === 'execute' ? '确认执行此建议' : '确认拒绝此建议'}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-zinc-600">
              {confirm.suggestion && (
                <>
                  <strong>
                    {confirm.suggestion.campaignName ?? confirm.suggestion.campaignId}
                  </strong>
                  ：{ACTION_LABELS[confirm.suggestion.actionType] ?? confirm.suggestion.actionType}
                  {confirm.suggestion.suggestedValue !== null && (
                    <>
                      （{confirm.suggestion.field}：{confirm.suggestion.currentValue ?? '—'} →{' '}
                      {confirm.suggestion.suggestedValue}）
                    </>
                  )}
                  。
                  {confirm.action === 'execute' && (
                    <span className="mt-2 block text-xs text-amber-700">
                      ⚠ 执行后 24 小时内可回滚。MVP 阶段仅记录变更，未实际下推到 Lingxing。
                    </span>
                  )}
                </>
              )}
            </Dialog.Description>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirm({ open: false, suggestion: null, action: null })}
                disabled={working}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={working}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  confirm.action === 'reject'
                    ? 'bg-zinc-700 hover:bg-zinc-800'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {working && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {confirm.action === 'execute' ? '确认执行' : '确认拒绝'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Card>
  );
}
