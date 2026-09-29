/**
 * The ONE feature-done rule.
 *
 * A feature-matrix status is done when it is `implemented` OR `improved`. The
 * app's own Build (the feature-fix callback) lands a feature as `improved`, so
 * a reader that counts only `implemented` never sees its own work finish: the
 * built feature keeps blocking its dependents and the completion % stands still.
 *
 * Every done reader goes through here: `computeBlockers` (every blocked badge),
 * the NBA engine, the planner / topology / unblock walk (via the
 * `@/lib/constellation/layout` re-export), and the evaluator completion
 * roll-ups (`moduleCompletion` / `projectCompletionPct`).
 *
 * Deliberately dependency-free (types only) so `feature-definitions` can import
 * it without a cycle through the constellation layout.
 */

import type { FeatureStatus } from '@/types/feature-matrix';

/** The statuses that count as done. */
export const DONE_STATUSES: readonly FeatureStatus[] = ['implemented', 'improved'];

/**
 * True when a feature status counts as done (implemented OR improved).
 * Accepts the raw string a `featureKey -> status` map carries; an absent status
 * is not done.
 */
export function isFeatureDone(status: string | null | undefined): boolean {
  return status === 'implemented' || status === 'improved';
}

/** Per-module status counts a completion roll-up reads. */
export interface CompletionCounts {
  implemented: number;
  improved: number;
  total: number;
}

/** Fraction (0-1) of a module's features that are done. 0 when it has none. */
export function moduleCompletion(c: CompletionCounts): number {
  return c.total > 0 ? (c.implemented + c.improved) / c.total : 0;
}

/** Project-wide done percentage (0-100, rounded) summed over module counts. */
export function projectCompletionPct(cells: readonly CompletionCounts[]): number {
  let done = 0;
  let total = 0;
  for (const c of cells) {
    done += c.implemented + c.improved;
    total += c.total;
  }
  return total > 0 ? Math.round((done / total) * 100) : 0;
}
