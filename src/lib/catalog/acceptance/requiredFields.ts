/**
 * The fields a step's checker GRADES, exposed so the produce prompt can name them.
 *
 * Measured 2026-09-22 (/diablo W02c): of 114 steps whose checker states required keys, 102 had produce
 * prompts that never named at least one of them — every producer, the app's own Claude CLI included,
 * was graded against a schema it was never shown (codex reproduced a zombie's Stat Block exactly and
 * still failed, nesting the values under its own keys). The schema already lives in the checkers;
 * this reads it back out.
 */
import { allOfMembers } from './combinators';
import type { Checker } from './types';

const REQUIRED_FIELDS = Symbol.for('pof.requiredFields');

export interface RequiredFields {
  /** The top-level artifact field (an object). */
  field: string;
  /** Keys the checker requires inside it. */
  keys: string[];
}

export function tagRequiredFields<T extends Checker>(checker: T, req: RequiredFields): T {
  Object.defineProperty(checker, REQUIRED_FIELDS, { value: req, enumerable: false });
  return checker;
}

/** Every required field a checker grades, through `allOf` compositions, merged per field. */
export function requiredFieldsOf(checker: Checker): RequiredFields[] {
  const byField = new Map<string, Set<string>>();
  const visit = (c: Checker) => {
    const own = (c as unknown as Record<symbol, RequiredFields | undefined>)[REQUIRED_FIELDS];
    if (own) {
      const keys = byField.get(own.field) ?? new Set<string>();
      for (const k of own.keys) keys.add(k);
      byField.set(own.field, keys);
    }
    for (const m of allOfMembers(c) ?? []) visit(m);
  };
  visit(checker);
  return [...byField].map(([field, keys]) => ({ field, keys: [...keys] }));
}
