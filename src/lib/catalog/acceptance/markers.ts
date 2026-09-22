/**
 * Fixed, greppable prefixes for verdicts that are NOT verified passes (registry:
 * acceptance-verdict-spine · ungraded-marker-doctrine). Each starts a result's `reason`, uppercase,
 * so a plain text search over `pipeline_artifacts` counts every such row.
 *
 * A leaf module on purpose: it is imported by the checkers themselves, so it may import nothing.
 */

/** No checker could grade this row — or, under a canon profile, no LAW exists to grade it against. */
export const UNGRADED_MARKER = 'UNGRADED';

/** The row was SEEDED from a reference source, not produced; never graded `pass` (/diablo D3). */
export const SOURCED_MARKER = 'SOURCED';

/**
 * The exact value a producer writes where a replicated game's reference does not state a field
 * (the REFERENCE VALUES prompt section asks for it). A checker must read it as UNPOPULATED — measured
 * /diablo W02c: `moveSpeed: { value: "Not in the reference" }` satisfied a `!= null` check, so a
 * declared gap graded as a populated field.
 */
export const REFERENCE_GAP = 'not in the reference';

/** A declared gap: the marker itself, or an object whose `value` is the marker. */
export function isDeclaredGap(v: unknown): boolean {
  if (typeof v === 'string') return v.trim().toLowerCase() === REFERENCE_GAP;
  if (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v) return isDeclaredGap((v as { value: unknown }).value);
  return false;
}
