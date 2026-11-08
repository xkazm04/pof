'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Dna, Scan } from 'lucide-react';
import { ACCENT } from './constants';

/** `scanCount` > 0 means scans ran and detected nothing — a different state from
 *  "never scanned", and the copy must not invite a FIRST scan over existing history. */
export function EmptyState({ onScan, scanning, hasProject, scanCount = 0 }: { onScan: () => void; scanning: boolean; hasProject: boolean; scanCount?: number }) {
  const hasScanned = scanCount > 0;
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
      <h3 className="text-sm font-medium text-text mb-1">
        {hasScanned ? 'No gameplay patterns detected' : 'No telemetry data yet'}
      </h3>
      <p className="text-xs text-text-muted max-w-xs mb-4">
        {hasScanned
          ? `${scanCount} scan${scanCount !== 1 ? 's' : ''} of this project found no gameplay patterns to suggest a sub-genre from. Re-scan after adding gameplay code.`
          : 'Scan your UE5 project to detect gameplay patterns and get sub-genre evolution suggestions based on your actual code.'}
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
          {scanning ? 'Scanning...' : hasScanned ? 'Scan Again' : 'Run First Scan'}
        </button>
      ) : (
        <p className="text-xs text-text-muted">Set up your project path first in Project Setup.</p>
      )}
    </motion.div>
  );
}
