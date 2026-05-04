import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/route-guard';
import { listAdSuggestions, listAdChanges } from '@/lib/api/ad-suggestion-client';
import { AdSuggestionListClient } from './suggestion-list-client';
import { AdChangeHistoryClient } from './change-history-client';

export const dynamic = 'force-dynamic';

export default async function AdSuggestionsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { shopId?: string };
}) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    redirect(`/${params.locale}/login`);
  }

  let suggestionsError: string | null = null;
  let suggestions: Awaited<ReturnType<typeof listAdSuggestions>> | null = null;
  try {
    suggestions = await listAdSuggestions(guard.accessToken, guard.user.brandId, {
      shopId: searchParams?.shopId,
      limit: 50,
    });
  } catch (err) {
    suggestionsError = err instanceof Error ? err.message : '加载建议失败';
  }

  let changesError: string | null = null;
  let changes: Awaited<ReturnType<typeof listAdChanges>> | null = null;
  try {
    changes = await listAdChanges(guard.accessToken, guard.user.brandId, {
      shopId: searchParams?.shopId,
      limit: 20,
    });
  } catch (err) {
    changesError = err instanceof Error ? err.message : '加载变更历史失败';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI 广告优化建议</h1>
        <p className="text-sm text-muted-foreground">
          基于 GLM-5 模型分析过去 30 天广告数据，识别 ACOS 偏高/CTR 偏低的 campaign
          并给出可执行建议。 所有变更受 24 小时回滚窗口保护。
        </p>
      </div>
      <AdSuggestionListClient
        accessToken={guard.accessToken}
        brandId={guard.user.brandId}
        initialData={suggestions}
        fetchError={suggestionsError}
        shopIdFilter={searchParams?.shopId}
      />
      <AdChangeHistoryClient
        accessToken={guard.accessToken}
        brandId={guard.user.brandId}
        initialData={changes}
        fetchError={changesError}
      />
    </div>
  );
}
