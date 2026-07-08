'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { motionSafe } from '@/lib/motion';
import { ScoreRing } from '@/components/ui/ScoreRing';
import type { PatternDetection } from '@/types/telemetry';
import { formatPatternName } from './helpers';

export function PatternsList({ patterns }: { patterns: PatternDetection[] }) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionSafe({ duration: 0.22, delay: 0.05 }, prefersReduced)}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Activity className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-xs uppercase tracking-wider text-text-muted font-semibold">
          Detected Patterns
        </span>
        <span className="text-2xs text-text-muted">{patterns.length} found</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {patterns.map((p, i) => (
          <motion.div
            key={p.pattern}
            initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionSafe({ duration: 0.22, delay: i * 0.03 }, prefersReduced)}
            className="flex items-start gap-2.5 px-3 py-2.5 bg-surface-deep border border-border rounded-lg"
          >
            <ScoreRing value={p.confidence} size={28} strokeWidth={2} labelClassName="text-2xs font-bold text-text" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-text block">
                {formatPatternName(p.pattern)}
              </span>
              {p.evidence.length > 0 && (
                <span className="text-2xs text-text-muted line-clamp-2 block mt-0.5">
                  {p.evidence[0]}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
