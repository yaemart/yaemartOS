'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface AdBarChartProps {
  data: { name: string; value: number }[];
  height?: number;
  formatter?: (v: number) => string;
}

export function AdBarChart({ data, height = 300, formatter }: AdBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        暂无数据
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={formatter} />
        <Tooltip
          formatter={
            formatter
              ? (value: unknown) => (typeof value === 'number' ? formatter(value) : String(value))
              : undefined
          }
        />
        <Bar dataKey="value" fill="rgb(var(--brand-primary))" radius={[4, 4, 0, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
