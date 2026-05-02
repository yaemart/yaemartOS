'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import type { ConnectionHealth, SystemConfig, AiCostSummary } from '@/lib/api/settings-client';
import { ConnectionsPanel } from './connections-panel';

type RoutingKey = {
  key: string;
  label: string;
};

const ROUTING_KEYS: RoutingKey[] = [
  { key: 'ai_routing.listing.en', label: 'Listing 英文' },
  { key: 'ai_routing.listing.zh', label: 'Listing 中文' },
  { key: 'ai_routing.faq.en', label: 'FAQ 英文' },
  { key: 'ai_routing.extraction.en', label: '数据提取' },
];

function RouterRow({
  routingKey,
  currentValue,
  accessToken,
  onUpdate,
}: {
  routingKey: RoutingKey;
  currentValue: string;
  accessToken: string;
  onUpdate: (key: string, value: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newVal = e.target.value;
    startTransition(async () => {
      const { upsertAiRouting } = await import('@/lib/api/settings-client');
      await upsertAiRouting(accessToken, routingKey.key, newVal, routingKey.label);
      onUpdate(routingKey.key, newVal);
    });
  }

  return (
    <div className="flex items-center justify-between py-3">
      <p className="text-sm font-medium text-zinc-900">{routingKey.label}</p>
      <select
        value={currentValue}
        onChange={handleChange}
        disabled={isPending}
        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none disabled:opacity-50"
      >
        <option value="gemini">Gemini Pro</option>
        <option value="glm">GLM-5 (智谱)</option>
      </select>
    </div>
  );
}

function BudgetRow({
  label,
  description,
  configKey,
  currentValue,
  unit,
  accessToken,
}: {
  label: string;
  description: string;
  configKey: string;
  currentValue: string;
  unit: string;
  accessToken: string;
}) {
  const [value, setValue] = useState(currentValue);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    startTransition(async () => {
      const { upsertAiBudget } = await import('@/lib/api/settings-client');
      await upsertAiBudget(accessToken, configKey, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-zinc-900">{label}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-24 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
        />
        <span className="text-xs text-zinc-400">{unit}</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {saved ? '已保存' : '保存'}
        </button>
      </div>
    </div>
  );
}

export function AiConfigPanel({
  accessToken,
  connections,
  aiRouting,
  aiCost,
}: {
  accessToken: string;
  connections: ConnectionHealth[];
  aiRouting: SystemConfig[];
  aiCost: AiCostSummary | null;
}) {
  const [routing, setRouting] = useState(
    Object.fromEntries(aiRouting.map((r) => [r.key, r.value])),
  );

  function handleRoutingUpdate(key: string, value: string) {
    setRouting((prev) => ({ ...prev, [key]: value }));
  }

  const budgetConfigs = {
    geminiMonthlyUsd: String(aiCost?.budgets.geminiMonthlyUsd ?? '50'),
    glmMonthlyCny: String(aiCost?.budgets.glmMonthlyCny ?? '500'),
    alertThresholdPct: String(aiCost?.budgets.alertThresholdPct ?? '80'),
  };

  return (
    <div className="space-y-0">
      {/* Connection health */}
      <ConnectionsPanel connections={connections} />

      {/* Model routing */}
      <p className="pb-3 pt-6 text-xs font-medium uppercase tracking-wide text-zinc-400">
        模型路由
      </p>
      <div className="divide-y divide-zinc-100">
        {ROUTING_KEYS.map((rk) => (
          <RouterRow
            key={rk.key}
            routingKey={rk}
            currentValue={routing[rk.key] ?? 'gemini'}
            accessToken={accessToken}
            onUpdate={handleRoutingUpdate}
          />
        ))}
      </div>

      {/* Cost budget */}
      <p className="pb-3 pt-6 text-xs font-medium uppercase tracking-wide text-zinc-400">
        AI 成本预算
      </p>
      <div className="divide-y divide-zinc-100">
        <BudgetRow
          label="Gemini 月预算"
          description="超出后发出告警（不自动停止）"
          configKey="gemini_monthly_usd"
          currentValue={budgetConfigs.geminiMonthlyUsd}
          unit="USD"
          accessToken={accessToken}
        />
        <BudgetRow
          label="GLM 月预算"
          description="超出后发出告警（不自动停止）"
          configKey="glm_monthly_cny"
          currentValue={budgetConfigs.glmMonthlyCny}
          unit="CNY"
          accessToken={accessToken}
        />
        <BudgetRow
          label="告警阈值"
          description="达到预算此比例时触发通知"
          configKey="alert_threshold_pct"
          currentValue={budgetConfigs.alertThresholdPct}
          unit="%"
          accessToken={accessToken}
        />
      </div>

      {/* Current month spending */}
      {aiCost && (
        <>
          <p className="pb-3 pt-6 text-xs font-medium uppercase tracking-wide text-zinc-400">
            本月 AI 费用（{aiCost.month}）
          </p>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
            {(aiCost.alerts.geminiOverBudget || aiCost.alerts.glmOverBudget) && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                预算告警：已超过阈值
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-zinc-500">Gemini</p>
                <p className="mt-1 text-base font-semibold text-zinc-900">
                  ${aiCost.spend.geminiUsd.toFixed(3)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">GLM</p>
                <p className="mt-1 text-base font-semibold text-zinc-900">
                  ${aiCost.spend.glmUsd.toFixed(3)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">总调用次数</p>
                <p className="mt-1 text-base font-semibold text-zinc-900">
                  {aiCost.spend.totalCalls.toLocaleString()}
                </p>
              </div>
            </div>
            {aiCost.spend.byModel.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-zinc-200 pt-3">
                {aiCost.spend.byModel.map((m) => (
                  <div
                    key={m.model}
                    className="flex items-center justify-between text-xs text-zinc-600"
                  >
                    <span className="font-mono">{m.model}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-zinc-400">{m.calls} 次</span>
                      <span>${m.estimatedCostUsd}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 pb-2 pt-2 text-xs text-zinc-400">
            <TrendingUp className="h-3 w-3" />
            费用为估算值，仅供参考，不作为账单依据
          </div>
        </>
      )}
    </div>
  );
}
