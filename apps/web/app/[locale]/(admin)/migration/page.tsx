import { requireAuth } from '@/lib/auth/route-guard';
import { TriggerImportForm } from '@/components/migration/trigger-import-form';
import { RecentJobsTable } from '@/components/migration/recent-jobs-table';
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

      <RecentJobsTable token={guard.accessToken} initialJobs={allJobs} />
    </div>
  );
}
