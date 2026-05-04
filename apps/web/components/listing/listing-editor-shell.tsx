'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, Languages, RefreshCw, Save, Sparkles, X } from 'lucide-react';
import type {
  BatchGenerateResult,
  ListingItem,
  ListingVersionItem,
  LocaleInfo,
} from '@/lib/api/listing-client';
import {
  activateVersion,
  batchGenerateMultilingual,
  generateListingDraft,
} from '@/lib/api/listing-client';
import { getKeywordSuggestions, getListingSummaryMcp } from '@/lib/api/ai-mcp-client';
import type { ListingVersion } from '@/lib/mock-data';
import { useEntityRevalidation } from '@/lib/realtime/use-entity-revalidation';
import { LocaleSwitcher } from './locale-switcher';
import { VersionTimeline } from './version-timeline';
import { ContentEditor } from './content-editor';
import { AiCopilotPanel } from './ai-copilot-panel';
import { GeneratingOverlay } from './generating-overlay';

const AI_FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_LISTING_AI === 'true';
const MULTILINGUAL_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_MULTILINGUAL_LISTING_GENERATION === 'true';

type SiblingListing = { id: string; language: string };

type Props = {
  listing: ListingItem & { versions: ListingVersionItem[] };
  locale: string;
  accessToken: string;
  brandId: string;
  /** Active locales for the listing's market (from GET /locales) */
  marketLocales?: LocaleInfo[];
  /** Sibling listings for the same product/shop/platform in other languages */
  siblingListings?: SiblingListing[];
};

/**
 * Adapts a real ListingVersionItem from the API into the mock-data ListingVersion
 * shape expected by the existing UI components.
 */
function toUiVersion(v: ListingVersionItem, listingTitle?: string | null): ListingVersion {
  const snapshot = v.contentSnapshot as Record<string, unknown> | null;
  return {
    id: v.id,
    number: v.versionNumber,
    status: v.status === 'active' ? 'active' : v.status === 'draft' ? 'draft' : 'archived',
    createdAt: v.createdAt,
    author: v.createdBy ?? 'Unknown',
    source: 'manual',
    title: (snapshot?.title as string) ?? listingTitle ?? '',
    bullets: Array.isArray(snapshot?.bullets)
      ? (snapshot.bullets as string[])
      : ['', '', '', '', ''],
    description: (snapshot?.description as string) ?? '',
    keywords: Array.isArray(snapshot?.searchTerms)
      ? (snapshot.searchTerms as string[]).join(' ')
      : ((snapshot?.searchTerms as string) ?? ''),
  };
}

