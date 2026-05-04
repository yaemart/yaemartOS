'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { rollbackAdChange, type AdChange, type ListResponse } from '@/lib/api/ad-suggestion-client';

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

  const records = initialData?.records ?? [];
  const now = Date.now();

  async function handleRollback(change: AdChange) {
    if (!confirm(`确认回滚 campaign ${change.campaignId} 的变更？`)) {
      return;
    }
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
                            onClick={() => handleRollback(c)}
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
    </Card>
  );
}
