/**
 * Artifact purge — removing a step/entity from the pipeline tables *completely*, and
 * reporting the REAL number of rows that went, per table.
 *
 * Why this module exists. A produced step leaves rows in FOUR tables, not one:
 *
 *   pipeline_artifacts            the live row
 *   pipeline_artifact_revisions   every superseded version (bounded to MAX_REVISIONS)
 *   judge_verdicts                the current judgment per judge class
 *   judge_verdict_history         the bounded judgment log
 *
 * `DELETE /api/pipeline-artifacts` used to delete only the first, and to report
 * `targets.length` — the number of rows it *attempted* — as "the number of rows actually
 * removed". So a reset left the judge's condemnation and the whole revision archive behind,
 * and the count it reported could not be wrong in an observable way because it never looked.
 * Everything here returns `changes()` from the statements that actually ran.
 *
 * It is also the machinery behind the fixture purge (see {@link inventorySyntheticFixtures}):
 * the test harness has been writing synthetic entities into the operator's real DB for
 * months, and removing them is a four-table job for exactly the same reason.
 *
 * NOTHING here runs automatically. An operator may be mid-investigation with the fixture
 * rows on screen; the purge is an action they take, never a boot-time sweep.
 */

import { getDb } from '@/lib/db';
import { isSyntheticEntity } from '@/lib/status/statusModel';

/** Rows removed, per table. Every field is a real `changes()`, never an attempt count. */
export interface PurgeCounts {
  artifacts: number;
  revisions: number;
  verdicts: number;
  verdictHistory: number;
}

export const ZERO_PURGE: PurgeCounts = { artifacts: 0, revisions: 0, verdicts: 0, verdictHistory: 0 };

/** Total rows across all four tables — what an operator means by "how much did that delete?" */
export function totalPurged(c: PurgeCounts): number {
  return c.artifacts + c.revisions + c.verdicts + c.verdictHistory;
}

export function addPurge(a: PurgeCounts, b: PurgeCounts): PurgeCounts {
  return {
    artifacts: a.artifacts + b.artifacts,
    revisions: a.revisions + b.revisions,
    verdicts: a.verdicts + b.verdicts,
    verdictHistory: a.verdictHistory + b.verdictHistory,
  };
}

/**
 * The four tables a produced step writes into, each keyed by the same
 * `(catalog_id, entity_id, step)` triple. Listed once so a count and its delete can never
 * disagree about which tables are in scope.
 */
const PURGE_TABLES: ReadonlyArray<{ table: string; field: keyof PurgeCounts }> = [
  { table: 'pipeline_artifacts', field: 'artifacts' },
  { table: 'pipeline_artifact_revisions', field: 'revisions' },
  { table: 'judge_verdicts', field: 'verdicts' },
  { table: 'judge_verdict_history', field: 'verdictHistory' },
];

/**
 * Does the table exist yet? A fresh DB may not have created every one of them (each is
 * created lazily by its own module's `ensureTable`), and a purge must report `0` for a table
 * that holds nothing rather than throw — the alternative is duplicating four DDL blocks here
 * and letting them drift from the modules that own them.
 */
function tableExists(name: string): boolean {
  return (
    getDb().prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) != null
  );
}

/**
 * Remove one entity's rows (or one step of it) from all four tables, in a single
 * transaction, and report what actually went.
 *
 * `step` narrows to one step; omitted, the whole entity goes. The transaction matters: a
 * half-purge that dropped the artifact but kept the judge verdict would leave a
 * condemnation with nothing to condemn, and `/status` reads those orphans.
 */
export function purgeEntity(catalogId: string, entityId: string, step?: string): PurgeCounts {
  const db = getDb();
  const where = step ? 'catalog_id = ? AND entity_id = ? AND step = ?' : 'catalog_id = ? AND entity_id = ?';
  const args = step ? [catalogId, entityId, step] : [catalogId, entityId];

  const counts: PurgeCounts = { ...ZERO_PURGE };
  const run = db.transaction(() => {
    for (const { table, field } of PURGE_TABLES) {
      if (!tableExists(table)) continue;
      counts[field] += db.prepare(`DELETE FROM ${table} WHERE ${where}`).run(...args).changes;
    }
  });
  run();
  return counts;
}

