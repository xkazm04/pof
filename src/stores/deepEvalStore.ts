'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';

/** The findings of the most recent deep-eval scan, kept so the next scan can be diffed against it. */
export interface StoredScan {
  scanId: string;
  /** Scan completion time (ms epoch) — used as the `--since` window for git attribution. */
  timestamp: number;
  findings: EvalFinding[];
}

interface DeepEvalState {
  /** The previous scan's findings, persisted so regression diffing survives reloads. */
  lastScan: StoredScan | null;
  recordScan: (scan: StoredScan) => void;
  clearBaseline: () => void;
}

/**
 * Persists the last deep-eval scan so a fresh scan can be diffed against it
 * (NEW / RESOLVED / PERSISTING). Only the single most-recent baseline is kept to
 * bound localStorage size.
 */
export const useDeepEvalStore = create<DeepEvalState>()(
  persist(
    (set) => ({
      lastScan: null,
      recordScan: (scan) => set({ lastScan: scan }),
      clearBaseline: () => set({ lastScan: null }),
    }),
    {
      name: 'pof-deep-eval',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lastScan: state.lastScan }),
    },
  ),
);
