'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { listPathAImportJobs } from '@/lib/api/migration-client';
import type { JobListResponse, PathAImportJobSummary } from '@/lib/api/migration-client';
import { useEntityRevalidation } from '@/lib/realtime/use-entity-revalidation';

interface RecentJobsTableProps {
  token: string;
  initialJobs: PathAImportJobSummary[];
}

const RIBBON_TIMEOUT_MS = 5_000;

function flattenJobs(list: JobListResponse | null): PathAImportJobSummary[] {
  if (!list) {
    return [];
  }
  return [
    ...(list.active ?? []),
    ...(list.waiting ?? []),
    ...(list.completed ?? []),
    ...(list.failed ?? []),
  ].slice(0, 20);
}

export function RecentJobsTable({ token, initialJobs }: RecentJobsTableProps) {
  const [jobs, setJobs] = useState<PathAImportJobSummary[]>(initialJobs);
  const [showRibbon, setShowRibbon] = useState(false);

  const reload = useCallback(async () => {
    try {
      const list = await listPathAImportJobs(token);
      setJobs(flattenJobs(list));
    } catch {
      // ignore — keep showing the previous snapshot
    }
  }, [token]);

  // Auto mode: import jobs are read-only here, so refresh silently and
  // surface a brief ribbon the user can see if they happen to glance at
  // the page. No edit-protection concerns.
  useEntityRevalidation('migration-job', {
    mode: 'auto',
    onEvent: () => {
      setShowRibbon(true);
      void reload();
    },
  });

  useEffect(() => {
    if (!showRibbon) {
      return;
    }
    const timer = setTimeout(() => setShowRibbon(false), RIBBON_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [showRibbon]);

  if (jobs.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-700">最近任务</h2>
        {showRibbon && (
          <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
            <Sparkles className="h-3 w-3" />
            <span>导入任务已自动刷新</span>
          </div>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs text-zinc-500">
              <th className="px-4 py-3 font-medium">品牌</th>
              <th className="px-4 py-3 font-medium">平台</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">进度</th>
              <th className="px-4 py-3 font-medium">创建时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {jobs.map((job) => (
              <tr key={job.jobId} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium capitalize">{job.brandId}</td>
                <td className="px-4 py-3 capitalize">{job.platformCode}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      job.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : job.status === 'active'
                          ? 'bg-blue-100 text-blue-700'
                          : job.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {job.status === 'completed'
                      ? '已完成'
                      : job.status === 'active'
                        ? '导入中'
                        : job.status === 'failed'
                          ? '失败'
                          : '等待中'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={`h-full rounded-full ${
                          job.status === 'completed'
                            ? 'bg-green-500'
                            : job.status === 'failed'
                              ? 'bg-red-400'
                              : 'bg-blue-500'
                        }`}
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-zinc-500">{job.progress}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">
                  {new Date(job.createdAt).toLocaleString('zh-CN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
        <RefreshCw className="h-3 w-3" />
        实时更新（任务事件触发自动刷新）
      </div>
    </section>
  );
}
