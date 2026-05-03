import { requireAuth } from '@/lib/auth/route-guard';
import {
  getConnections,
  getFeatureFlags,
  getAiRouting,
  getAiCost,
  getBrands,
} from '@/lib/api/settings-client';
import { SettingsTabs } from '@/components/settings/settings-tabs';

export default async function SettingsPage({ params }: { params: { locale: string } }) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    return null;
  }

  const { accessToken } = guard;

  const [connections, featureFlags, aiRouting, aiCost, brands] = await Promise.all([
    getConnections(accessToken).catch(() => []),
    getFeatureFlags(accessToken).catch(() => []),
    getAiRouting(accessToken).catch(() => []),
    getAiCost(accessToken).catch(() => null),
    getBrands(accessToken).catch(() => []),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">系统设置</h1>
        <p className="mt-0.5 text-sm text-zinc-500">管理账号、AI 配置与系统偏好</p>
      </div>
      <SettingsTabs
        accessToken={accessToken}
        connections={connections}
        featureFlags={featureFlags}
        aiRouting={aiRouting}
        aiCost={aiCost}
        brands={brands}
      />
    </div>
  );
}