export function ListingEditorShell({
  listing,
  locale,
  accessToken,
  brandId,
  marketLocales = [],
  siblingListings = [],
}: Props) {
  const router = useRouter();

  const uiVersions = listing.versions.map((v) => toUiVersion(v, listing.title));

  const initialSelected = uiVersions.find((v) => v.status === 'active') ?? uiVersions[0] ?? null;

  const [selectedVersion, setSelectedVersion] = useState<ListingVersion | null>(initialSelected);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isMultilingualGenerating, setIsMultilingualGenerating] = useState(false);
  const [multilingualResult, setMultilingualResult] = useState<{
    succeeded: number;
    failed: Array<{ language: string; platformCode: string; error?: string }>;
  } | null>(null);

  // Realtime: surface a toast when an agent (or another tab) writes to this
  // listing. We use `'toast'` mode — never auto-discard the operator's
  // unsaved local edits. Both `listing` and `listing-version` events
  // include this listingId in `ids` (see ListingVersionService.publish).
  const listingId = listing.id;
  const listingPending = useEntityRevalidation('listing', {
    mode: 'toast',
    filterIds: [listingId],
  });
  const versionPending = useEntityRevalidation('listing-version', {
    mode: 'toast',
    filterIds: [listingId],
  });
  const pendingCount = listingPending.pendingEvents.length + versionPending.pendingEvents.length;
  // Prefer the most recent of the two streams; both pending lists are
  // append-only so the last element is always newest within the stream.
  const lastListingEvent = listingPending.pendingEvents.at(-1);
  const lastVersionEvent = versionPending.pendingEvents.at(-1);
  const newestPending = !lastListingEvent
    ? lastVersionEvent
    : !lastVersionEvent
      ? lastListingEvent
      : lastListingEvent.timestamp > lastVersionEvent.timestamp
        ? lastListingEvent
        : lastVersionEvent;

  function applyPending() {
    listingPending.acceptPending();
    versionPending.acceptPending();
  }
  function dismissPending() {
    listingPending.dismissPending();
    versionPending.dismissPending();
  }

  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  async function handleActivateVersion(version: ListingVersion) {
    if (version.status === 'active') {
      return;
    }
    setActivating(true);
    setActivateError(null);
    try {
      await activateVersion(accessToken, listingId, version.number, brandId);
      router.refresh();
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : '激活失败');
    } finally {
      setActivating(false);
    }
  }

  function handleLocaleSwitch(targetLocale: string) {
    const sibling = siblingListings.find((s) => s.language === targetLocale);
    if (sibling) {
      router.push(`/${locale}/listings/${sibling.id}`);
    }
  }

  async function startGeneration() {
    if (!AI_FEATURE_ENABLED) {
      alert('AI 生成功能暂未启用（NEXT_PUBLIC_FEATURE_LISTING_AI=true 开启）');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(10);

    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => Math.min(prev + Math.random() * 8, 88));
    }, 800);

    try {
      const productTitle =
        (listing.product as { title?: string } | undefined)?.title ?? listing.platformListingId;
      await generateListingDraft(
        accessToken,
        listing.id,
        {
          productTitle,
          productCategory: listing.platformId,
        },
        brandId,
      );
      setGenerationProgress(100);
    } catch (err) {
      console.error('Listing generation failed:', err);
      alert('生成失败，请检查 GEMINI_API_KEY 配置');
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationProgress(0);
        router.refresh();
      }, 600);
    }
  }

  async function startMultilingualGeneration() {
    if (!MULTILINGUAL_ENABLED) {
      alert(
        '多语言生成功能暂未启用（NEXT_PUBLIC_FEATURE_MULTILINGUAL_LISTING_GENERATION=true 开启）',
      );
      return;
    }
    const languages = marketLocales.map((l) => l.language);
    if (languages.length === 0) {
      alert('当前市场无可用语言配置');
      return;
    }
    const product = listing.product as { title?: string; sku?: string } | undefined;
    if (!listing.productId) {
      alert('当前 Listing 未关联产品，无法批量生成');
      return;
    }

    setIsMultilingualGenerating(true);
    setMultilingualResult(null);
    try {
      const response = await batchGenerateMultilingual(
        accessToken,
        {
          productId: listing.productId,
          brandId,
          marketId: listing.marketId,
          productTitle: product?.title ?? listing.platformListingId,
          productCategory: listing.platformId,
          languages,
          targets: [
            {
              shopId: listing.shopId,
              platformCode: listing.platformId,
              platformListingId: listing.platformListingId,
            },
          ],
        },
        brandId,
      );
      const results: BatchGenerateResult[] = response.results ?? [];
      const succeeded = results.filter((r) => r.status === 'completed').length;
      const failed = results
        .filter((r) => r.status === 'failed')
        .map((r) => ({ language: r.language, platformCode: r.platformCode, error: r.error }));
      setMultilingualResult({ succeeded, failed });
      // Refresh whenever at least one version was written to the DB, regardless of partial failures.
      if (succeeded > 0) {
        router.refresh();
      }
    } catch (err) {
      console.error('Multilingual generation failed:', err);
      setMultilingualResult({
        succeeded: 0,
        failed: [{ language: '—', platformCode: '—', error: '请求失败，请检查 API Key 配置' }],
      });
    } finally {
      setIsMultilingualGenerating(false);
    }
  }

  function cancelGeneration() {
    setIsGenerating(false);
    setGenerationProgress(0);
  }

  const productTitle =
    (listing.product as { title?: string } | undefined)?.title ?? `Listing ${listing.id}`;

  // Build locale list with current listing's language as active.
  // Merge market locales with sibling listings to show available languages.
  const localesWithSiblings: LocaleInfo[] = marketLocales.filter(
    (l) =>
      l.language === listing.language || siblingListings.some((s) => s.language === l.language),
  );

  return (
    <div className="flex h-screen flex-col">
      {/* Top Navigation */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-brand-surface px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/${locale}/listings`)}
            className="flex items-center gap-1.5 text-sm text-brand-text-secondary hover:text-brand-text transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </button>
          <span className="text-zinc-300">/</span>
          <h1 className="text-sm font-medium text-brand-text">{productTitle}</h1>
        </div>

        <div className="flex items-center gap-2">
          {MULTILINGUAL_ENABLED && marketLocales.length > 1 && (
            <button
              onClick={startMultilingualGeneration}
              disabled={isMultilingualGenerating || isGenerating}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 transition-colors disabled:opacity-50"
            >
              <Languages className="h-3.5 w-3.5" />
              {isMultilingualGenerating ? '生成中…' : '批量多语言生成'}
            </button>
          )}
          <button className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-sm font-medium text-white shadow-xs hover:opacity-90 transition-opacity">
            <Save className="h-3.5 w-3.5" />
            保存
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </div>
      </header>

      {/* Language Switcher Tab Bar */}
      {localesWithSiblings.length > 1 && (
        <LocaleSwitcher
          locales={localesWithSiblings}
          activeLocale={listing.language}
          onSwitch={handleLocaleSwitch}
        />
      )}

      {/* Realtime change notice (toast mode — operator decides when to apply) */}
      {pendingCount > 0 && newestPending && (
        <div
          role="status"
          aria-live="polite"
          className="shrink-0 border-b border-violet-200 bg-violet-50 px-4 py-2 text-sm text-violet-900 flex items-center gap-3"
        >
          <Sparkles className="h-3.5 w-3.5 text-violet-500 shrink-0" />
          <div className="flex-1 leading-tight">
            <p className="font-medium">
              {newestPending.actorType === 'agent' ? 'AI Agent' : '其他用户'}
              已修改此 Listing
              {pendingCount > 1 ? `（${pendingCount} 项变更）` : ''}
            </p>
            <p className="text-xs text-violet-700">
              点击「应用」获取最新数据；当前未保存的编辑会被覆盖。
            </p>
          </div>
          <button
            type="button"
            onClick={applyPending}
            className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            应用
          </button>
          <button
            type="button"
            onClick={dismissPending}
            aria-label="忽略此通知"
            className="text-violet-500 hover:text-violet-700 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {activateError && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          激活失败：{activateError}
        </div>
      )}

      {/* Multilingual batch generation result panel */}
      {multilingualResult !== null && (
        <div
          className={[
            'shrink-0 border-b px-4 py-2 text-sm flex items-start gap-3',
            multilingualResult.failed.length === 0
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : multilingualResult.succeeded > 0
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-red-50 border-red-200 text-red-800',
          ].join(' ')}
        >
          <div className="flex-1 space-y-0.5">
            <p className="font-medium">
              {multilingualResult.failed.length === 0
                ? `✓ 全部 ${multilingualResult.succeeded} 个语言生成成功`
                : multilingualResult.succeeded > 0
                  ? `⚠ 部分成功：${multilingualResult.succeeded} 成功 / ${multilingualResult.failed.length} 失败`
                  : `✗ 生成失败（${multilingualResult.failed.length} 个）`}
            </p>
            {multilingualResult.failed.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs opacity-80">
                {multilingualResult.failed.map((f, i) => (
                  <li key={i}>
                    [{f.language.toUpperCase()} / {f.platformCode}] {f.error ?? '未知错误'}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {multilingualResult.failed.length > 0 && (
              <button
                onClick={startMultilingualGeneration}
                disabled={isMultilingualGenerating}
                className="rounded px-2 py-0.5 text-xs font-medium border hover:bg-white/50 transition-colors disabled:opacity-50"
              >
                重试
              </button>
            )}
            {multilingualResult.succeeded > 0 && (
              <button
                onClick={() => {
                  router.refresh();
                  setMultilingualResult(null);
                }}
                className="rounded px-2 py-0.5 text-xs font-medium border hover:bg-white/50 transition-colors"
              >
                刷新页面
              </button>
            )}
            <button
              onClick={() => setMultilingualResult(null)}
              className="text-xs opacity-60 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Version Timeline */}
        <aside className="w-[180px] shrink-0 border-r bg-brand-surface overflow-y-auto">
          {uiVersions.length > 0 ? (
            <VersionTimeline
              versions={uiVersions}
              selected={selectedVersion ?? uiVersions[0]}
              onSelect={setSelectedVersion}
              onActivate={handleActivateVersion}
              activating={activating}
            />
          ) : (
            <div className="p-4 text-xs text-zinc-400">暂无版本</div>
          )}
        </aside>

        {/* Center: Content Editor */}
        <main className="relative flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {isGenerating && (
              <GeneratingOverlay
                progress={Math.min(generationProgress, 100)}
                onCancel={cancelGeneration}
              />
            )}
          </AnimatePresence>

          {selectedVersion ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedVersion.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="p-6"
              >
                <ContentEditor version={selectedVersion} disabled={isGenerating} />
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-400">暂无版本内容，点击「生成 Listing」开始</p>
            </div>
          )}
        </main>

        {/* Right: AI Copilot Panel */}
        <aside className="w-[280px] shrink-0 border-l bg-brand-surface overflow-y-auto">
          <AiCopilotPanel
            currentVersion={selectedVersion ?? uiVersions[0]}
            onGenerate={startGeneration}
            disabled={isGenerating}
            onKeywordSuggestions={
              listing.shopId
                ? async () => {
                    const result = await getKeywordSuggestions(
                      accessToken,
                      {
                        shopId: listing.shopId,
                        asin: listing.platformListingId ?? undefined,
                      },
                      brandId,
                    );
                    return result.keywords;
                  }
                : undefined
            }
            onListingSummary={
              listing.shopId && listing.platformListingId
                ? async () => {
                    const result = await getListingSummaryMcp(
                      accessToken,
                      { shopId: listing.shopId, asin: listing.platformListingId! },
                      brandId,
                    );
                    return { title: result.title, bullets: result.bullets };
                  }
                : undefined
            }
          />
        </aside>
      </div>
    </div>
  );
}
