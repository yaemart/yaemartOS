'use client';

import {
  LayoutDashboard,
  Package,
  FileText,
  ShoppingCart,
  Warehouse,
  Megaphone,
  Users,
  GraduationCap,
  Settings,
  Shield,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBrand } from '@/providers/brand-provider';
import { BrandSwitcher } from '@/components/listing/brand-switcher';

const SIDEBAR_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: Package, label: '产品中心' },
  { icon: FileText, label: 'Listing 管理' },
  { icon: ShoppingCart, label: '订单' },
  { icon: Warehouse, label: '库存' },
  { icon: Megaphone, label: '广告' },
  { icon: Users, label: '客服/工单' },
  { icon: GraduationCap, label: '培训' },
  { icon: Upload, label: '数据导入' },
  { icon: Settings, label: '系统设置' },
  { icon: Shield, label: 'IAM 策略' },
];

export function AdminShell() {
  const { brand } = useBrand();

  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar */}
      <aside className="w-[200px] shrink-0 border-r bg-brand-surface flex flex-col">
        <div className="flex h-14 items-center px-4 border-b">
          <span className="text-sm font-bold text-brand-text tracking-tight">yaemartOS</span>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                  item.active
                    ? 'bg-brand-primary/10 text-brand-primary font-medium'
                    : 'text-brand-text-secondary hover:bg-zinc-100 hover:text-brand-text',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b bg-brand-surface px-4">
          <h1 className="text-sm font-medium text-brand-text">Dashboard</h1>
          <BrandSwitcher />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6 bg-brand-bg">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: '活跃 Listing', value: '234', change: '+12' },
              { label: '待审核', value: '18', change: '+3' },
              { label: '本月广告支出', value: '$12,450', change: '+8.2%' },
              { label: '工单处理中', value: '7', change: '-2' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border bg-brand-surface p-4">
                <p className="text-xs text-brand-text-secondary">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold text-brand-text tabular-nums">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-xs text-emerald-600">{stat.change}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border bg-brand-surface p-4">
            <h2 className="text-sm font-medium text-brand-text mb-3">最近操作</h2>
            <div className="space-y-2">
              {[
                {
                  time: '10:30',
                  action: 'AI 生成 Listing v3',
                  product: '6QT Slow Cooker',
                  user: '@wang',
                },
                { time: '09:15', action: '广告架构创建', product: 'Air Fryer 5.8QT', user: '@li' },
                { time: '昨天', action: '客诉工单关闭', product: 'Blender Pro', user: 'AI Auto' },
              ].map((log, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-12 text-xs text-brand-text-secondary tabular-nums">
                    {log.time}
                  </span>
                  <span className="flex-1 text-brand-text">{log.action}</span>
                  <span className="text-xs text-brand-text-secondary">{log.product}</span>
                  <span className="text-xs text-brand-text-secondary">{log.user}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
