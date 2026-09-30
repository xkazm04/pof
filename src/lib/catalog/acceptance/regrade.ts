/**
 * The ONE re-grade door — how the disk-truth sweeps (verify-static, verify-packaging, bind-icons,
 * drain-python) persist, report and scope.
 *
 * `commitArtifact` (`@/lib/catalog/artifactCommit`) is the door for NEW content; the sweeps
 * re-grade what is already stored (bind-icons and drain-python also rewrite `data` with the bound
 * image / the module's return). They used to carry four copies of the same writer, four filter
 * parsers and two meanings of a row's `changed`, and none of them re-derived the lifecycle cache
 * `commitArtifact` keeps fresh. Here, once:
 *
 * - {@link persistRegrade} — the writer: stored `data`/`ueAssets` kept unless new `data` is
 *   given, `reason` falls back to `detail`.
 * - {@link ArtifactIO} — where it writes: {@link realArtifactIO} (the artifacts db + the ONE
 *   lifecycle writer, `syncEntityLifecycle` via `artifactCommitDeps`) or {@link stagedIO} (the
 *   settle preview's in-memory stage, which has NO lifecycle sync — a preview writes nothing).
 * - {@link createTouched} — the entities an apply run wrote, each synced ONCE after the run.
 * - {@link sweepRow} — the one row shape: `changed` = the verdict moves (`from !== to`), in a
 *   dry run too; the summaries' `changed` COUNTS stay "writes made".
 * - {@link parseSweepFilter} — the one `{ catalogId?, entityId? }` parser for every sweep route.
 * - {@link sweepIODeps} — the store half both L2 sweeps' deps share, over one io.
 *
 * No verdict rule lives here: the sweeps decide the verdict; this only stores and reports it.
 */
