/**
 * Drain lease registry — the single-lease guard for the non-reentrant UE editor.
 *
 * The `POST /api/pipeline-artifacts/drain` route acquires a per-entity (or global) lease
 * before booting the editor, and refuses an overlapping drain with 409. A held lease used
 * to be invisible until a concurrent drain failed post-hoc; exposing this registry through
 * a GET status route lets the lab surface a "runner busy" chip so concurrent sessions SEE
 * the lease instead of discovering it via a surprise 409.
 *
 * Keys are `catalog|entity` (either side `*` when unscoped) — the same shape the route uses.
 */

export interface DrainLease {
  /** `catalog|entity` key. */
  key: string;
  /** Human scope (`catalog/entity`, or `global`). */
  scope: string;
  /** ISO timestamp the lease was acquired. */
  since: string;
}

const held = new Map<string, DrainLease>();

/** Human scope from a `catalog|entity` key (`*|*` → 'global'). */
export function scopeFromKey(k: string): string {
  const [c, e] = k.split('|');
  return c === '*' && e === '*' ? 'global' : `${c}/${e}`;
}

/**
 * Acquire ALL keys atomically: if ANY is already held, acquire none and report the conflict
 * (mirrors the route's all-or-nothing batch lease). On success every key is recorded with a
 * shared acquisition timestamp.
 */
export function acquireLeases(keys: string[]): { ok: true } | { ok: false; conflict: string } {
  const conflict = keys.find((k) => held.has(k));
  if (conflict) return { ok: false, conflict };
  const since = new Date().toISOString();
  for (const k of keys) held.set(k, { key: k, scope: scopeFromKey(k), since });
  return { ok: true };
}

/** Release the given keys (safe to call for keys never acquired). */
export function releaseLeases(keys: string[]): void {
  for (const k of keys) held.delete(k);
}

export interface LeaseState {
  held: boolean;
  /** Scope of the OLDEST held lease (the representative holder) — null when idle. */
  scope: string | null;
  /** ISO timestamp the oldest lease was acquired — null when idle. */
  since: string | null;
  /** Every held scope (a batch holds one per entity). */
  scopes: string[];
}

/** Current lease state — read by the GET status route so the lab can show runner activity. */
export function getLeaseState(): LeaseState {
  if (held.size === 0) return { held: false, scope: null, since: null, scopes: [] };
  const recs = [...held.values()].sort((a, b) => (a.since < b.since ? -1 : a.since > b.since ? 1 : 0));
  return { held: true, scope: recs[0].scope, since: recs[0].since, scopes: recs.map((r) => r.scope) };
}

/** Test-only: clear all leases between cases. */
export function __resetLeases(): void { held.clear(); }
