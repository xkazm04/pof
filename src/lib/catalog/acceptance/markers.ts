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

/**
 * A declared gap: the marker itself, an object whose `value` is the marker, or an object one of whose
 * own properties is the marker while none carries a number — measured /diablo W07: the W02 zombie's
 * `tree: { sourceStatus: marker, implementationConstraint: <prose> }` graded as populated while the
 * same gap as a bare string graded pending. A number beside a gap note (`{ radius: 800, hearing:
 * marker }`) is a real value, so that object stays populated.
 */
export function isDeclaredGap(v: unknown): boolean {
  if (typeof v === 'string') return v.trim().toLowerCase() === REFERENCE_GAP;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  if ('value' in v) return isDeclaredGap((v as { value: unknown }).value);
  const own = Object.values(v as Record<string, unknown>);
  return own.some((x) => typeof x === 'string' && isDeclaredGap(x)) && !own.some((x) => typeof x === 'number');
}
