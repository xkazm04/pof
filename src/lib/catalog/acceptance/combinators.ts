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
  // Record the members ON the composed function (a symbol property, invisible to callers and
  // to every existing consumer). `allOf` reports the FIRST non-pass, so the tier and reason a
  // reader sees belong to whichever member spoke — and nothing on screen said which one.
  // `explainAcceptance` reads this back to name it. Metadata only: grading is untouched.
  Object.defineProperty(composed, ALL_OF_MEMBERS, { value: checkers, enumerable: false });
  // A composition is a content invariant iff at least one member grades real values —
  // so `allOf(<shape check>, budgetWithinCap(...))` counts and the spec linter can see it.
  return checkers.some(isContentInvariant) ? markContentInvariant(composed) : composed;
}

const ALL_OF_MEMBERS = Symbol.for('pof.acceptance.allOfMembers');

/** The checkers an {@link allOf} composition runs, in order — `undefined` for a plain checker. */
export function allOfMembers(checker: Checker): Checker[] | undefined {
  const members = (checker as unknown as Record<symbol, unknown>)[ALL_OF_MEMBERS];
  return Array.isArray(members) ? (members as Checker[]) : undefined;
}
