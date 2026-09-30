import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { logger } from '@/lib/logger';
import type { LabStepArtifact } from './labPipelineStore';

/**
 * What the lab's per-step store (`pof-lab-pipeline`) writes to localStorage — and what it
 * does when localStorage refuses.
 *
 * The store is two things at once: an in-memory working set that mirrors server rows (add-only
 * hydration, drift, refresh need it), and the ONLY durable home of local work that never reached
 * the server. Only the second needs durable storage — a server row is re-fetched and re-hydrated
 * the moment its entity is opened. Persisting the whole mirror put every row the operator ever
 * opened into a ~5 MiB origin quota (5.5M chars on the real DB); once full, persist's synchronous
 * `setItem` threw out of every `set()`, so a produce never reached its write-through again.
 *
 * ── Admission: the OUTBOX ─────────────────────────────────────────────────────
 * Every step is persisted EXCEPT one PROVEN, by a server observation in this session, to be an
 * exact copy of the server row just observed: `done`, `ueAssets` and `data` — INCLUDING the
 * local-only `genHistory` — canonically equal, with no `error` and no `syncError`. The proof is
 * deliberately NOT `isServerDerived` (serverSeen + no newer produce): that predicate is true for
 * an adopt that grafted local `genHistory` onto the server row, for a never-synced produce whose
 * `syncError` a newer server row cleared, and for content that drifted from the server — all
 * three hold work that exists nowhere else.
 *
 * The proof lives OFF the artifact, in a WeakMap keyed by the artifact OBJECT: the store only
 * ever replaces artifacts (never mutates them), so ANY later write — content or not — produces a
 * new, unproven object that is persisted until a server observation proves it again. Nothing is
 * added to the in-memory or persisted shape, and a rehydrated blob is unproven by construction:
 * a legacy full-mirror step leaves storage only once a hydrate proves it equal to its server row.
 *
 * `_provenance` is the one key excluded from the comparison: the server stamps it on EVERY write
 * (`POST /api/pipeline-artifacts` → `stampPromptVersion`) and refuses any client claim in it, so
 * the server's value is authoritative and a local copy of it is not work.
 */

type ByEntity = Record<string, Record<string, LabStepArtifact>>;

/** Server-stamped bookkeeping inside `data` (see the file header). */
const SERVER_STAMPED_KEY = '_provenance';

/** artifact object → the `(entity, step)` slot whose server row it was proven equal to. */
const proofs = new WeakMap<LabStepArtifact, string>();
const slot = (entityId: string, step: string) => `${entityId}\u0000${step}`;

/** JSON with object keys sorted at every depth (JSON objects are unordered; arrays are not). */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

function contentOf(a: LabStepArtifact): string {
  const data = { ...(a.data ?? {}) };
  delete data[SERVER_STAMPED_KEY];
  return canonical({ done: a.done, ueAssets: a.ueAssets ?? [], data });
}

/**
 * Record that `art` (now at `(entityId, step)`) was compared against the server `row` just
 * observed for that slot: proven iff it holds no local claim and is an exact copy; otherwise any
 * earlier proof is revoked (the server moved on, or the local side did).
 */
export function observeServerRow(entityId: string, step: string, art: LabStepArtifact, row: LabStepArtifact): void {
  if (art.error === undefined && art.syncError === undefined && contentOf(art) === contentOf(row)) {
    proofs.set(art, slot(entityId, step));
  } else proofs.delete(art);
}

/** Is this artifact provably re-fetchable, i.e. safe to leave out of durable storage? */
export function isProvenServerCopy(entityId: string, step: string, art: LabStepArtifact): boolean {
  return proofs.get(art) === slot(entityId, step) && art.error === undefined && art.syncError === undefined;
}

/** The persisted slice: every step that is not a proven server copy; entities left empty are omitted. */
export function outboxOf(byEntity: ByEntity): ByEntity {
  const out: ByEntity = {};
  for (const [entityId, steps] of Object.entries(byEntity)) {
    let kept: Record<string, LabStepArtifact> | undefined;
    for (const [step, art] of Object.entries(steps ?? {})) {
      if (isProvenServerCopy(entityId, step, art)) continue;
      (kept ??= {})[step] = art;
    }
    if (kept) out[entityId] = kept;
  }
  return out;
}

/** A storage failure as a sentence the operator can act on (the quota is named when it is the cause). */
export function persistFailureReason(e: unknown): string {
  const name = (e as { name?: unknown } | null)?.name;
  const msg = e instanceof Error ? e.message : String(e);
  const label = typeof name === 'string' && name ? name : 'Error';
  const quota = label === 'QuotaExceededError' || label === 'NS_ERROR_DOM_QUOTA_REACHED' || /quota/i.test(msg);
  return quota
    ? `Browser storage quota exceeded (${label}): lab work that has not reached the server is no longer ` +
      'being saved in this browser. Server saves are unaffected; free browser storage to resume.'
    : `Saving lab work to browser storage failed (${label}: ${msg}). Server saves are unaffected.`;
}

/**
 * A localStorage adapter whose writes never throw: a refused write is REPORTED (`reason`), a
 * successful one reports `null`. Resolves the global per call, exactly like the adapter it
 * replaces, and throws at construction when there is no localStorage (SSR) so persist disables
 * itself as before.
 */
export function quotaSafeLocalStorage(report: (reason: string | null) => void): StateStorage {
  if (typeof localStorage === 'undefined') throw new Error('localStorage is unavailable');
  return {
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => {
      try { localStorage.setItem(name, value); } catch (e) { report(persistFailureReason(e)); return; }
      report(null);
    },
    removeItem: (name) => {
      try { localStorage.removeItem(name); } catch (e) { report(persistFailureReason(e)); }
    },
  };
}

export interface PersistErrorApi {
  getState: () => { persistError: string | null };
  setState: (partial: { persistError: string | null }) => void;
}

/**
 * The store's persist options: the outbox `partialize` + the quota-safe adapter, reporting into
 * the store's non-persisted `persistError`. `api` is a thunk because the store does not exist yet
 * when its options are built. Recording the error is itself a `set()` (another write attempt), so
 * it only writes on a CHANGE — a still-full quota re-reports the same sentence and stops there.
 */
export function labPersistOptions<S extends { byEntity: ByEntity; persistError: string | null }>(api: () => PersistErrorApi) {
  const report = (reason: string | null) => {
    const store = api();
    if (store.getState().persistError === reason) return;
    if (reason) logger.warn(`[lab-pipeline] ${reason}`);
    store.setState({ persistError: reason });
  };
  return {
    name: 'pof-lab-pipeline',
    storage: createJSONStorage<{ byEntity: ByEntity }>(() => quotaSafeLocalStorage(report)),
    partialize: (s: S) => ({ byEntity: outboxOf(s.byEntity) }),
  };
}
