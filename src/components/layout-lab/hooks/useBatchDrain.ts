'use client';

import { useCallback, useMemo } from 'react';
import { UI_TIMEOUTS } from '@/lib/constants';
import { invalidateArtifacts } from '../labArtifactCache';
import { drainCatalogGates } from '../labArtifactClient';
import { batchRunId, useLabRunnerStore, type BatchCancelEffect, type DrainRun } from '../labRunnerStore';
import { emptyBatchSummary, summarizeBatchDrain, type BatchDrainSummary } from '../batchDrainModel';

export type { BatchCancelEffect } from '../labRunnerStore';

export interface BatchEntity { id: string; name: string }

export interface BatchDrainState {
  running: boolean;
  /**
   * A cancel click has REGISTERED for the in-flight run. Distinct from `running:false` —
   * the request is still going, we simply know the operator asked to stop.
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
  /** The catalog this state belongs to — the RUN's catalog, which is the hook's catalog: a run
   *  is looked up by `batchRunId(catalogId)`, so catalog A's run is never shown as B's.
   *  Optional so a hand-built state (tests) needs no change. */
  catalogId?: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Project a stored run onto the shape the Matrix header renders. */
function viewOf(run: DrainRun | undefined, catalogId: string): BatchDrainState {
  if (!run) {
    return { running: false, cancelRequested: false, cancelEffect: null, activeEntityIds: new Set(), doneEntityIds: new Set(), summary: null, total: 0, catalogId };
  }
  const running = run.phase === 'running';
  return {
    running,
    cancelRequested: running && run.cancelRequested,
    cancelEffect: run.cancelEffect,
    activeEntityIds: new Set(running ? run.entityIds : []),
    doneEntityIds: new Set(running ? [] : run.entityIds),
    summary: run.summary,
    total: run.entityIds.length,
    catalogId,
  };
}

/**
 * Run one catalog's batch drain as a STORE-owned job: it records its result in
 * `labRunnerStore` whether or not any Matrix is mounted, so an operator can leave the Matrix,
 * switch catalogs, and come back to the run. Behaviour (unchanged contract):
 *
 * - ONE request for the whole set (one collection + one grouped runner pass through the bridge).
 * - On HTTP 409 (the all-or-nothing batch lease is held) it waits `retryDelayMs` and retries
 *   once; if still locked it records EVERY requested entity as locked — no silent skip.
 * - The artifact cache is invalidated for exactly the DRAINED entities (the entity-scoped form
 *   also drops the whole-catalog key + summary, so the grid and coach refetch server truth).
 * - Cancel cannot interrupt the in-flight request; it only skips the retry, and the finished
 *   run reports what it achieved (`skipped-retry` / `nothing-to-skip`).
 *
 * Resolves without doing anything when this catalog's batch is already live or the set is empty.
 */
export async function runBatchDrain(catalogId: string, entities: BatchEntity[], retryDelayMs: number): Promise<void> {
  if (entities.length === 0) return;
  const id = batchRunId(catalogId);
  const ids = entities.map((e) => e.id);
  const scope = `${catalogId} · ${entities.length} set${entities.length > 1 ? 's' : ''}`;
  const runner = () => useLabRunnerStore.getState();
  if (!runner().beginRun({ id, kind: 'batch', catalogId, entityIds: ids, scope, summary: emptyBatchSummary() })) return;
  const cancelled = () => runner().runs[id]?.cancelRequested === true;

  let summary: BatchDrainSummary;
  let cancelEffect: BatchCancelEffect | null = null;
  try {
    let outcome = await drainCatalogGates(catalogId, ids);
    // `retrySkipped` records whether a cancel actually REMOVED work.
    let retrySkipped = false;
    if (outcome.kind === 'locked') {
      if (cancelled()) retrySkipped = true;
      else {
        await sleep(retryDelayMs);
        if (cancelled()) retrySkipped = true;
        else outcome = await drainCatalogGates(catalogId, ids);
      }
    }
    summary = summarizeBatchDrain(entities, outcome);
    // A cancel that arrived after the only attempt resolved stopped NOTHING — say so.
    if (cancelled()) cancelEffect = retrySkipped ? 'skipped-retry' : 'nothing-to-skip';
    for (const e of ids) invalidateArtifacts(catalogId, e);
  } catch (e) {
    // drainCatalogGates does not throw; a thrown stub is still recorded, never left running.
    summary = summarizeBatchDrain(entities, { kind: 'error', reason: e instanceof Error ? e.message : String(e) });
  }
  runner().finishRun(id, { summary, cancelEffect });
}

/**
 * The Matrix's view of ONE catalog's batch drain. It owns nothing: the run lives in
 * `labRunnerStore` keyed by `batchRunId(catalogId)`, so unmounting the Matrix mid-run loses
 * nothing, and changing `catalogId` shows the new catalog's own run (or none) — never the old
 * catalog's run relabelled. Return shape is unchanged for `MatrixBatchDrain`.
 */
export function useBatchDrain(catalogId: string, retryDelayMs: number = UI_TIMEOUTS.nextTaskDelay) {
  const id = batchRunId(catalogId);
  const run = useLabRunnerStore((s) => s.runs[id]);
  const state = useMemo(() => viewOf(run, catalogId), [run, catalogId]);

  const start = useCallback((entities: BatchEntity[]) => runBatchDrain(catalogId, entities, retryDelayMs), [catalogId, retryDelayMs]);
  /** Register a cancel on this catalog's live run (a no-op outside one). */
  const cancel = useCallback(() => { useLabRunnerStore.getState().requestCancel(id); }, [id]);
  /** Dismiss the finished run's summary. Ignored while the batch is in flight. */
  const reset = useCallback(() => { useLabRunnerStore.getState().dismissRun(id); }, [id]);

  return { state, start, cancel, reset };
}
