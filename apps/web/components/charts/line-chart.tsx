'use client';

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface LineConfig {
  key: string;
  label: string;
  yAxisId?: string;
}

interface AdLineChartProps {
  data: { date: string; [key: string]: number | string }[];
  lines: LineConfig[];
  height?: number;
}

const LINE_COLORS = [
  'rgb(var(--brand-primary))',
  'rgb(var(--brand-secondary, 100 116 139))',
  '#f59e0b',
  '#10b981',
];

export function AdLineChart({ data, lines, height = 300 }: AdLineChartProps) {
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
      <RechartsLineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {lines.map((line, idx) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.label}
            stroke={LINE_COLORS[idx % LINE_COLORS.length]}
            yAxisId={line.yAxisId}
            dot={false}
            strokeWidth={2}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
