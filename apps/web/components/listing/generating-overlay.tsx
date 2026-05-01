'use client';

import { motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';

interface GeneratingOverlayProps {
  progress: number;
  onCancel: () => void;
}

export function GeneratingOverlay({ progress, onCancel }: GeneratingOverlayProps) {
  const stage =
    progress < 30
      ? 'Analyzing product attributes...'
      : progress < 60
        ? 'Generating bullets (3/5)...'
        : progress < 85
          ? 'Writing description...'
          : 'Finalizing keywords...';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-overlay flex items-center justify-center bg-white/80 backdrop-blur-[2px]"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-[320px] rounded-xl border bg-white p-6 shadow-lg text-center"
      >
        {/* Animated icon */}
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100"
        >
          <Sparkles className="h-6 w-6 text-violet-600" />
        </motion.div>

        <h3 className="text-sm font-semibold text-brand-text">AI is generating v3...</h3>
        <p className="mt-1 text-xs text-brand-text-secondary">{stage}</p>

        {/* Progress bar */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-violet-100">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <p className="mt-1.5 text-xs font-mono text-brand-text-secondary tabular-nums">
          {Math.round(progress)}%
        </p>

        {/* Cancel */}
        <button
          onClick={onCancel}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-brand-text-secondary hover:bg-zinc-50 hover:text-brand-text transition-colors"
        >
          <X className="h-3 w-3" />
          Cancel Generation
        </button>
      </motion.div>
    </motion.div>
  );
}