import type { AcceptanceResult } from './types';
import type { ArtifactStage } from './settlePlan';
import { listAllArtifacts, getArtifact, upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { artifactCommitDeps, gradeArtifact } from '../headless';
import { logger } from '@/lib/logger';

export interface SweepFilter {
  catalogId?: string;
  entityId?: string;
}

export interface RegradeKey {
  catalogId: string;
  entityId: string;
  step: string;
}

/** What a sweep hands the writer — any AcceptanceResult fits. */
export type RegradeVerdict = Pick<AcceptanceResult, 'status' | 'tier'> & { detail?: string; reason?: string };

export interface RegradeWrite extends RegradeKey {
  data: Record<string, unknown>;
  ueAssets: string[];
  status: AcceptanceResult['status'];
  tier: AcceptanceResult['tier'];
  reason?: string;
}

/** What a sweep row is built from — the stored key and status. */
export interface SweepArtifact extends RegradeKey {
  status: string;
}

/** A stored row as the io lists it (content included — packaging reads its siblings' data). */
export interface StoredArtifact extends SweepArtifact {
  data: Record<string, unknown>;
  ueAssets: string[];
}

/** The artifact store a sweep reads and writes through — real, or the settle preview's stage. */
export interface ArtifactIO {
  list: (filter: SweepFilter) => StoredArtifact[];
  get: (catalogId: string, entityId: string, step: string) => { data: Record<string, unknown>; ueAssets: string[] } | null;
  upsert: (row: RegradeWrite) => void;
  /** Re-derive one entity's lifecycle cache. Absent on a stage: a preview writes nothing. */
  syncLifecycle?: (catalogId: string, entityId: string) => void;
}

/** The artifacts db, and the one lifecycle writer (`syncEntityLifecycle`, registered catalogs only). */
export const realArtifactIO: ArtifactIO = {
  list: (filter) => listAllArtifacts(filter),
  get: (c, e, s) => {
    const a = getArtifact(c, e, s);
    return a ? { data: a.data ?? {}, ueAssets: a.ueAssets ?? [] } : null;
  },
  upsert: (row) => { upsertArtifact(row); },
  syncLifecycle: (c, e) => artifactCommitDeps.syncLifecycle(c, e),
};

/**
 * The settle preview's io: reads lay the staged writes over `base`, writes land in the stage.
 * A staged row's `data` is what a later pass must see (bind-icons' bound image before the
 * packaging content fold). No `syncLifecycle` — the preview must write nothing.
 */
export function stagedIO(stage: ArtifactStage, base: ArtifactIO = realArtifactIO): ArtifactIO {
  return {
    list: (filter) => stage.overlay(base.list(filter)),
    get: (c, e, s) => {
      const stored = base.get(c, e, s);
      const staged = stage.get(c, e, s)?.data;
      return staged ? { data: staged, ueAssets: stored?.ueAssets ?? [] } : stored;
    },
    upsert: ({ catalogId, entityId, step, data, status, tier, reason }) =>
      stage.save(catalogId, entityId, step, { status, tier, data, ...(reason ? { reason } : {}) }),
  };
}

/**
 * THE re-grade writer. Keeps the stored `data` and `ueAssets` unless `data` is given (a bind or
 * a drain rewrites the content it graded); the stored reason is the verdict's reason, else its detail.
 */
export function persistRegrade(io: ArtifactIO, key: RegradeKey, verdict: RegradeVerdict, data?: Record<string, unknown>): void {
  const existing = io.get(key.catalogId, key.entityId, key.step);
  io.upsert({
    ...key,
    data: data ?? existing?.data ?? {},
    ueAssets: existing?.ueAssets ?? [],
    status: verdict.status,
    tier: verdict.tier,
    ...(verdict.reason ? { reason: verdict.reason } : verdict.detail ? { reason: verdict.detail } : {}),
  });
}

/** The step's own content checker re-run RAW (no judge overlay) on the data `io` holds, or null
 *  when no row / no checker — the content half BOTH L2 sweeps fold in (`foldContentHold`). A
 *  staged io answers with the staged data (bind-icons' bound image), else the stored row. */
export function contentVerdictVia(io: ArtifactIO) {
  return (catalogId: string, entityId: string, step: string): AcceptanceResult | null => {
    const art = io.get(catalogId, entityId, step);
    if (!art) return null;
    const g = gradeArtifact(catalogId, step, art.data, entityId);
    return g.graded ? g.raw : null;
  };
}

/** The store half of the L2 sweeps' deps (`StaticVerifyDeps` / `PackagingVerifyDeps`). */
export interface SweepIODeps {
  listArtifacts: (filter: SweepFilter) => StoredArtifact[];
  upsertStatus: (catalogId: string, entityId: string, step: string, res: AcceptanceResult) => void;
  getContentVerdict: (catalogId: string, entityId: string, step: string) => AcceptanceResult | null;
  syncLifecycle?: (catalogId: string, entityId: string) => void;
}

/** List, the one writer, the content fold and the lifecycle sync — all over ONE io. */
export function sweepIODeps(io: ArtifactIO): SweepIODeps {
  return {
    listArtifacts: (filter) => io.list(filter),
    upsertStatus: (catalogId, entityId, step, res) => persistRegrade(io, { catalogId, entityId, step }, res),
    getContentVerdict: contentVerdictVia(io),
    ...(io.syncLifecycle ? { syncLifecycle: io.syncLifecycle } : {}),
  };
}

/** The entities an apply run wrote; `flush` re-derives each one's lifecycle ONCE, best-effort
 *  (the artifact write is the job — the re-derivable cache never fails it, as in commitArtifact). */
export function createTouched(): { add: (catalogId: string, entityId: string) => void; flush: (sync?: (catalogId: string, entityId: string) => void) => void } {
  const touched = new Map<string, [string, string]>();
  return {
    add: (c, e) => { touched.set(`${c}\u0000${e}`, [c, e]); },
    flush: (sync) => {
      if (sync) {
        for (const [c, e] of touched.values()) {
          try { sync(c, e); } catch (err) { logger.warn('regrade: could not sync derived lifecycle', err); }
        }
      }
      touched.clear();
    },
  };
}

/** The one sweep row: `changed` means the verdict moves — in a dry run as in an apply. */
export function sweepRow(prev: SweepArtifact, verdict: RegradeVerdict) {
  return {
    catalogId: prev.catalogId, entityId: prev.entityId, step: prev.step,
    from: prev.status, to: verdict.status as string,
    ...(verdict.detail ? { detail: verdict.detail } : {}),
    ...(verdict.reason ? { reason: verdict.reason } : {}),
    changed: verdict.status !== prev.status,
  };
}

/** `{ catalogId?, entityId? }` from a query string or a JSON body — only non-empty strings kept. */
export function parseSweepFilter(input: URLSearchParams | Record<string, unknown> | null | undefined): SweepFilter {
  const read = (k: keyof SweepFilter): unknown => (input instanceof URLSearchParams ? input.get(k) : input?.[k]);
  const catalogId = read('catalogId');
  const entityId = read('entityId');
  return {
    ...(typeof catalogId === 'string' && catalogId ? { catalogId } : {}),
    ...(typeof entityId === 'string' && entityId ? { entityId } : {}),
  };
}
