import { requireAuth } from '@/lib/auth/route-guard';
import { TriggerImportForm } from '@/components/migration/trigger-import-form';
import { listPathAImportJobs } from '@/lib/api/migration-client';

export default async function MigrationPage({ params }: { params: { locale: string } }) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    return null;
  }

  let jobList = null;
  try {
    jobList = await listPathAImportJobs(guard.accessToken);
  } catch {
    // API may not be up during build; suppress error
  }

  const allJobs = [
    ...(jobList?.active ?? []),
    ...(jobList?.waiting ?? []),
    ...(jobList?.completed ?? []),
    ...(jobList?.failed ?? []),
  ].slice(0, 20);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">数据导入</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          路径 A — 领星 ERP → AI 解析 → 产品档案，覆盖 Homtone + Spoonlemon × Amazon + Walmart
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-zinc-700">触发新一轮导入</h2>
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <TriggerImportForm token={guard.accessToken} defaultBrandId={guard.user.brandId} />
        </div>
      </section>

      {allJobs.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold text-zinc-700">最近任务</h2>
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
                {allJobs.map((job) => (
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
        </section>
      )}
    </div>
  );
}
