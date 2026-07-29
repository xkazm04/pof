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
 * Bookkeeping keys that are NOT the judged content.
 *
 * `genHistory` is the gallery's kept re-roll log (`shared/genHistory.ts`). The SELECTED
 * candidate's payload is projected to the artifact's top level — that projection is what the
 * checker grades and what the judge reads — while the log itself grows on every re-roll. Hashing
 * it would mark every verdict stale after a browse that changed nothing, silently clearing real
 * condemnations. So the log is excluded and the selection (already top-level) is what binds.
 */
const VOLATILE_KEYS = new Set(['genHistory']);

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
 * Format `v1-<len36>-<fnv36>`: the canonical serialization's LENGTH is part of the key, so the
 * (small) 32-bit collision space only matters between payloads of exactly the same size. This
 * detects "the content changed", it is not a security digest — a false "unchanged" would at
 * worst keep an existing verdict applied one re-produce too long, never fabricate one.
 * The `v1-` prefix lets the scheme change later without silently comparing across schemes.
 */
export function stepContentHash(data: Record<string, unknown> | undefined | null): string {
  return `v1-${(canonical(data ?? {})).length.toString(36)}-${fnv1a(canonical(data ?? {}))}`;
}
