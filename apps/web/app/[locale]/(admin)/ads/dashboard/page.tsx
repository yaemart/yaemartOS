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

  const data = await fetchAdDashboard(
    guard.accessToken,
    {
      brandId: guard.user.brandId,
      shopId: searchParams?.shopId,
      adType: searchParams?.adType,
      startDate,
      endDate,
    },
    guard.user.brandId,
  ).catch(() => null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">广告看板</h1>
        <p className="text-sm text-muted-foreground">查看广告投放数据趋势与效果分析</p>
      </div>
      <AdDashboardClient
        data={data}
        searchParams={{ startDate, endDate, adType: searchParams?.adType }}
      />
    </div>
  );
}
