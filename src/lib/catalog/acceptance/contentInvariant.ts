import type { Checker } from './types';

/**
 * The CONTENT-INVARIANT marker.
 *
 * A checker is a content invariant when a WRONG NUMBER makes it fail — as opposed to a
 * shape checker (`fieldsPopulated`, `minCount`, `minLength`) which only asks whether a field
 * is present/long/numerous. The fleet audit (`step-facts.json`) found 277/342 checkers were
 * shape-only, so one Produce click yielded 300 pass / 0 fail: nothing a step could write was
 * ever wrong. Marking the invariants lets the fleet spec linter ENFORCE adoption (every
 * `archetype: 'balance'` step must compose at least one) instead of it being a convention
 * nobody can measure.
 *
 * The mark rides on the checker function itself (a symbol property, invisible to callers) and
 * `allOf` propagates it, so `allOf(fieldsPopulated(...), budgetWithinCap(...))` is a content
 * invariant while `allOf(fieldsPopulated(...), minCount(...))` is not.
 */
const CONTENT_INVARIANT = Symbol.for('pof.acceptance.contentInvariant');

/** Tag a checker as a content invariant (a wrong VALUE fails it). Returns the same function. */
export function markContentInvariant<T extends Checker>(checker: T): T {
  Object.defineProperty(checker, CONTENT_INVARIANT, { value: true, enumerable: false });
  return checker;
}

/** Does this checker (or, via `allOf`, any checker it composes) grade real values? */
export function isContentInvariant(checker: Checker): boolean {
  return (checker as unknown as Record<symbol, unknown>)[CONTENT_INVARIANT] === true;
}
