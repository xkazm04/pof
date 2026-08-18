'use client';

import { useCallback, useRef, useState } from 'react';
import { UI_TIMEOUTS } from '@/lib/constants';
import { invalidateArtifacts } from '../labArtifactCache';
import { drainCatalogGates } from '../labArtifactClient';
import { useLabRunnerStore } from '../labRunnerStore';
import { emptyBatchSummary, summarizeBatchDrain, type BatchDrainSummary } from '../batchDrainModel';

export interface BatchEntity { id: string; name: string }

/**
 * What a cancel ACTUALLY achieved, resolved once the run finishes. The batch is one
 * uninterruptible editor boot, so a cancel can only ever skip the automatic retry after a
 * lease conflict — and quite often there is no retry left to skip. Reporting that plainly
 * is the difference between an honest control and one that implies it stopped a UE boot.
 */
export type BatchCancelEffect =
  /** The 409 retry was suppressed — the cancel removed real remaining work. */
  | 'skipped-retry'
  /** The batch had already spent its only attempt: the cancel stopped nothing. */
  | 'nothing-to-skip';

export interface BatchDrainState {
  running: boolean;
  /**
   * A cancel click has REGISTERED for the in-flight run. Distinct from `running:false` —
   * the boot is still going, we simply know the operator asked to stop. Without it the
   * button was inert on click and the operator could not tell the request had landed.
   */
  cancelRequested: boolean;
  /** What the cancel achieved, once the run resolved. Null when no cancel was requested. */
  cancelEffect: BatchCancelEffect | null;
  /** The entities being drained in the in-flight batch (for the live grid highlight); empty when idle. */
  activeEntityIds: Set<string>;
  /** Entities whose drain has resolved this run (the whole requested set, once the batch returns). */
  doneEntityIds: Set<string>;
  /** Final summary of flips. Null before a run starts. */
  summary: BatchDrainSummary | null;
  /** Total entities queued this run. */
  total: number;
}

const IDLE: BatchDrainState = { running: false, cancelRequested: false, cancelEffect: null, activeEntityIds: new Set(), doneEntityIds: new Set(), summary: null, total: 0 };

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
 *   a running batch. The click still REGISTERS visibly (`cancelRequested`), and when the run
 *   resolves the state reports what the cancel achieved (`cancelEffect`): it skipped the retry,
 *   or it had nothing left to skip. A control that silently did nothing was the lie here.
 */
export function useBatchDrain(catalogId: string, retryDelayMs: number = UI_TIMEOUTS.nextTaskDelay) {
  const [state, setState] = useState<BatchDrainState>(IDLE);
  const cancelRef = useRef(false);
  const runningRef = useRef(false);

  /**
   * Request a cancel. It cannot abort the in-flight editor boot (that is a server/runner
   * capability we do not have), so all it does is suppress the automatic retry after a
   * lease conflict — but it now SAYS it registered (`cancelRequested`), and the run reports
   * what the request actually achieved (`cancelEffect`). A cancel outside a live run is a
   * no-op, so a stale summary can never grow a cancel note.
   */
  const cancel = useCallback(() => {
    if (!runningRef.current) return;
    cancelRef.current = true;
    setState((s) => (s.cancelRequested ? s : { ...s, cancelRequested: true }));
  }, []);

  const start = useCallback(async (entities: BatchEntity[]) => {
    if (runningRef.current || entities.length === 0) return;
    runningRef.current = true;
    cancelRef.current = false;

    const ids = entities.map((e) => e.id);
    setState({ running: true, cancelRequested: false, cancelEffect: null, activeEntityIds: new Set(ids), doneEntityIds: new Set(), summary: emptyBatchSummary(), total: entities.length });
    // Publish this session's batch-drain scope so the header runner chip shows "draining …".
    const scope = `${catalogId} · ${entities.length} set${entities.length > 1 ? 's' : ''}`;
    useLabRunnerStore.getState().setLocalDrain(scope);

    try {
      // ONE request for the whole set (one collection + one grouped editor boot).
      let outcome = await drainCatalogGates(catalogId, ids);
      // All-or-nothing lease: a 409 refuses the whole batch — retry once, then record all locked.
      // `retrySkipped` records whether a cancel actually REMOVED work, so the outcome can say
      // "skipped the retry" only when it really did.
      let retrySkipped = false;
      if (outcome.kind === 'locked') {
        if (cancelRef.current) retrySkipped = true;
        else {
          await sleep(retryDelayMs);
          if (cancelRef.current) retrySkipped = true;
          else outcome = await drainCatalogGates(catalogId, ids);
        }
      }

      const summary = summarizeBatchDrain(entities, outcome);
      invalidateArtifacts(catalogId); // whole-catalog invalidate → grid refetches every entity live

      setState({
        running: false,
        cancelRequested: false,
        // A cancel that arrived after the only attempt had resolved stopped NOTHING — say so
        // rather than letting the operator read the finished run as "my cancel worked".
        cancelEffect: cancelRef.current ? (retrySkipped ? 'skipped-retry' : 'nothing-to-skip') : null,
        activeEntityIds: new Set(), doneEntityIds: new Set(ids), summary, total: entities.length,
      });
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
