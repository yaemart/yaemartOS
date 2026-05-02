'use client';

import { useState } from 'react';
import { User, Bell, Shield, Globe, Bot, ToggleLeft, Palette } from 'lucide-react';
import type {
  ConnectionHealth,
  SystemConfig,
  AiCostSummary,
  BrandTheme,
} from '@/lib/api/settings-client';
import { ConnectionsPanel } from './connections-panel';
import { FeatureFlagsPanel } from './feature-flags-panel';
import { AiConfigPanel } from './ai-config-panel';
import { BrandThemePanel } from './brand-theme-panel';

type Tab = 'account' | 'security' | 'notifications' | 'ai' | 'flags' | 'brands' | 'locale';

const TABS: { id: Tab; icon: React.ElementType; label: string }[] = [
  { id: 'account', icon: User, label: '账号信息' },
  { id: 'security', icon: Shield, label: '安全设置' },
  { id: 'notifications', icon: Bell, label: '通知偏好' },
  { id: 'ai', icon: Bot, label: 'AI 配置' },
  { id: 'flags', icon: ToggleLeft, label: '功能开关' },
  { id: 'brands', icon: Palette, label: '品牌主题' },
  { id: 'locale', icon: Globe, label: '语言与地区' },
];

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="min-w-0 flex-1 pr-8">
        <p className="text-sm font-medium text-zinc-900">{label}</p>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn((v) => !v)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${on ? 'bg-[rgb(var(--brand-primary))]' : 'bg-zinc-200'}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${on ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  );
}

function AccountTab() {
  return (
    <div className="space-y-0 divide-y divide-zinc-100">
      <SettingRow label="姓名" description="显示在系统中的名称">
        <input
          defaultValue="David Gao"
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
        />
      </SettingRow>
      <SettingRow label="邮箱" description="登录账号，变更后需重新验证">
        <input
          defaultValue="davidgao@yaemart.org"
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
        />
      </SettingRow>
      <SettingRow label="角色" description="由管理员分配，不可自行修改">
        <span className="inline-flex items-center rounded-md bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
          超级管理员
        </span>
      </SettingRow>
      <div className="pt-4">
        <button
          type="button"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus:outline-none"
        >
          保存更改
        </button>
      </div>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="space-y-0 divide-y divide-zinc-100">
      <SettingRow label="修改密码" description="建议定期更换密码以保障账号安全">
        <button
          type="button"
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          立即修改
        </button>
      </SettingRow>
      <SettingRow label="双因素认证" description="通过 TOTP 应用增加额外安全层">
        <Toggle />
      </SettingRow>
      <SettingRow label="登录设备管理" description="查看并吊销其他已登录设备">
        <button
          type="button"
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          查看设备
        </button>
      </SettingRow>
    </div>
  );
}

function NotificationsTab() {
  return (
    <div className="space-y-0 divide-y divide-zinc-100">
      <SettingRow label="Listing 审核通过" description="AI 生成的 Listing 草稿等待人工激活">
        <Toggle defaultChecked />
      </SettingRow>
      <SettingRow label="数据导入完成" description="路径 A 批量导入任务完成时通知">
        <Toggle defaultChecked />
      </SettingRow>
      <SettingRow label="系统异常告警" description="后端服务或 AI 接口出现异常时通知">
        <Toggle defaultChecked />
      </SettingRow>
      <SettingRow label="AI 预算超阈值" description="月度 AI 费用超过告警阈值时通知">
        <Toggle defaultChecked />
      </SettingRow>
    </div>
  );
}

function LocaleTab() {
  return (
    <div className="space-y-0 divide-y divide-zinc-100">
      <SettingRow label="界面语言" description="控制后台管理界面的显示语言">
        <select className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none">
          <option value="zh">简体中文</option>
          <option value="en">English</option>
        </select>
      </SettingRow>
      <SettingRow label="时区" description="影响时间显示与计划任务触发时间">
        <select className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none">
          <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
          <option value="America/New_York">America/New_York (UTC-5)</option>
          <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
        </select>
      </SettingRow>
    </div>
  );
}

export function SettingsTabs({
  accessToken,
  connections,
  featureFlags,
  aiRouting,
  aiCost,
  brands,
}: {
  accessToken: string;
  connections: ConnectionHealth[];
  featureFlags: SystemConfig[];
  aiRouting: SystemConfig[];
  aiCost: AiCostSummary | null;
  brands: BrandTheme[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>('account');

  const tabContent: Record<Tab, React.ReactNode> = {
    account: <AccountTab />,
    security: <SecurityTab />,
    notifications: <NotificationsTab />,
    ai: (
      <AiConfigPanel
        accessToken={accessToken}
        connections={connections}
        aiRouting={aiRouting}
        aiCost={aiCost}
      />
    ),
    flags: <FeatureFlagsPanel accessToken={accessToken} featureFlags={featureFlags} />,
    brands: <BrandThemePanel accessToken={accessToken} brands={brands} />,
    locale: <LocaleTab />,
  };

  return (
    <div className="flex gap-6">
      <aside className="w-44 flex-shrink-0">
        <nav className="space-y-0.5">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                activeTab === id
                  ? 'bg-zinc-100 font-medium text-zinc-900'
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-6 py-2">
        {tabContent[activeTab]}
      </div>
    </div>
  );
}
