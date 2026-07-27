'use client';

import { useCallback, useRef, useState } from 'react';
import { UI_TIMEOUTS } from '@/lib/constants';
import { invalidateArtifacts } from '../labArtifactCache';
import { drainCatalogGates } from '../labArtifactClient';
import { useLabRunnerStore } from '../labRunnerStore';
import { emptyBatchSummary, summarizeBatchDrain, type BatchDrainSummary } from '../batchDrainModel';

export interface BatchEntity { id: string; name: string }

export interface BatchDrainState {
  running: boolean;
  /** The entities being drained in the in-flight batch (for the live grid highlight); empty when idle. */
  activeEntityIds: Set<string>;
  /** Entities whose drain has resolved this run (the whole requested set, once the batch returns). */
  doneEntityIds: Set<string>;
  /** Final summary of flips. Null before a run starts. */
  summary: BatchDrainSummary | null;
  /** Total entities queued this run. */
  total: number;
}

const IDLE: BatchDrainState = { running: false, activeEntityIds: new Set(), doneEntityIds: new Set(), summary: null, total: 0 };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Batch drain of every deferred-gate entity in a catalog in ONE request. The server runs
 * one artifact collection + one grouped editor boot for every gate across the whole set (the
 * all-or-nothing batch lease), so — unlike the old per-entity serial loop — this pays a SINGLE
 * editor boot for the entire catalog, not one per entity. Behaviour:
 *
 * - On HTTP 409 (the batch lease is held — another drain has ANY of these entities in flight)
 *   it waits `retryDelayMs` and retries the whole batch once; if still locked it records EVERY
 *   requested entity as locked (`entitiesLocked`) — no silent skip.
 * - The shared artifact cache is invalidated for the catalog when the batch resolves, so the
 *   grid refetches and updates live.
 * - Cancel is honest about the all-or-nothing contract: the in-flight editor boot cannot be
 *   interrupted, so `cancel()` only prevents the automatic RETRY after a 409 — it never aborts
 *   a running batch (the UI says so).
 */
export function useBatchDrain(catalogId: string, retryDelayMs: number = UI_TIMEOUTS.nextTaskDelay) {
  const [state, setState] = useState<BatchDrainState>(IDLE);
  const cancelRef = useRef(false);
  const runningRef = useRef(false);

  const cancel = useCallback(() => { cancelRef.current = true; }, []);

  const start = useCallback(async (entities: BatchEntity[]) => {
    if (runningRef.current || entities.length === 0) return;
    runningRef.current = true;
    cancelRef.current = false;

    const ids = entities.map((e) => e.id);
    setState({ running: true, activeEntityIds: new Set(ids), doneEntityIds: new Set(), summary: emptyBatchSummary(), total: entities.length });
    // Publish this session's batch-drain scope so the header runner chip shows "draining …".
    const scope = `${catalogId} · ${entities.length} set${entities.length > 1 ? 's' : ''}`;
    useLabRunnerStore.getState().setLocalDrain(scope);

    try {
      // ONE request for the whole set (one collection + one grouped editor boot).
      let outcome = await drainCatalogGates(catalogId, ids);
      // All-or-nothing lease: a 409 refuses the whole batch — retry once, then record all locked.
      if (outcome.kind === 'locked' && !cancelRef.current) {
        await sleep(retryDelayMs);
        if (!cancelRef.current) outcome = await drainCatalogGates(catalogId, ids);
      }

      const summary = summarizeBatchDrain(entities, outcome);
      invalidateArtifacts(catalogId); // whole-catalog invalidate → grid refetches every entity live

      setState({ running: false, activeEntityIds: new Set(), doneEntityIds: new Set(ids), summary, total: entities.length });
    } finally {
      runningRef.current = false;
      // Only clear the header lease if it is still OURS. A per-entity coach drain (or a
      // later batch) may have taken the chip over while this batch was in flight — clearing
      // unconditionally blanked "draining …" while that drain was still live, which is a lie.
      // Mirrors the per-entity ownership guard in Baseline/useBaseline.ts.
      const runner = useLabRunnerStore.getState();
      if (runner.localDrain === scope) runner.setLocalDrain(null);
    }
  }, [catalogId, retryDelayMs]);

  /** Dismiss the finished run's summary (the matrix header pins it until told otherwise).
   *  Ignored while a batch is in flight — you can't dismiss a live run's counters. */
  const reset = useCallback(() => { if (!runningRef.current) setState(IDLE); }, []);

  return { state, start, cancel, reset };
}
