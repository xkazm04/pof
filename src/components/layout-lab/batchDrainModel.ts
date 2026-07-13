import type { DrainSummary } from '@/lib/test-gate-runner/types';

/**
 * Pure model for the Matrix-level batch drain (Direction 2). The UE test-gate runner
 * is single-lease by design — one `catalogId|entityId` at a time — so a whole-catalog
 * drain must iterate entities SERIALLY. This module holds the outcome type + the
 * fold that accumulates per-entity results into one catalog-wide summary of flips,
 * kept side-effect-free so the summary derivation is unit-testable in isolation.
 */

/** The result of draining ONE entity's deferred gates. */
export type DrainOutcome =
  | { kind: 'ok'; summary: DrainSummary }
  /** The per-entity lease was held (HTTP 409) even after a retry — skipped, recorded. */
  | { kind: 'locked' }
  /** Network / server error — surfaced, never silently swallowed. */
  | { kind: 'error'; reason: string };

/** One failed gate in the batch, carrying the checker's reason (no silent fails). */
export interface BatchFail {
  entityId: string;
  entityName: string;
  step: string;
  reason: string;
}

/** Catalog-wide roll-up of a batch drain. */
export interface BatchDrainSummary {
  /** Entities we actually drained (got a runner summary back). */
  entitiesRun: number;
  /** Entities skipped because their lease stayed held after a retry. */
  entitiesLocked: number;
  /** Entities whose drain errored (network/server). */
  entitiesErrored: number;
  /** Gates run across all entities. */
  ran: number;
  /** deferred → pass flips. */
  passed: number;
  /** deferred → fail flips. */
  failed: number;
  /** Gates the runner left deferred (still not runnable). */
  skipped: number;
  /** Per-step fail details (checker reasons). */
  fails: BatchFail[];
}

export function emptyBatchSummary(): BatchDrainSummary {
  return { entitiesRun: 0, entitiesLocked: 0, entitiesErrored: 0, ran: 0, passed: 0, failed: 0, skipped: 0, fails: [] };
}

/**
 * Fold one entity's outcome into the running summary (mutates + returns `acc`). A
 * `locked`/`error` outcome is counted but contributes no flips; an `ok` outcome adds
 * the runner's counts and appends every failed gate's reason.
 */
export function foldEntityOutcome(
  acc: BatchDrainSummary,
  entityId: string,
  entityName: string,
  outcome: DrainOutcome,
): BatchDrainSummary {
  if (outcome.kind === 'locked') { acc.entitiesLocked++; return acc; }
  if (outcome.kind === 'error') { acc.entitiesErrored++; return acc; }
  const s = outcome.summary;
  acc.entitiesRun++;
  acc.ran += s.ran;
  acc.passed += s.passed;
  acc.failed += s.failed;
  acc.skipped += s.skipped;
  for (const r of s.results) {
    if (r.verdict?.status === 'fail') {
      acc.fails.push({ entityId, entityName, step: r.job.step, reason: r.verdict.detail || 'failed acceptance' });
    }
  }
  return acc;
}
