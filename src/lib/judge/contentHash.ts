/**
 * Content binding for judge verdicts (pure, isomorphic).
 *
 * A `judge_verdicts` row used to record no reference to the artifact content it judged, so
 * `bridgeJudgeVerdict` could only filter on rubric version: fix a step, re-produce it, and the
 * stale verdict kept condemning content that no longer exists — with no way to tell a current
 * condemnation from an obsolete one. This hashes the judged content so a verdict can be BOUND
 * to it.
 *
 * Must run identically on the server (the API route stamps the hash) and in the browser (the
 * lab compares it against what is on screen), so it is plain TS — no `node:crypto`.
 */

/**
 * Bookkeeping keys that are NOT the judged content. THE single exclusion rule — the write path
 * (`POST /api/judge-verdicts`), the verdict bridge (`judgeBridge`) and the lab's drift
 * comparator (`labContentDrift`) all hash through here, so no second stripping rule exists.
 *
 * `genHistory` is the gallery's kept re-roll log (`shared/genHistory.ts`). The SELECTED
 * candidate's payload is projected to the artifact's top level — that projection is what the
 * checker grades and what the judge reads — while the log itself grows on every re-roll. Hashing
 * it would mark every verdict stale after a browse that changed nothing, silently clearing real
 * condemnations. So the log is excluded and the selection (already top-level) is what binds.
 *
 * `_provenance` is stamped SERVER-SIDE by `POST /api/pipeline-artifacts` (`stampPromptVersion`,
 * which always writes the key). It made the two sides of this hash structurally unable to agree:
 * the verdict's hash is derived from the PERSISTED row (always stamped), while the lab hashes the
 * LOCAL artifact the browser produced (never stamped) — so every locally-produced step's current
 * verdict classified `stale` and quietly stopped condemning. The asymmetry also had the opposite
 * polarity for the headless path: `submitStepArtifact` (the MCP `pof_submit_artifact` seam) and
 * the L3/L4 gate re-persists (`staticVerify` / `packagingVerify`) write `data` WITHOUT the stamp,
 * so those rows agreed by accident. Excluding the stamp makes both paths hash the same produced
 * content, which is the only thing a judge ever read.
 */
const VOLATILE_KEYS = new Set(['genHistory', '_provenance']);

/**
 * The hashing scheme in force. Bump it with ANY change to {@link VOLATILE_KEYS} or the
 * serialization: an existing stamped hash was computed under a DIFFERENT rule and is not
 * comparable, and silently comparing across schemes would report every standing verdict as
 * judging content it never judged.
 *
 * v1 — `genHistory` excluded only. Its hashes are unbindable under v2 (they include the
 *      server's `_provenance` stamp or not, depending on which write path produced the row).
 * v2 — `_provenance` excluded too (see above).
 */
export const CONTENT_HASH_SCHEME = 'v2';

/** The scheme prefix a stored hash was computed under (`undefined` for an unparseable value). */
export function hashScheme(hash: string | undefined): string | undefined {
  if (!hash) return undefined;
  const i = hash.indexOf('-');
  return i > 0 ? hash.slice(0, i) : undefined;
}

/**
 * Can this stored hash be compared against one computed now? A hash from an older scheme
 * CANNOT — it must degrade to a stated provenance (see `judgeBridge.verdictProvenance`), never
 * to `stale`, which would silently drop every standing condemnation at once.
 */
export function isComparableHash(hash: string | undefined): boolean {
  return hashScheme(hash) === CONTENT_HASH_SCHEME;
}

/** Deterministic JSON: object keys sorted at every depth, arrays in order. */
function canonical(value: unknown, depth = 0): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => canonical(v, depth + 1)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([k]) => !(depth === 0 && VOLATILE_KEYS.has(k)))
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v, depth + 1)}`).join(',')}}`;
}

/** FNV-1a (32-bit), as unsigned base-36. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * A stable fingerprint of a step artifact's produced data.
 *
 * Format `<scheme>-<len36>-<fnv36>`: the canonical serialization's LENGTH is part of the key, so
 * the (small) 32-bit collision space only matters between payloads of exactly the same size. This
 * detects "the content changed", it is not a security digest — a false "unchanged" would at
 * worst keep an existing verdict applied one re-produce too long, never fabricate one.
 * The {@link CONTENT_HASH_SCHEME} prefix lets the rule change without comparing across schemes.
 */
export function stepContentHash(data: Record<string, unknown> | undefined | null): string {
  const c = canonical(data ?? {});
  return `${CONTENT_HASH_SCHEME}-${c.length.toString(36)}-${fnv1a(c)}`;
}
