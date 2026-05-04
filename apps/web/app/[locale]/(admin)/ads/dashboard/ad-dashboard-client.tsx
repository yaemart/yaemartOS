'use client';

import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { AdDashboardResponse } from '@yaemartos/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdLineChart } from '@/components/charts/line-chart';
import { AdBarChart } from '@/components/charts/bar-chart';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface AdDashboardClientProps {
  data: AdDashboardResponse | null;
  fetchError?: string | null;
  accessToken?: string;
  brandId?: string;
  searchParams: {
    startDate?: string;
    endDate?: string;
    adType?: string;
  };
}

const AD_TYPE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'sp', label: 'SP' },
  { value: 'sd', label: 'SD' },
  { value: 'sb', label: 'SB' },
  { value: 'walmart_sp', label: 'Walmart SP' },
];

export function AdDashboardClient({
  data,
  fetchError,
  accessToken,
  brandId,
  searchParams,
}: AdDashboardClientProps) {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const localePrefix = params?.locale ? `/${params.locale}` : '';

  const [startDate, setStartDate] = useState(searchParams.startDate ?? '');
  const [endDate, setEndDate] = useState(searchParams.endDate ?? '');
  const [adType, setAdType] = useState(searchParams.adType ?? '');
  const [dateError, setDateError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  function handleApply() {
    if (startDate && endDate && startDate > endDate) {
      setDateError('开始日期不能晚于结束日期');
      return;
    }
    setDateError(null);
    const qs = new URLSearchParams();
    if (startDate) {
      qs.set('startDate', startDate);
    }
    if (endDate) {
      qs.set('endDate', endDate);
    }
    if (adType) {
      qs.set('adType', adType);
    }
    router.push(`${localePrefix}/ads/dashboard?${qs.toString()}`);
  }

  async function handleSync(shopId: string) {
    if (!accessToken || !brandId) {
      return;
    }
    const date = endDate || new Date().toISOString().split('T')[0]!;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`${API_BASE}/ads/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-brand-id': brandId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shopId, date }),
      });
      if (!res.ok) {
        throw new Error(`同步失败 (${res.status})`);
      }
      setSyncMsg('同步完成，正在刷新数据…');
      router.refresh();
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : '同步失败');
    } finally {
      setSyncing(false);
    }
  }

  if (fetchError) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-destructive text-sm">数据加载失败：{fetchError}</p>
        </CardContent>
      </Card>
    );
  }

  if (data === null) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">广告看板功能未开启，请联系管理员启用。</p>
        </CardContent>
      </Card>
    );
  }

  const { daily, totals, acos } = data;

  const trendData = daily.reduce(
    (acc, item) => {
      const existing = acc.find((d) => d.date === item.date);
      if (existing) {
        existing.spend += item.spend;
        existing.sales += item.sales;
      } else {
        acc.push({ date: item.date, spend: item.spend, sales: item.sales });
      }
      return acc;
    },
    [] as { date: string; spend: number; sales: number }[],
  );

  const byAdType = (['sp', 'sd', 'sb', 'walmart_sp'] as const)
    .map((type) => ({
      name: type.toUpperCase().replace('_', ' '),
      value: daily.filter((d) => d.adType === type).reduce((sum, d) => sum + d.spend, 0),
    }))
    .filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {syncMsg && (
        <p
          className={`text-sm ${syncing ? 'text-muted-foreground' : syncMsg.includes('失败') ? 'text-destructive' : 'text-green-600'}`}
        >
          {syncMsg}
        </p>
      )}
      {/* 筛选栏 */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">广告类型</label>
            <select
              value={adType}
              onChange={(e) => setAdType(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              {AD_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={handleApply}
              className="rounded-md bg-[rgb(var(--brand-primary))] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              应用
            </button>
            {dateError && <p className="text-xs text-destructive">{dateError}</p>}
          </div>
        </CardContent>
      </Card>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总花费</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${totals.totalSpend.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总销售额</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${totals.totalSales.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ACOS</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {acos !== null ? `${acos.toFixed(1)}%` : 'N/A'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总点击数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totals.totalClicks.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* 趋势折线图 */}
      <Card>
        <CardHeader>
          <CardTitle>花费与销售额趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <AdLineChart
            data={trendData}
            lines={[
              { key: 'spend', label: '花费' },
              { key: 'sales', label: '销售额' },
            ]}
            height={300}
          />
        </CardContent>
      </Card>

      {/* 广告类型柱状图 */}
      <Card>
        <CardHeader>
          <CardTitle>各广告类型花费</CardTitle>
        </CardHeader>
        <CardContent>
          <AdBarChart data={byAdType} height={300} formatter={(v: number) => `$${v.toFixed(2)}`} />
        </CardContent>
      </Card>
    </div>
  );
}
