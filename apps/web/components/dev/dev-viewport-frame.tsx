'use client';

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useDevPreview } from '@/providers/dev-preview-provider';

const VIEWPORT_WIDTHS = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
} as const;

export function DevViewportFrame({ children }: { children: ReactNode }) {
  const { state } = useDevPreview();
  const isConstrained = state.viewport !== 'desktop';

  return (
    <div
      className={cn(
        'flex-1 overflow-auto transition-all duration-300',
        isConstrained && 'flex items-start justify-center bg-zinc-100 p-6 pb-24',
      )}
    >
      <motion.div
        layout
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className={cn(
          'transition-all duration-300',
          isConstrained && 'rounded-xl border shadow-xl overflow-hidden bg-white',
        )}
        style={{
          width: VIEWPORT_WIDTHS[state.viewport],
          minHeight: isConstrained ? '667px' : '100%',
          maxHeight: isConstrained ? '80vh' : undefined,
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
