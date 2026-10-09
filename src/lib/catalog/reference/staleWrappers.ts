/**
 * Stale wrappers — rows the store still holds that a full read of their source no longer produces.
 *
 * `upsertWrappers` never deletes, so a record whose KEY changes (a reader version that mints a new
 * identity) is reported `created` and its old row stays behind, still holding the old entity id. A
 * stale row is invisible to the per-spec duplicate counter but not to anything that keys by entity id,
 * so it must be retired — and only behind guards the caller states BEFORE looking: the source, the
 * record kinds that may go, and how many rows. Additive beside `wrappers-db.ts`: nothing here changes
 * how a wrapper is written, and nothing deletes outside the one source it is given.
 */
import type Database from 'better-sqlite3';
import { createReferenceDb } from './wrappers-db';
import { expandGlob, isGlobPattern } from './pathCoverage';
import type { ReferenceSource } from './sources';
import { wrapTable } from './wrapper';

export interface ProducedWrappers {
  ids: Set<string>;
  /** Files a spec reads whose reader refused them — they produce no wrapper, exactly as in an ingest. */
  refused: string[];
}

/**
 * The wrapper ids a full ingest of every spec of `source` would produce from `files`, without writing.
 * Ids come from `wrapTable`, the function an ingest uses, so they cannot drift from the store's. A file
 * that cannot be read THROWS: an unreadable file would otherwise make every one of its rows look stale.
 */
export function producedWrapperIds(source: ReferenceSource, files: readonly string[], read: (file: string) => string): ProducedWrappers {
  const ids = new Set<string>();
  const refused: string[] = [];
  for (const spec of source.tables) {
    const matched = isGlobPattern(spec.file) ? expandGlob([...files], spec.file) : [spec.file];
    for (const file of matched) {
      const result = wrapTable(source, { ...spec, file }, read(file));
      if (result.refusal) refused.push(file);
      for (const w of result.wrappers) ids.add(w.wrapperId);
    }
  }
  return { ids, refused };
}

export interface StaleWrapper {
  wrapperId: string;
  file: string;
  /** The raw record's `kind` (`''` for a table row that has none). */
  kind: string;
  entityId: string;
  catalogId: string;
}

/** Rows of `sourceId` whose wrapper id is not in `produced`, ordered by wrapper id. Read-only. */
export function findStaleWrappers(db: Database.Database, sourceId: string, produced: ReadonlySet<string>): StaleWrapper[] {
  createReferenceDb(db);
  const rows = db.prepare('SELECT wrapper_id, file, raw, entity_id, catalog_id FROM reference_wrappers WHERE source_id = ? ORDER BY wrapper_id')
    .all(sourceId) as { wrapper_id: string; file: string; raw: string; entity_id: string; catalog_id: string }[];
  return rows.filter((r) => !produced.has(r.wrapper_id)).map((r) => ({
    wrapperId: r.wrapper_id, file: r.file, entityId: r.entity_id, catalogId: r.catalog_id,
    kind: String((JSON.parse(r.raw) as { kind?: unknown }).kind ?? ''),
  }));
}

export interface RetireGuard {
  /** The stale count written down before looking; any other count refuses. */
  expected: number;
  /** The only raw kinds that may be retired; a stale row of any other kind refuses. */
  kinds: readonly string[];
}

export type RetireResult =
  | { ok: true; retired: StaleWrapper[] }
  | { ok: false; reason: string; stale: StaleWrapper[] };

/**
 * Delete exactly the stale rows of `sourceId`, in one transaction, or refuse with the reason. Refuses
 * an empty `produced` set (a read that produced nothing cannot judge staleness), any stale row whose
 * kind the guard does not allow, and a stale count other than the expected one.
 */
export function retireStaleWrappers(db: Database.Database, sourceId: string, produced: ReadonlySet<string>, guard: RetireGuard): RetireResult {
  const stale = findStaleWrappers(db, sourceId, produced);
  if (produced.size === 0) return { ok: false, reason: 'the read produced no wrapper — it cannot judge which rows are stale', stale };
  const foreign = stale.filter((s) => !guard.kinds.includes(s.kind));
  if (foreign.length) {
    return { ok: false, reason: `${foreign.length} stale row(s) of a kind the guard does not allow (${[...new Set(foreign.map((s) => s.kind))].join(', ')}; allowed: ${guard.kinds.join(', ')})`, stale };
  }
  if (stale.length !== guard.expected) return { ok: false, reason: `stale count ${stale.length} is not the expected ${guard.expected}`, stale };
  const remove = db.prepare('DELETE FROM reference_wrappers WHERE source_id = ? AND wrapper_id = ?');
  db.transaction(() => {
    let deleted = 0;
    for (const s of stale) deleted += remove.run(sourceId, s.wrapperId).changes;
    if (deleted !== stale.length) throw new Error(`deleted ${deleted} rows, expected ${stale.length} — rolled back`);
  })();
  return { ok: true, retired: stale };
}
