'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Clock, Scan } from 'lucide-react';
import { motionSafe } from '@/lib/motion';
import type { PatternDetection } from '@/types/telemetry';

export function ScanHistory({ history }: { history: { id: string; scannedAt: string; detectedPatterns: PatternDetection[] }[] }) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionSafe({ duration: 0.22, delay: 0.2 }, prefersReduced)}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Clock className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-xs uppercase tracking-wider text-text-muted font-semibold">
          Scan History
        </span>
      </div>
      <div className="space-y-1">
        {history.slice(0, 5).map((snap, i) => (
          <motion.div
            key={snap.id}
            initial={prefersReduced ? { opacity: 1, x: 0 } : { opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={motionSafe({ duration: 0.12, delay: i * 0.03 }, prefersReduced)}
            className="flex items-center gap-3 px-3 py-2 bg-surface-deep border border-border rounded-lg"
          >
            <Scan className="w-3 h-3 text-text-muted flex-shrink-0" />
            <span className="text-xs text-text-muted-hover flex-1">
              {new Date(snap.scannedAt).toLocaleString()}
            </span>
            <span className="text-2xs text-text-muted">
              {snap.detectedPatterns.length} pattern{snap.detectedPatterns.length !== 1 ? 's' : ''}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
