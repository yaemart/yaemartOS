'use client';

import {
  Home,
  Package,
  MessageCircle,
  TicketCheck,
  BookOpen,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBrand } from '@/providers/brand-provider';
import { useDevPreview } from '@/providers/dev-preview-provider';

const NAV_ITEMS = [
  { icon: Home, label: 'Home', labelZh: '首页' },
  { icon: Package, label: 'My Products', labelZh: '我的产品' },
  { icon: MessageCircle, label: 'Chat', labelZh: '聊天' },
  { icon: TicketCheck, label: 'Tickets', labelZh: '工单' },
  { icon: BookOpen, label: 'Manuals', labelZh: '手册' },
  { icon: ShieldCheck, label: 'Warranty', labelZh: '保修' },
  { icon: Search, label: 'Order Lookup', labelZh: '查询' },
];

const BRAND_NAMES: Record<string, string> = {
  homtone: 'Homtone',
  spoonlemon: 'Spoonlemon',
  davivy: 'Davivy',
  tysun: 'Tysun',
};

export function PortalShell() {
  const { brand } = useBrand();
  const { state } = useDevPreview();
  const locale = state.locale;

  return (
    <div className="flex h-full min-h-screen flex-col bg-brand-bg">
      {/* Portal Header */}
      <header className="border-b bg-brand-surface">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-primary flex items-center justify-center">
              <span className="text-sm font-bold text-white">{BRAND_NAMES[brand]?.[0] ?? 'H'}</span>
            </div>
            <span className="text-base font-semibold text-brand-text">
              {BRAND_NAMES[brand]} Support
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-brand-text-secondary uppercase tracking-wider">
              {locale.toUpperCase()}
            </span>
            <button className="rounded-md bg-brand-primary px-3 py-1.5 text-xs font-medium text-white">
              {locale === 'zh' ? '登录' : 'Sign In'}
            </button>
          </div>
        </div>
      </header>

      {/* Portal Nav */}
      <nav className="border-b bg-brand-surface/80">
        <div className="mx-auto flex max-w-5xl items-center gap-0.5 px-4 overflow-x-auto">
          {NAV_ITEMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm transition-colors',
                  i === 0
                    ? 'text-brand-primary font-medium'
                    : 'text-brand-text-secondary hover:text-brand-text hover:bg-brand-primary/5',
                )}
              >
                <Icon className="h-4 w-4" />
                {locale === 'zh' ? item.labelZh : item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Portal Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8">
          {/* Hero Section */}
          <div className="rounded-xl bg-brand-primary/10 p-8 text-center">
            <h1 className="text-2xl font-semibold text-brand-text">
              {locale === 'zh'
                ? `欢迎来到 ${BRAND_NAMES[brand]} 客服中心`
                : `Welcome to ${BRAND_NAMES[brand]} Support`}
            </h1>
            <p className="mt-2 text-sm text-brand-text-secondary">
              {locale === 'zh'
                ? '查看产品手册、提交工单、或与我们的 AI 客服实时聊天'
                : 'View manuals, submit tickets, or chat with our AI support'}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white shadow-sm">
                <MessageCircle className="mr-1.5 inline h-4 w-4" />
                {locale === 'zh' ? '开始聊天' : 'Start Chat'}
              </button>
              <button className="rounded-md border border-brand-primary/30 px-4 py-2 text-sm font-medium text-brand-primary">
                <BookOpen className="mr-1.5 inline h-4 w-4" />
                {locale === 'zh' ? '浏览手册' : 'Browse Manuals'}
              </button>
            </div>
          </div>

          {/* Quick cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                icon: TicketCheck,
                title: locale === 'zh' ? '提交工单' : 'Submit Ticket',
                desc: locale === 'zh' ? '报告问题或申请退换' : 'Report issues or request returns',
              },
              {
                icon: ShieldCheck,
                title: locale === 'zh' ? '注册保修' : 'Register Warranty',
                desc: locale === 'zh' ? '延长产品保修期' : 'Extend your product warranty',
              },
              {
                icon: Search,
                title: locale === 'zh' ? '订单查询' : 'Track Order',
                desc: locale === 'zh' ? '无需登录查看订单状态' : 'Check status without signing in',
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.title}
                  className="group rounded-lg border bg-brand-surface p-4 text-left transition-all hover:shadow-sm hover:border-brand-primary/30"
                >
                  <Icon className="h-5 w-5 text-brand-primary mb-2" />
                  <h3 className="text-sm font-medium text-brand-text">{card.title}</h3>
                  <p className="mt-1 text-xs text-brand-text-secondary">{card.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-brand-surface py-4">
        <p className="text-center text-[11px] text-brand-text-secondary">
          &copy; 2026 {BRAND_NAMES[brand]}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
