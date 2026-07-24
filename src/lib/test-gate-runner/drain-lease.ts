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

/** The global lease key — a global drain (or the always-on worker) touches EVERY entity. */
const GLOBAL_KEY = '*|*';

/** Human scope from a `catalog|entity` key (`*|*` → 'global'). */
export function scopeFromKey(k: string): string {
  const [c, e] = k.split('|');
  return c === '*' && e === '*' ? 'global' : `${c}/${e}`;
}

/**
 * Lease keys for a drain filter — the SINGLE source both the POST route AND the always-on
 * worker use to key their lease, so they contend on the same registry (a batch → one key per
 * entity; else the single scoped, or global, key). Kept here (not in the route) so the worker
 * can reuse it without importing the app route.
 */
export function leaseKeysForFilter(f: { catalogId?: string; entityId?: string; entityIds?: string[] }): string[] {
  if (f.entityIds?.length) return f.entityIds.map((id) => `${f.catalogId ?? '*'}|${id}`);
  return [`${f.catalogId ?? '*'}|${f.entityId ?? '*'}`];
}

/**
 * A held key that conflicts with acquiring `k`, or null. Conflict is CONTAINMENT, not just
 * exact-key equality: a catalog-wide lease (`c|*`) covers every member-entity lease (`c|<e>`)
 * in that catalog and vice-versa, because the wide drain sweeps the member entity's rows and
 * boots the SAME non-reentrant editor — so `c|*` and `c|e1` must be mutually exclusive even
 * though the keys differ (the global `*|*` case is handled by the caller). Scoped-vs-scoped
 * across DIFFERENT entities stays concurrent (they touch disjoint rows).
 */
function conflictingHeldKey(k: string): string | null {
  if (held.has(k)) return k;
  const [c, e] = k.split('|');
  if (c === '*') return null; // wildcard-catalog keys: only exact + global (caller) apply
  if (e === '*') {
    // Catalog-wide: conflicts with ANY held lease in the same catalog (wide covers member).
    for (const h of held.keys()) if (h.split('|')[0] === c) return h;
    return null;
  }
  // Entity-scoped: conflicts with a held catalog-wide lease for the same catalog (member ⊂ wide).
  return held.has(`${c}|*`) ? `${c}|*` : null;
}

/**
 * Acquire ALL keys atomically: if ANY is already held (by exact key OR scope containment),
 * acquire none and report the conflict (mirrors the route's all-or-nothing batch lease). On
 * success every key is recorded with a shared acquisition timestamp.
 *
 * The GLOBAL lease (`*|*`) is exclusive with EVERYTHING: a global drain (or the always-on
 * worker, which drains globally) sweeps every entity, so it must not run alongside ANY scoped
 * drain and vice versa. A held global blocks every acquire; acquiring global requires an empty
 * registry. A catalog-wide lease (`c|*`) is likewise exclusive with every member-entity lease
 * (`c|<e>`) — see `conflictingHeldKey`.
 */
export function acquireLeases(keys: string[]): { ok: true } | { ok: false; conflict: string } {
  // A held global lease excludes everything.
  if (held.has(GLOBAL_KEY)) return { ok: false, conflict: GLOBAL_KEY };
  // Acquiring the global lease requires that nothing scoped is in flight.
  if (keys.includes(GLOBAL_KEY) && held.size > 0) {
    return { ok: false, conflict: [...held.keys()][0] };
  }
  for (const k of keys) {
    const conflict = conflictingHeldKey(k);
    if (conflict) return { ok: false, conflict };
  }
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