/** One synthetic entity and everything it holds. */
export interface FixtureEntity {
  entityId: string;
  /** Which catalogs this fixture entity has rows in — a fixture usually spans many. */
  catalogIds: string[];
  counts: PurgeCounts;
}

export interface FixtureInventory {
  entities: FixtureEntity[];
  total: PurgeCounts;
  /** `true` when these numbers are what WAS deleted; `false` when they are what WOULD be. */
  purged: boolean;
}

/**
 * Every entity id present in any of the four tables that {@link isSyntheticEntity} calls a
 * fixture.
 *
 * The predicate is READ FROM the shared function rather than re-expressed as a SQL `LIKE`.
 * That is deliberate: `isSyntheticEntity` is load-bearing in four other readers (`/status`,
 * `capabilityModel`, the drain, the evidence audit), and a second, SQL-shaped copy of its
 * rule is exactly how a purge ends up deleting a real entity that merely looks synthetic —
 * or missing one that is.
 */
function syntheticEntityIds(): string[] {
  const db = getDb();
  const ids = new Set<string>();
  for (const { table } of PURGE_TABLES) {
    if (!tableExists(table)) continue;
    for (const row of db.prepare(`SELECT DISTINCT entity_id FROM ${table}`).all() as { entity_id: string }[]) {
      if (isSyntheticEntity(row.entity_id)) ids.add(row.entity_id);
    }
  }
  return Array.from(ids).sort();
}

function catalogsOf(entityId: string): string[] {
  const db = getDb();
  const ids = new Set<string>();
  for (const { table } of PURGE_TABLES) {
    if (!tableExists(table)) continue;
    for (const row of db
      .prepare(`SELECT DISTINCT catalog_id FROM ${table} WHERE entity_id = ?`)
      .all(entityId) as { catalog_id: string }[]) {
      ids.add(row.catalog_id);
    }
  }
  return Array.from(ids).sort();
}

function countEntity(entityId: string): PurgeCounts {
  const db = getDb();
  const counts: PurgeCounts = { ...ZERO_PURGE };
  for (const { table, field } of PURGE_TABLES) {
    if (!tableExists(table)) continue;
    const row = db.prepare(`SELECT count(*) AS c FROM ${table} WHERE entity_id = ?`).get(entityId) as { c: number };
    counts[field] = row.c;
  }
  return counts;
}

/**
 * What a fixture purge WOULD remove — the dry run. Reads only; writes nothing.
 *
 * This is the number the operator decides on. It is deliberately separate from
 * {@link purgeSyntheticFixtures} so the destructive call is never the only way to learn
 * what is there.
 */
export function inventorySyntheticFixtures(): FixtureInventory {
  const entities = syntheticEntityIds().map((entityId) => ({
    entityId,
    catalogIds: catalogsOf(entityId),
    counts: countEntity(entityId),
  }));
  return {
    entities,
    total: entities.reduce((acc, e) => addPurge(acc, e.counts), { ...ZERO_PURGE }),
    purged: false,
  };
}

/**
 * Delete every synthetic fixture entity from all four tables and report, per entity and per
 * table, the rows that ACTUALLY went (`changes()`), so the operator can reconcile the result
 * against the dry run they approved.
 *
 * Operator-triggered only — see the module docstring.
 */
export function purgeSyntheticFixtures(): FixtureInventory {
  const db = getDb();
  const ids = syntheticEntityIds();
  // Capture catalogs BEFORE deleting — afterwards there is nothing left to read them from.
  const catalogsById = new Map(ids.map((id) => [id, catalogsOf(id)] as const));

  const entities: FixtureEntity[] = [];
  const run = db.transaction(() => {
    for (const entityId of ids) {
      const counts: PurgeCounts = { ...ZERO_PURGE };
      for (const { table, field } of PURGE_TABLES) {
        if (!tableExists(table)) continue;
        counts[field] += db.prepare(`DELETE FROM ${table} WHERE entity_id = ?`).run(entityId).changes;
      }
      entities.push({ entityId, catalogIds: catalogsById.get(entityId) ?? [], counts });
    }
  });
  run();

  return {
    entities,
    total: entities.reduce((acc, e) => addPurge(acc, e.counts), { ...ZERO_PURGE }),
    purged: true,
  };
}
