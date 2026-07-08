'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Dna, Scan } from 'lucide-react';
import { ACCENT } from './constants';

export function EmptyState({ onScan, scanning, hasProject }: { onScan: () => void; scanning: boolean; hasProject: boolean }) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-14 text-center"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: `${ACCENT}08`, border: `1px solid ${ACCENT}15` }}
      >
        <Dna className="w-7 h-7 text-border-bright" />
      </div>
      <h3 className="text-sm font-medium text-text mb-1">No telemetry data yet</h3>
      <p className="text-xs text-text-muted max-w-xs mb-4">
        Scan your UE5 project to detect gameplay patterns and get sub-genre evolution suggestions based on your actual code.
      </p>
      {hasProject ? (
        <button
          onClick={onScan}
          disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: `${ACCENT}15`,
            color: ACCENT,
            border: `1px solid ${ACCENT}30`,
          }}
        >
          <Scan className="w-3.5 h-3.5" />
          {scanning ? 'Scanning...' : 'Run First Scan'}
        </button>
      ) : (
        <p className="text-xs text-text-muted">Set up your project path first in Project Setup.</p>
      )}
    </motion.div>
  );
}
