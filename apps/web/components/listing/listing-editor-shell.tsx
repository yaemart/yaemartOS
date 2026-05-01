'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, Save } from 'lucide-react';
import type { ListingItem, ListingVersionItem } from '@/lib/api/listing-client';
import type { ListingVersion } from '@/lib/mock-data';
import { VersionTimeline } from './version-timeline';
import { ContentEditor } from './content-editor';
import { AiCopilotPanel } from './ai-copilot-panel';
import { GeneratingOverlay } from './generating-overlay';

type Props = {
  listing: ListingItem & { versions: ListingVersionItem[] };
  locale: string;
  accessToken: string;
  brandId: string;
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

export function ListingEditorShell({ listing, locale, accessToken, brandId }: Props) {
  const router = useRouter();

  const uiVersions = listing.versions.map((v) => toUiVersion(v, listing.title));

  const initialSelected = uiVersions.find((v) => v.status === 'active') ?? uiVersions[0] ?? null;

  const [selectedVersion, setSelectedVersion] = useState<ListingVersion | null>(initialSelected);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  function startGeneration() {
    setIsGenerating(true);
    setGenerationProgress(0);
    const interval = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 600);
  }

  function cancelGeneration() {
    setIsGenerating(false);
    setGenerationProgress(0);
  }

  const productTitle =
    (listing.product as { title?: string } | undefined)?.title ?? `Listing ${listing.id}`;

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

        <button className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-sm font-medium text-white shadow-xs hover:opacity-90 transition-opacity">
          <Save className="h-3.5 w-3.5" />
          保存
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </header>

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Version Timeline */}
        <aside className="w-[180px] shrink-0 border-r bg-brand-surface overflow-y-auto">
          {uiVersions.length > 0 ? (
            <VersionTimeline
              versions={uiVersions}
              selected={selectedVersion ?? uiVersions[0]}
              onSelect={setSelectedVersion}
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
          />
        </aside>
      </div>
    </div>
  );
}
