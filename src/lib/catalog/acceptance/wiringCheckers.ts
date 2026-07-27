import type { AcceptanceResult, Checker } from './types';

/**
 * The WIRING CONTRACT invariant (L2).
 *
 * `docs/catalog/WIRING-AND-ACCEPTANCE.md` states the rule plainly: *an artifact that
 * compiles but isn't granted/activated is NOT config-complete — a step's L2 must check it
 * is registered + triggered (the "no gray-box" rule), and the step's Verification line
 * becomes its acceptance detail/reason.* The fleet went on to author 137 `wiringContract`
 * blocks across 30 pipelines — and, until this checker, **nothing read them**: no view, no
 * acceptance. A step could declare `grantedBy: 'TBD'` and still grade `pass`.
 *
 * This is the shared invariant those blocks are graded by. It is composed onto a step's
 * existing checks with `allOf(...)` (exactly like `linksResolve()`), so the step's own
 * headline verdict is unchanged while a hollow contract is now caught.
 *
 * ── What it asserts (shape AND content) ───────────────────────────────────────
 *  - `grantedBy`    — a real registration site (who OWNS/registers the thing), ≥ MIN_PROSE
 *                     characters, never a placeholder (`TBD` / `TODO` / `n/a` / `none`).
 *  - `activatedBy`  — a real trigger path (what makes it FIRE), same bar.
 *  - `verification` — how the claim is proven, and it must NAME A LADDER TIER (`L0`…`L4`):
 *                     an unfalsifiable "it works" line is not a verification contract.
 *  - `dependencies` — an array of non-blank strings (an EMPTY array is legal — a step may
 *                     genuinely depend on nothing; a malformed one is not).
 *
 * ── What it deliberately does NOT do ──────────────────────────────────────────
 * It never asserts that a contract EXISTS ("where present" — a step that declares none is
 * out of scope and passes, mirroring `linksResolve`'s empty-link-set pass), and it never
 * touches the tier/status a step's own checker derived. It is a pure content invariant:
 * same `data` in → same verdict out, no context needed.
 */

/** Keys every wiring contract must carry. */
export const WIRING_KEYS = ['grantedBy', 'activatedBy', 'verification', 'dependencies'] as const;

/** Minimum prose length for a wiring claim to be a claim at all (the shortest real
 *  `activatedBy` in the fleet is 30 chars; 12 leaves room without admitting a stub). */
export const MIN_PROSE = 12;

const PLACEHOLDER = /^(tbd|todo|to do|n\/?a|none|nothing|\?+|-+)\b/i;

const res = (status: AcceptanceResult['status'], label: string, detail: string, reason?: string): AcceptanceResult =>
  ({ label, tier: 'L2', status, detail, ...(reason ? { reason } : {}) });

/** Grade one already-resolved wiring contract object. Exported for direct unit testing. */
export function checkWiringContract(wc: unknown, label: string, where: string): AcceptanceResult {
  if (wc == null || typeof wc !== 'object' || Array.isArray(wc)) {
    return res('fail', label, 'malformed contract',
      `${where} is not an object — a wiring contract must declare { grantedBy, activatedBy, verification, dependencies }`);
  }
  const c = wc as Record<string, unknown>;

  for (const key of ['grantedBy', 'activatedBy', 'verification'] as const) {
    const v = c[key];
    if (typeof v !== 'string' || !v.trim()) {
      return res('fail', label, `${key} missing`,
        `${where}.${key} is missing — the "no gray-box" rule: an artifact that is not registered + triggered is not config-complete`);
    }
    if (v.trim().length < MIN_PROSE || PLACEHOLDER.test(v.trim())) {
      return res('fail', label, `${key} is a stub`,
        `${where}.${key} = "${v.trim().slice(0, 60)}" is a placeholder, not a wiring claim — name the real registration/trigger site`);
    }
  }

  const verification = String(c.verification);
  if (!/\bL[0-4]\b/.test(verification)) {
    return res('fail', label, 'verification names no tier',
      `${where}.verification does not name an acceptance tier (L0–L4) — an unfalsifiable "it works" line is not a verification contract`);
  }

  const deps = c.dependencies;
  if (!Array.isArray(deps) || deps.some((d) => typeof d !== 'string' || !d.trim())) {
    return res('fail', label, 'dependencies malformed',
      `${where}.dependencies must be an array of non-blank strings (an empty array is legal), got ${JSON.stringify(deps)?.slice(0, 60)}`);
  }

  return res('pass', label, `granted · activated · verified (${deps.length} dep${deps.length === 1 ? '' : 's'})`);
}

/**
 * A `Checker` that grades the step's wiring contract.
 *
 * `field` is the dot-path of the object the contract lives under (`'triggerProgress'` →
 * `data.triggerProgress.wiringContract`; `'layers.bed'` → `data.layers.bed.wiringContract`);
 * omit it for a contract at the artifact root (`data.wiringContract`). Only the FIRST
 * segment is read off `data`, so the field-coherence rules of the fleet spec linter still
 * measure what the step really grades.
 *
 * No contract present (unproduced step, or a step that declares none) → `pass`, so this can
 * never turn a clean Produce into a failure or mask the base checker's own pending message.
 */
export function wiringContractSound(field?: string, label = 'Wiring contract (granted · activated · verified)'): Checker {
  return (data) => {
    const container = field
      ? field.split('.').reduce<unknown>(
          (acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined),
          data,
        )
      : data;
    if (container == null || typeof container !== 'object') {
      return res('pass', label, 'no wiring contract declared');
    }
    const wc = (container as Record<string, unknown>).wiringContract;
    if (wc === undefined) return res('pass', label, 'no wiring contract declared');
    return checkWiringContract(wc, label, field ? `${field}.wiringContract` : 'wiringContract');
  };
}
