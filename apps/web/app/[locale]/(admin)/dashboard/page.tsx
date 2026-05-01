export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">仪表盘</h1>
        <p className="mt-0.5 text-sm text-zinc-500">概览与数据一览</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '活跃 Listing', value: '—' },
          { label: '待审核', value: '—' },
          { label: '本月广告支出', value: '—' },
          { label: '工单处理中', value: '—' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
