/**
 * The fields a step's checker GRADES, exposed so the produce prompt can name them.
 *
 * Measured 2026-09-22 (/diablo W02c): of 114 steps whose checker states required keys, 102 had produce
 * prompts that never named at least one of them — every producer, the app's own Claude CLI included,
 * was graded against a schema it was never shown. The same run then showed the other two shapes of the
 * same defect: a TEXT field graded by length (`lore` ≥ 200 chars) that the prompt never named, and a
 * `wiringContract` whose STRUCTURE (dependencies is an array) was never stated. The schema already lives
 * in the checkers; this reads it back out.
 */
import { allOfMembers } from './combinators';
import type { Checker } from './types';

const REQUIRED_FIELDS = Symbol.for('pof.requiredFields');

export interface RequiredFields {
  /** The artifact field (top level, or a dot-path for a nested contract). */
  field: string;
  /** Keys the checker requires inside an object field. */
  keys?: string[];
  /** A text field graded by length. */
  minChars?: number;
  /** A structural shape, stated in prose, for a field whose FORMAT is graded. */
  shape?: string;
  /** Graded only when present (e.g. a wiring contract is optional, but must be well-formed). */
  optional?: boolean;
}

export function tagRequiredFields<T extends Checker>(checker: T, req: RequiredFields): T {
  Object.defineProperty(checker, REQUIRED_FIELDS, { value: req, enumerable: false });
  return checker;
}

/** Every requirement a checker grades, through `allOf` compositions, merged per field. */
export function requiredFieldsOf(checker: Checker): RequiredFields[] {
  const byField = new Map<string, RequiredFields>();
  const visit = (c: Checker) => {
    const own = (c as unknown as Record<symbol, RequiredFields | undefined>)[REQUIRED_FIELDS];
    if (own) {
      const cur = byField.get(own.field) ?? { field: own.field };
      if (own.keys) cur.keys = [...new Set([...(cur.keys ?? []), ...own.keys])];
      if (own.minChars != null) cur.minChars = Math.max(cur.minChars ?? 0, own.minChars);
      if (own.shape && !cur.shape) cur.shape = own.shape;
      cur.optional = (cur.optional ?? true) && !!own.optional;
      byField.set(own.field, cur);
    }
    for (const m of allOfMembers(c) ?? []) visit(m);
  };
  visit(checker);
  return [...byField.values()];
}

/** One prompt line per requirement — the exact field names and what the checker needs of them. */
export function requiredFieldLine(r: RequiredFields): string {
  const name = `\`${r.field}\``;
  const parts: string[] = [];
  if (r.keys?.length) parts.push(`an object with keys ${r.keys.map((k) => `\`${k}\``).join(', ')}`);
  if (r.minChars != null) parts.push(`text of at least ${r.minChars} characters`);
  if (r.shape) parts.push(r.shape);
  return `- ${name}${r.optional ? ' (only if you declare it)' : ''}: ${parts.join('; ')}`;
}
