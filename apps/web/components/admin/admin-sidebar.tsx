'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  FileText,
  FolderTree,
  Store,
  Settings,
  HelpCircle,
  ChevronLeft,
  Upload,
  BarChart2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBrand } from '@/providers/brand-provider';

export type NavItem = {
  icon: LucideIcon;
  label: string;
  href: string;
  capability?: string;
};

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: '概览',
    items: [{ icon: LayoutDashboard, label: '仪表盘', href: '/dashboard' }],
  },
  {
    title: '商品运营',
    items: [
      { icon: Package, label: '产品管理', href: '/products', capability: 'products:read' },
      { icon: FileText, label: 'Listing 管理', href: '/listings', capability: 'listings:read' },
      { icon: FolderTree, label: '品类库', href: '/categories', capability: 'categories:read' },
    ],
  },
  {
    title: '店铺运营',
    items: [{ icon: Store, label: '店铺绑定', href: '/shops', capability: 'shops:read' }],
  },
  {
    title: '数据管理',
    items: [
      { icon: Upload, label: '数据导入', href: '/migration' },
      { icon: BarChart2, label: '广告看板', href: '/ads/dashboard', capability: 'ads:read' },
      { icon: BarChart2, label: '广告建议', href: '/ads/suggestions', capability: 'ads:read' },
    ],
  },
  {
    title: '系统',
    items: [{ icon: Settings, label: '系统设置', href: '/settings' }],
  },
];

export function AdminSidebar({
  collapsed,
  onToggle,
  capabilities,
}: {
  collapsed: boolean;
  onToggle: () => void;
  capabilities?: string[];
}) {
  const { brand } = useBrand();
  const pathname = usePathname();
  const params = useParams<{ locale?: string }>();
  const localePrefix = params?.locale ? `/${params.locale}` : '';

  const isVisible = (item: NavItem) => {
    if (!item.capability) {
      return true;
    }
    if (!capabilities) {
      return true;
    }
    return capabilities.includes(item.capability);
  };

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-zinc-950 text-zinc-100 transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
        {!collapsed && (
          <div>
            <span className="text-sm font-bold tracking-tight text-white">yaemartOS</span>
            <span className="mt-0.5 block text-xs text-[rgb(var(--brand-primary))]">
              {brand.charAt(0).toUpperCase() + brand.slice(1)}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:text-zinc-100"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(isVisible);
          if (visibleItems.length === 0) {
            return null;
          }
          return (
            <div key={group.title} className="mb-4">
              {!collapsed && (
                <span className="mb-1 mt-4 block px-3 text-xs uppercase tracking-wide text-zinc-500">
                  {group.title}
                </span>
              )}
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const localizedHref = `${localePrefix}${item.href}`;
                const isActive = pathname?.startsWith(localizedHref);
                return (
                  <Link
                    key={item.href}
                    href={localizedHref}
                    className={cn(
                      'relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-zinc-800 font-medium text-zinc-100'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-[rgb(var(--brand-primary))]" />
                    )}
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed ? item.label : null}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-3">
        {!collapsed && (
          <Link
            href={`${localePrefix}/settings`}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100"
          >
            <HelpCircle className="h-4 w-4" />
            帮助文档
          </Link>
        )}
      </div>
    </aside>
  );
}
