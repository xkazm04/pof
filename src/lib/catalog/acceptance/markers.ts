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

/** The row is a data-blind stub body written for a non-exemplar entity — the exemplar's template. */
export const TEMPLATE_MARKER = 'TEMPLATE';

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
/**
 * THE strict numeric read for a graded value: a finite number, or a non-blank string that parses to
 * one. Everything else — '', whitespace, a list, a boolean, an object, a declared gap — is null
 * (unpopulated). `Number(x)` alone turns '' / [] / false into 0 and true / [1] into 1, which let a
 * blank measurement pass a budget cap (registry law: unmeasured-is-not-a-pass).
 */
export function readNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || !v.trim() || isDeclaredGap(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function isDeclaredGap(v: unknown): boolean {
  if (typeof v === 'string') return v.trim().toLowerCase() === REFERENCE_GAP;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  if ('value' in v) return isDeclaredGap((v as { value: unknown }).value);
  const own = Object.values(v as Record<string, unknown>);
  return own.some((x) => typeof x === 'string' && isDeclaredGap(x)) && !own.some((x) => typeof x === 'number');
}
