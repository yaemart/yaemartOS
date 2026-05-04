import { redirect } from 'next/navigation';
import { format, subDays } from 'date-fns';
import { requireAuth } from '@/lib/auth/route-guard';
import { fetchAdDashboard } from '@/lib/api/ad-dashboard-client';
import { AdDashboardClient } from './ad-dashboard-client';

export default async function AdDashboardPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: {
    startDate?: string;
    endDate?: string;
    adType?: string;
    shopId?: string;
  };
}) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    redirect(`/${params.locale}/login`);
  }

  const endDate = searchParams?.endDate ?? format(new Date(), 'yyyy-MM-dd');
  const startDate = searchParams?.startDate ?? format(subDays(new Date(), 6), 'yyyy-MM-dd');

  // Separate null (feature disabled / 403) from thrown errors (network, 5xx) so the UI
  // can show a meaningful message instead of always saying "feature not enabled".
  let data: Awaited<ReturnType<typeof fetchAdDashboard>> = null;
  let fetchError: string | null = null;
  try {
    data = await fetchAdDashboard(
      guard.accessToken,
      {
        shopId: searchParams?.shopId,
        adType: searchParams?.adType,
        startDate,
        endDate,
      },
      guard.user.brandId,
    );
  } catch (err) {
    fetchError = err instanceof Error ? err.message : '数据加载失败，请稍后重试';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">广告看板</h1>
        <p className="text-sm text-muted-foreground">查看广告投放数据趋势与效果分析</p>
      </div>
      <AdDashboardClient
        data={data}
        fetchError={fetchError}
        accessToken={guard.accessToken}
        brandId={guard.user.brandId}
        searchParams={{ startDate, endDate, adType: searchParams?.adType }}
      />
    </div>
  );
}
