import { isContentInvariant, markContentInvariant } from './contentInvariant';
import type { Checker } from './types';

/**
 * Compose several `Checker`s into one that a step can use as its single `accept`.
 *
 * Semantics: run each checker (forwarding the same `data` + optional `ctx`), then return
 * the FIRST non-`pass` result — so a step reports the first thing that isn't satisfied,
 * with that checker's own specific `reason`. When every checker passes, the FIRST result is
 * returned (its label/tier stand in as the step's headline verdict). This lets a step layer
 * a content/link invariant on top of its base shape check without a bespoke checker body.
 */
export function allOf(...checkers: Checker[]): Checker {
  const composed: Checker = (data, ctx) => {
    const results = checkers.map((c) => c(data, ctx));
    return results.find((r) => r.status !== 'pass') ?? results[0];
  };
  // A composition is a content invariant iff at least one member grades real values —
  // so `allOf(<shape check>, budgetWithinCap(...))` counts and the spec linter can see it.
  return checkers.some(isContentInvariant) ? markContentInvariant(composed) : composed;
}
