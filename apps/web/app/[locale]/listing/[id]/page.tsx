'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Save, ChevronDown } from 'lucide-react';
import { VersionTimeline } from '@/components/listing/version-timeline';
import { ContentEditor } from '@/components/listing/content-editor';
import { AiCopilotPanel } from '@/components/listing/ai-copilot-panel';
import { GeneratingOverlay } from '@/components/listing/generating-overlay';
import { BrandSwitcher } from '@/components/listing/brand-switcher';
import { MOCK_VERSIONS, type ListingVersion } from '@/lib/mock-data';

export default function ListingEditorPage() {
  const [versions] = useState(MOCK_VERSIONS);
  const [selectedVersion, setSelectedVersion] = useState<ListingVersion>(MOCK_VERSIONS[2]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [copilotOpen, setCopilotOpen] = useState(true);

  const activeVersion = versions.find((v) => v.status === 'active')!;

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

  return (
    <div className="flex h-screen flex-col">
      {/* Top Navigation */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-brand-surface px-4">
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 text-sm text-brand-text-secondary hover:text-brand-text transition-colors">
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </button>
          <span className="text-zinc-300">/</span>
          <h1 className="text-sm font-medium text-brand-text">PRD-001 · 6QT Slow Cooker</h1>
        </div>

        <div className="flex items-center gap-3">
          <BrandSwitcher />
          <button className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-sm font-medium text-white shadow-xs hover:opacity-90 transition-opacity">
            <Save className="h-3.5 w-3.5" />
            保存
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </div>
      </header>

      {/* Main Content: Three Columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Version Timeline */}
        <aside className="w-[180px] shrink-0 border-r bg-brand-surface overflow-y-auto">
          <VersionTimeline
            versions={versions}
            selected={selectedVersion}
            onSelect={setSelectedVersion}
          />
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
        </main>

        {/* Right: AI Copilot Panel */}
        {copilotOpen && (
          <aside className="w-[280px] shrink-0 border-l bg-brand-surface overflow-y-auto">
            <AiCopilotPanel
              currentVersion={selectedVersion}
              onGenerate={startGeneration}
              disabled={isGenerating}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
