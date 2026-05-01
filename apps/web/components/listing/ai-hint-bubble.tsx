'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiHintBubbleProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
  inline?: boolean;
}

export function AiHintBubble({
  message,
  actionLabel,
  onAction,
  onDismiss,
  inline,
}: AiHintBubbleProps) {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return null;
  }

  function handleDismiss() {
    setVisible(false);
    onDismiss();
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          role="tooltip"
          aria-label={message}
          className={cn(
            'z-tooltip rounded-lg border border-violet-200 bg-violet-50 p-3 shadow-md',
            inline ? 'mt-3 max-w-[320px]' : 'absolute -right-2 top-full mt-1 max-w-[220px]',
          )}
        >
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
            <p className="text-xs text-violet-700 leading-relaxed">{message}</p>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={handleDismiss}
              className="text-[11px] text-violet-500 hover:text-violet-700 transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={onAction}
              className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-violet-700 transition-colors"
            >
              <Sparkles className="h-2.5 w-2.5" />
              {actionLabel}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
