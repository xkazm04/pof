'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  runPredictiveBalanceAsync,
  type BalanceReport,
  type PredictiveBalanceConfig,
} from '@/lib/combat/predictive-balance';
import type { ArchetypeRegistry, EnemySourceReport } from '@/lib/combat/simulation-engine';
import { usePaneHold } from '@/hooks/usePaneHold';
import { logger } from '@/lib/logger';

export interface SweepProgress {
  done: number;
  total: number;
}

export interface PredictiveSweep {
  /** The last COMPLETED sweep's report; a cancelled run never replaces it. */
  report: BalanceReport | null;
  running: boolean;
  /** Cells done / total for the run in flight; null when idle. */
  progress: SweepProgress | null;
  /** Why the last run failed (not set by a cancel). */
  error: string | null;
  /** Start a sweep. A run already in flight is aborted — the last request wins. */
  run(config: PredictiveBalanceConfig, enemies?: { registry: ArchetypeRegistry; provenance?: EnemySourceReport }): void;
  /** Abort the run in flight; the previous report stays. */
  cancel(): void;
}

const HOLD_REASON = 'Predictive balance sweep running';

/**
 * The predictive sweep as a cancellable job bound to this component: drives
 * `runPredictiveBalanceAsync` with an AbortController, publishes per-cell
 * progress, aborts on unmount, and holds the shell pane while running so the
 * keep-alive LRU does not evict (and so cancel) it.
 */
export function usePredictiveSweep(): PredictiveSweep {
  const [report, setReport] = useState<BalanceReport | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<SweepProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  usePaneHold(running, HOLD_REASON);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setRunning(false);
    setProgress(null);
  }, []);

  const run = useCallback<PredictiveSweep['run']>((config, enemies) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const isCurrent = () => controllerRef.current === controller;
    setRunning(true);
    setError(null);

    runPredictiveBalanceAsync(config, enemies, {
      signal: controller.signal,
      onProgress: (done, total) => { if (isCurrent()) setProgress({ done, total }); },
    }).then(
      (result) => {
        if (!isCurrent() || result.aborted) return;
        controllerRef.current = null;
        setReport(result);
        setRunning(false);
        setProgress(null);
      },
      (err: unknown) => {
        if (!isCurrent()) return;
        logger.warn('[predictive-sweep] run failed', err);
        controllerRef.current = null;
        setError(err instanceof Error ? err.message : String(err));
        setRunning(false);
        setProgress(null);
      },
    );
  }, []);

  // Unmount aborts the job; nothing it resolves can land afterwards.
  useEffect(() => () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  return { report, running, progress, error, run, cancel };
}
