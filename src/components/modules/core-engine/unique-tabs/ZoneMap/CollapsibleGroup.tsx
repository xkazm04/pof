'use client';

import { type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ANIMATION_PRESETS, motionSafe } from '@/lib/motion';

interface CollapsibleGroupProps {
  title: string;
  accent: string;
  sectionCount: number;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function CollapsibleGroup({ title, accent, sectionCount, isOpen, onToggle, children }: CollapsibleGroupProps) {
  const prefersReduced = useReducedMotion();
  return (
    <div className="relative" style={{ borderLeft: `3px solid ${accent}40` }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-left rounded-r-lg transition-colors hover:bg-surface-hover/30"
        type="button"
      >
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={prefersReduced ? { duration: 0 } : { duration: 0.2 }}
        >
          <ChevronRight className="w-4 h-4 text-text-muted" />
        </motion.div>
        <span className="text-sm font-bold text-text tracking-wide">{title}</span>
        <span
          className="text-2xs font-mono px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}
        >
          {sectionCount}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={prefersReduced ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={prefersReduced ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={motionSafe(ANIMATION_PRESETS.entrance, prefersReduced)}
            style={{ overflow: 'hidden' }}
          >
            <div className="space-y-4 pl-2 pt-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
