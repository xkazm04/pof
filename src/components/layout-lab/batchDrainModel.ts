import type { DrainSummary } from '@/lib/test-gate-runner/types';

/**
 * Pure model for the Matrix-level batch drain. The whole catalog's deferred entities are
 * drained in ONE request (one server-side collection + one grouped editor boot for every
 * gate — the all-or-nothing batch lease), so this module derives ONE catalog-wide summary
 * of flips from the single aggregate {@link DrainSummary} the route returns. Kept
 * side-effect-free so the derivation is unit-testable in isolation.
 */

/** The result of draining the whole batch's deferred gates in one request. */
export type DrainOutcome =
  | { kind: 'ok'; summary: DrainSummary }
  /** The batch lease was held (HTTP 409) even after a retry — the WHOLE set is refused (all-or-nothing). */
  | { kind: 'locked' }
  /** Network / server error — surfaced, never silently swallowed. */
  | { kind: 'error'; reason: string };

/** Minimal entity identity the batch summarizer needs (id → display name for fail rows). */
export interface BatchEntityRef { id: string; name: string }

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
 * Derive the catalog-wide summary from ONE batch outcome covering the whole requested set.
 * - `locked`/`error`: the batch is all-or-nothing, so EVERY requested entity is recorded as
 *   locked / errored (no flips).
 * - `ok`: the aggregate runner counts (`ran/passed/failed/skipped`) carry over verbatim, and
 *   the per-step results — each tagged with its `job.entityId` — are grouped back to their
 *   entities: `entitiesRun` = distinct entities that produced a verdict, and every failed gate
 *   becomes a `fails[]` row with the entity's display name + the checker's reason (no silent fails).
 */
export function summarizeBatchDrain(
  entities: BatchEntityRef[],
  outcome: DrainOutcome,
): BatchDrainSummary {
  const acc = emptyBatchSummary();
  if (outcome.kind === 'locked') { acc.entitiesLocked = entities.length; return acc; }
  if (outcome.kind === 'error') { acc.entitiesErrored = entities.length; return acc; }

  const s = outcome.summary;
  acc.ran = s.ran;
  acc.passed = s.passed;
  acc.failed = s.failed;
  acc.skipped = s.skipped;

  const nameById = new Map(entities.map((e) => [e.id, e.name]));
  const ranEntities = new Set<string>();
  for (const r of s.results) {
    if (r.verdict) ranEntities.add(r.job.entityId);
    if (r.verdict?.status === 'fail') {
      acc.fails.push({
        entityId: r.job.entityId,
        entityName: nameById.get(r.job.entityId) ?? r.job.entityId,
        step: r.job.step,
        reason: r.verdict.detail || 'failed acceptance',
      });
    }
  }
  acc.entitiesRun = ranEntities.size;
  return acc;
}
