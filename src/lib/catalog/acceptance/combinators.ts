import { isContentInvariant, markContentInvariant } from './contentInvariant';
import type { AcceptanceResult, Checker } from './types';

/**
 * Compose several `Checker`s into one that a step can use as its single `accept`.
 *
 * Semantics: run each checker (forwarding the same `data` + optional `ctx`), then return
 * the FIRST `fail`/`pending` result, else the first `deferred` ({@link spokeIndex}) — so a step
 * reports the first thing that isn't satisfied, with that checker's own specific `reason`, and a
 * deferral never masks a later failure. When every checker passes, the FIRST result is
 * returned (its label/tier stand in as the step's headline verdict). This lets a step layer
 * a content/link invariant on top of its base shape check without a bespoke checker body.
 */
export function allOf(...checkers: Checker[]): Checker {
  const composed: Checker = (data, ctx) => {
    const results = checkers.map((c) => c(data, ctx));
    // An empty conjunction measured nothing: deferred, never a pass and never undefined.
    if (results.length === 0) return EMPTY_COMPOSITION;
    return results[spokeIndex(results)];
  };
  // Record the members ON the composed function (a symbol property, invisible to callers and
  // to every existing consumer). `allOf` reports the first fail/pending (else deferral), so the tier and reason a
  // reader sees belong to whichever member spoke — and nothing on screen said which one.
  // `explainAcceptance` reads this back to name it. Metadata only: grading is untouched.
  Object.defineProperty(composed, ALL_OF_MEMBERS, { value: checkers, enumerable: false });
  // A composition is a content invariant iff at least one member grades real values —
  // so `allOf(<shape check>, budgetWithinCap(...))` counts and the spec linter can see it.
  return checkers.some(isContentInvariant) ? markContentInvariant(composed) : composed;
}

const EMPTY_COMPOSITION: AcceptanceResult = {
  label: 'No checks composed',
  tier: 'L0',
  status: 'deferred',
  detail: 'allOf() was composed with no members',
  reason: 'No checks were composed for this step, so nothing was measured.',
};

const ALL_OF_MEMBERS = Symbol.for('pof.acceptance.allOfMembers');

/**
 * Which member's result an {@link allOf} reports: the FIRST `fail`/`pending`, else the first
 * non-pass (a `deferred`), else the first result. A `deferred` is a config-complete terminal
 * status that the server overlay may later replace with a drain pass, so it must never speak over
 * a later member that fails or is still pending — an unresolved link (deferred) used to hide a
 * stub wiring contract (fail). Shared with `explainAcceptance` so the two cannot disagree.
 */
export function spokeIndex(results: readonly AcceptanceResult[]): number {
  const blocking = results.findIndex((r) => r.status === 'fail' || r.status === 'pending');
  if (blocking !== -1) return blocking;
  const nonPass = results.findIndex((r) => r.status !== 'pass');
  return nonPass === -1 ? 0 : nonPass;
}

/** The checkers an {@link allOf} composition runs, in order — `undefined` for a plain checker. */
export function allOfMembers(checker: Checker): Checker[] | undefined {
  const members = (checker as unknown as Record<symbol, unknown>)[ALL_OF_MEMBERS];
  return Array.isArray(members) ? (members as Checker[]) : undefined;
}
