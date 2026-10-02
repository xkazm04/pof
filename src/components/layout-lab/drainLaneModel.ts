/**
 * drainLaneModel — the UE drain lane of `activityModel`, read off THIS session's keyed drain
 * runs (`labRunnerStore.runs`) plus the server lease. Extracted from `activityModel.ts` (kept
 * under its LOC ceiling); `activityModel` re-exports everything here.
 *
 * A finished drain is reported by its OUTCOME, never as a quiet idle: a batch that failed
 * gates, ran nothing, was refused by the lease or errored is `attention`, and its label ends in
 * `· failed` so the tab title (`tabAttention.fromLabActivity`) records `(Failed)`, not `(Done)`.
 */

import type { ActivityLane, LeaseProbe } from './activityModel';
import type { DrainLeaseState } from './labArtifactClient';
import type { BatchDrainSummary } from './batchDrainModel';
import { liveRuns, runScope, type DrainRun } from './labRunnerStore';
import { ranNothing } from './entityDrainOutcome';

export interface DrainInput {
  /** This session's drain runs (`labRunnerStore.runs`), live and finished. */
  runs?: readonly DrainRun[];
  /** Scope-only input for a live local drain with no run record. Prefer `runs`. */
  localDrain?: string | null;
  lease: DrainLeaseState | null;
  leaseProbe: LeaseProbe;
}

const DRAIN_BLIND_SPOT =
  'Reads the server lease, so it sees other sessions too — but only once a drain has TAKEN the lease. ' +
  'This session’s own drain runs (progress, cancel, result) stay with the lab while you switch views or catalogs, ' +
  'but in memory only: a reload loses them; the lease does not. ' +
  'Executor mode: the lab drains through the UE BRIDGE (an already-running editor) and never spawns one, ' +
  'so a free lease means the runner is available — never that an editor is.';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Why a finished batch needs the operator, or null when it ended clean. */
export function drainProblem(summary: BatchDrainSummary | null): string | null {
  if (!summary) return null;
  if (summary.entitiesErrored > 0) return `errored (${plural(summary.entitiesErrored, 'set')} not drained)`;
  if (summary.entitiesLocked > 0) return `refused — another drain held the lease (${plural(summary.entitiesLocked, 'set')} locked)`;
  if (ranNothing(summary)) return `0 gates ran (${summary.skipped} skipped — no UE editor answered on the bridge)`;
  if (summary.failed > 0) return `${summary.failed} of ${plural(summary.ran, 'gate')} failed`;
  return null;
}

const newestFirst = (a: DrainRun, b: DrainRun) => b.startedAt - a.startedAt;

/**
 * The run the drain lane's ACTIONS are about: the newest live batch (Cancel), else the newest
 * finished batch that needs the operator, else the newest finished batch (Open / Dismiss).
 */
export function drainSubject(runs: readonly DrainRun[]): DrainRun | null {
  const batches = runs.filter((r) => r.kind === 'batch').sort(newestFirst);
  const done = batches.filter((r) => r.phase === 'done');
  return batches.find((r) => r.phase === 'running')
    ?? done.find((r) => drainProblem(r.summary) !== null)
    ?? done[0]
    ?? null;
}

function leaseLane(d: DrainInput, base: Omit<ActivityLane, 'state' | 'label'>): ActivityLane {
  if (d.leaseProbe === 'unpolled') {
    return { ...base, state: 'unknown', label: 'lease not checked yet — a drain started now could be refused' };
  }
  if (d.leaseProbe === 'failed') {
    return { ...base, state: 'unknown', label: 'lease status unreachable — the last check failed' };
  }
  if (d.lease?.held) {
    const scope = d.lease.scope ? ` · ${d.lease.scope}` : '';
    return { ...base, state: 'running-elsewhere', label: `lease held by a drain this page did not start${scope}` };
  }
  return { ...base, state: 'idle', label: 'lease free — the UE editor is available' };
}

export function drainLane(d: DrainInput): ActivityLane {
  const base = { id: 'drain' as const, title: 'UE drain', short: 'drain', blindSpot: DRAIN_BLIND_SPOT };
  const runs = d.runs ?? [];
  const live = liveRuns(runs);
  const scope = live.length ? live.map(runScope).join(' + ') : d.localDrain;
  if (scope) {
    // Not "one editor boot": the lab's drain is bridge-only and boots nothing.
    return { ...base, state: 'running-here', label: `draining ${scope} (via the UE bridge)` };
  }
  const lease = leaseLane(d, base);
  // Another session's live drain is the more significant fact; the finished run stays actionable.
  if (lease.state === 'running-elsewhere') return lease;
  const done = runs.filter((r) => r.kind === 'batch' && r.phase === 'done').sort(newestFirst)
    .find((r) => drainProblem(r.summary) !== null);
  if (done) {
    // A known failure outranks an unchecked lease within this lane — but the label still says
    // the lease is unchecked, so nothing here reads as "safe to drain".
    const note = d.leaseProbe === 'unpolled' ? ' — lease not checked yet' : d.leaseProbe === 'failed' ? ' — lease status unreachable' : '';
    return { ...base, state: 'attention', label: `drain ${done.catalogId} finished: ${drainProblem(done.summary)}${note} · failed` };
  }
  return lease;
}
