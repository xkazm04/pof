'use client';

import { create } from 'zustand';
import type { BatchDrainSummary } from './batchDrainModel';

/**
 * What a cancel ACTUALLY achieved, resolved once a batch run finishes. The batch is one
 * uninterruptible editor request, so a cancel can only ever skip the automatic retry after a
 * lease conflict — and quite often there is no retry left to skip.
 */
export type BatchCancelEffect =
  /** The 409 retry was suppressed — the cancel removed real remaining work. */
  | 'skipped-retry'
  /** The batch had already spent its only attempt: the cancel stopped nothing. */
  | 'nothing-to-skip';

/**
 * One drain THIS lab session launched. Runs are keyed by run id — a batch by its catalog
 * (`batchRunId`), an entity drain by `${catalogId}/${entityId}` — never by the component that
 * started them or by whichever catalog the viewer has open now. The observer is not the owner:
 * the Matrix panel, the coach and the header ActivityChip all READ a run; leaving the Matrix or
 * switching the catalog picker neither ends a run nor relabels it.
 */
export interface DrainRun {
  id: string;
  kind: 'batch' | 'entity';
  catalogId: string;
  entityIds: string[];
  /** Human scope for the header ("items · 3 sets", "items/e9"). */
  scope: string;
  phase: 'running' | 'done';
  /** A cancel click registered for the live run (it cannot recall the request in flight). */
  cancelRequested: boolean;
  /** What the cancel achieved, once the run resolved; null when none was requested. */
  cancelEffect: BatchCancelEffect | null;
  /** Batch roll-up: live (empty) counts while running, the final flips once done. */
  summary: BatchDrainSummary | null;
  startedAt: number;
}

export interface DrainRunStart {
  id: string;
  kind: DrainRun['kind'];
  catalogId: string;
  entityIds: string[];
  scope: string;
  /** Initial summary (a batch shows live zero counts while running). */
  summary?: BatchDrainSummary | null;
}

export interface LabRunnerState {
  runs: Record<string, DrainRun>;
  /**
   * DERIVED (recomputed by every action, never written directly): the human scope of every
   * live run, or null when none is live. `useLabActivity` skips the lease poll while it is set —
   * our own drain is authoritative for the lease it took.
   */
  localDrain: string | null;
  /** Start a run. Refused (false) while a run with the same id is still live. */
  beginRun: (start: DrainRunStart) => boolean;
  /** Register a cancel on a live run. False when no live run has that id. */
  requestCancel: (id: string) => boolean;
  /** Record a run's end: `null` drops it (an entity drain shows its outcome in the coach). */
  finishRun: (id: string, result: { summary: BatchDrainSummary | null; cancelEffect: BatchCancelEffect | null } | null) => void;
  /** Drop a finished run. Ignored while it is live — a running drain cannot be dismissed. */
  dismissRun: (id: string) => void;
}

/** The run id of a catalog's batch drain (one batch per catalog at a time). */
export const batchRunId = (catalogId: string) => `batch:${catalogId}`;

/** Live runs in start order. */
export function liveRuns(runs: readonly DrainRun[]): DrainRun[] {
  return runs.filter((r) => r.phase === 'running').sort((a, b) => a.startedAt - b.startedAt);
}

/** The scope a run reports in the header, carrying a registered cancel. */
export const runScope = (r: DrainRun) => (r.cancelRequested ? `${r.scope} · cancel requested` : r.scope);

function derive(runs: Record<string, DrainRun>): Pick<LabRunnerState, 'runs' | 'localDrain'> {
  const live = liveRuns(Object.values(runs));
  return { runs, localDrain: live.length ? live.map(runScope).join(' + ') : null };
}

let startSeq = 0;

export const useLabRunnerStore = create<LabRunnerState>((set, get) => ({
  runs: {},
  localDrain: null,
  beginRun: (start) => {
    if (get().runs[start.id]?.phase === 'running') return false;
    // A strictly increasing start stamp keeps start order stable within one millisecond.
    startSeq = Math.max(startSeq + 1, Date.now());
    const run: DrainRun = {
      id: start.id, kind: start.kind, catalogId: start.catalogId, entityIds: [...start.entityIds], scope: start.scope,
      phase: 'running', cancelRequested: false, cancelEffect: null, summary: start.summary ?? null, startedAt: startSeq,
    };
    set(derive({ ...get().runs, [start.id]: run }));
    return true;
  },
  requestCancel: (id) => {
    const run = get().runs[id];
    if (!run || run.phase !== 'running') return false;
    if (!run.cancelRequested) set(derive({ ...get().runs, [id]: { ...run, cancelRequested: true } }));
    return true;
  },
  finishRun: (id, result) => {
    const run = get().runs[id];
    if (!run) return;
    const next = { ...get().runs };
    if (result) next[id] = { ...run, phase: 'done', cancelRequested: false, cancelEffect: result.cancelEffect, summary: result.summary };
    else delete next[id];
    set(derive(next));
  },
  dismissRun: (id) => {
    const run = get().runs[id];
    if (!run || run.phase === 'running') return;
    const next = { ...get().runs };
    delete next[id];
    set(derive(next));
  },
}));
