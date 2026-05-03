'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { getPathAImportJob } from '@/lib/api/migration-client';
import type { PathAImportJobDetail } from '@/lib/api/migration-client';

interface ImportJobProgressProps {
  jobId: string;
  token: string;
  onComplete?: (job: PathAImportJobDetail) => void;
}

const STATUS_CONFIG = {
  waiting: {
    icon: Clock,
    color: 'text-amber-500',
    bg: 'bg-amber-50 border-amber-200',
    label: '等待中',
  },
  active: {
    icon: Loader2,
    color: 'text-blue-500',
    bg: 'bg-blue-50 border-blue-200',
    label: '导入中',
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bg: 'bg-green-50 border-green-200',
    label: '已完成',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50 border-red-200',
    label: '失败',
  },
} as const;

const M07_THRESHOLD = 85;

function QualityReport({ imported, failed }: { imported: number; failed: number }) {
  const total = imported + failed;
  if (total === 0) {
    return <p className="mt-2 text-xs text-zinc-500">本次无数据导入。</p>;
  }
  const rate = Math.round((imported / total) * 100);
  const passes = rate >= M07_THRESHOLD;

  return (
    <div className="mt-3 rounded-md border border-zinc-200 bg-white/60 p-3">
      <p className="mb-2 text-xs font-semibold text-zinc-700">质量报告</p>
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#e4e4e7" strokeWidth="4" />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke={passes ? '#22c55e' : '#f59e0b'}
              strokeWidth="4"
              strokeDasharray={`${(rate / 100) * 87.96} 87.96`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-zinc-700">
            {rate}%
          </span>
        </div>
        <div className="flex flex-col gap-1 text-xs text-zinc-600">
          <span>
            成功 <strong className="text-green-700">{imported}</strong> / 失败{' '}
            <strong className="text-red-600">{failed}</strong> / 共 {total}
          </span>
          <span
            className={`inline-flex items-center gap-1 font-medium ${passes ? 'text-green-700' : 'text-amber-600'}`}
          >
            {passes ? '✓ 准确率达标 ≥ M-07 (85%)' : '⚠ 准确率未达 M-07 基线 (85%)'}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ImportJobProgress({ jobId, token, onComplete }: ImportJobProgressProps) {
  const [job, setJob] = useState<PathAImportJobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    try {
      const data = await getPathAImportJob(jobId, token);
      setJob(data);
      if (data.status === 'completed' || data.status === 'failed') {
        onComplete?.(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法获取任务状态');
    }
  }, [jobId, token, onComplete]);

  useEffect(() => {
    fetchJob();
    const isTerminal = job?.status === 'completed' || job?.status === 'failed';
    if (isTerminal) {
      return;
    }

    const interval = setInterval(fetchJob, 3000);
    return () => clearInterval(interval);
  }, [fetchJob, job?.status]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>加载任务状态…</span>
      </div>
    );
  }

  const config = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.waiting;
  const Icon = config.icon;
  const isActive = job.status === 'active';

  return (
    <div className={`rounded-lg border p-4 ${config.bg}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${config.color} ${isActive ? 'animate-spin' : ''}`} />
          <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
        </div>
        <span className="text-xs text-zinc-400">{job.progress}%</span>
      </div>

      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-white/60">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            job.status === 'completed'
              ? 'bg-green-500'
              : job.status === 'failed'
                ? 'bg-red-500'
                : 'bg-blue-500'
          }`}
          style={{ width: `${job.progress}%` }}
        />
      </div>

      {job.status === 'completed' && job.imported != null && job.failed != null && (
        <QualityReport imported={job.imported} failed={job.failed} />
      )}

      {job.status !== 'completed' && (job.imported != null || job.failed != null) && (
        <div className="flex gap-4 text-xs text-zinc-600">
          {job.imported != null && (
            <span>
              导入成功：<strong>{job.imported}</strong>
            </span>
          )}
          {job.failed != null && job.failed > 0 && (
            <span className="text-red-600">
              失败：<strong>{job.failed}</strong>
            </span>
          )}
        </div>
      )}

      {job.error && <p className="mt-2 text-xs text-red-600">错误：{job.error}</p>}

      {job.failures && job.failures.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700">
            查看失败详情（{job.failures.length} 条）
          </summary>
          <ul className="mt-2 space-y-1">
            {job.failures.slice(0, 10).map((f) => (
              <li key={f.sku} className="text-xs text-zinc-600">
                <code className="rounded bg-white/60 px-1">{f.sku}</code> — {f.reason}
              </li>
            ))}
            {job.failures.length > 10 && (
              <li className="text-xs text-zinc-400">…还有 {job.failures.length - 10} 条</li>
            )}
          </ul>
        </details>
      )}

      <p className="mt-2 text-xs text-zinc-400">
        任务 ID: <code>{job.jobId}</code>
      </p>
    </div>
  );
}
