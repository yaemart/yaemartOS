'use client';

import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDevPreview } from '@/providers/dev-preview-provider';
import { useBrand } from '@/providers/brand-provider';
import { useEffect } from 'react';

interface DevPreviewShellProps {
  adminContent: ReactNode;
  portalContent: ReactNode;
}

export function DevPreviewShell({ adminContent, portalContent }: DevPreviewShellProps) {
  const { state } = useDevPreview();
  const { setBrand } = useBrand();

  useEffect(() => {
    setBrand(state.brand);
  }, [state.brand, setBrand]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${state.mode}-${state.brand}-${state.locale}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="h-full"
        data-mode={state.mode}
        data-locale={state.locale}
      >
        {state.mode === 'admin' ? adminContent : portalContent}
      </motion.div>
    </AnimatePresence>
  );
}
