import { getDb } from '@/lib/db';
import type { GaugedCraftLevel } from '@/lib/status/craft';
import type { LensId } from './lens-map';

/**
 * Craft verdicts — the A-axis storage (see src/lib/status/craft.ts).
 *
 * DELIBERATELY a separate table from `judge_verdicts`: that table's rows participate in
 * acceptance display (`statusModel` elevates a matching-judge pass to `verified`), and a
 * craft gauge must NEVER move an R-grade. Keeping the tables apart makes the leak
 * structurally impossible rather than a discipline.
 *
 * One row per (catalog, entity, step) — a step has exactly one gauging lens
 * (`lensForStep`), so the lens is data, not key. The per-catalog process scorecard is
 * stored in the same table under the sentinel entity/step below.
 */

/** Sentinel row identity for the per-catalog `production-process` scorecard. */
export const PROCESS_ENTITY = '__catalog__';
export const PROCESS_STEP = '__process__';

/** One concrete audit finding. `criterion` names the violated lens rubric criterion. */
export interface CraftFinding {
  criterion: string;
  detail: string;
  /**
   * Where the finding routes:
   *  - `content`    → green-loop's worklist (fixable by better authoring)
   *  - `capability` → the ceilings file (blocked on a generator that doesn't exist)
   *  - `ux`         → the improvement backlog (a missing human-review surface)
   */
  class: 'content' | 'capability' | 'ux';
}

export interface CraftVerdict {
  catalogId: string;
  entityId: string;
  step: string;
  lens: LensId;
  /** Lens version gauged under — older than current projects as A0 UNGAUGED. */
  lensVersion: number;
  /** A1–A4. A0 is absence and is never stored. */
  aLevel: GaugedCraftLevel;
  findings: CraftFinding[];
  /** Model identity for auditability (e.g. 'opus-craft-fleet-1'). */
  model: string;
  effort?: string;
  /**
   * The artifact's `updatedAt` when this verdict was written — the staleness anchor.
   * Stamped server-side by POST /api/craft-verdicts from the artifact then on record;
   * NULL when no artifact existed (process scorecards), which degrades to "staleness
   * unknown", never to "current".
   */
  artifactUpdatedAt?: string;
  judgedAt?: string;
}

let tableEnsured = false;
function ensureTable() {
  if (tableEnsured) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS craft_verdicts (
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      step TEXT NOT NULL,
      lens TEXT NOT NULL,
      lens_version INTEGER NOT NULL DEFAULT 1,
      a_level TEXT NOT NULL CHECK(a_level IN ('A1','A2','A3','A4')),
      findings TEXT NOT NULL DEFAULT '[]',
      model TEXT NOT NULL DEFAULT '',
      effort TEXT NOT NULL DEFAULT '',
      artifact_updated_at TEXT,
      judged_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id, step)
    )
  `);
  tableEnsured = true;
}

/** Parse stored findings JSON, tolerating malformed rows (yield [] — never throw). */
function parseFindings(raw: unknown): CraftFinding[] {
  if (typeof raw !== 'string' || raw === '') return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (f): f is CraftFinding =>
        !!f &&
        typeof f === 'object' &&
        typeof (f as CraftFinding).criterion === 'string' &&
        typeof (f as CraftFinding).detail === 'string' &&
        ['content', 'capability', 'ux'].includes((f as CraftFinding).class),
    );
  } catch {
    return [];
  }
}

/** Row → CraftVerdict. Pure (exported for unit test). */
export function rowToCraftVerdict(row: Record<string, unknown>): CraftVerdict {
  return {
    catalogId: row.catalog_id as string,
    entityId: row.entity_id as string,
    step: row.step as string,
    lens: row.lens as LensId,
    lensVersion: Number(row.lens_version ?? 1),
    aLevel: row.a_level as GaugedCraftLevel,
    findings: parseFindings(row.findings),
    model: (row.model as string) ?? '',
    ...(row.effort ? { effort: row.effort as string } : {}),
    ...(row.artifact_updated_at ? { artifactUpdatedAt: row.artifact_updated_at as string } : {}),
    ...(row.judged_at ? { judgedAt: row.judged_at as string } : {}),
  };
}

export function listCraftVerdicts(catalogId?: string): CraftVerdict[] {
  ensureTable();
  const rows = catalogId
    ? getDb().prepare('SELECT * FROM craft_verdicts WHERE catalog_id = ?').all(catalogId)
    : getDb().prepare('SELECT * FROM craft_verdicts').all();
  return (rows as Record<string, unknown>[]).map(rowToCraftVerdict);
}

export function upsertCraftVerdict(v: CraftVerdict): CraftVerdict {
  ensureTable();
  getDb()
    .prepare(
      `
    INSERT INTO craft_verdicts (catalog_id, entity_id, step, lens, lens_version, a_level, findings, model, effort, artifact_updated_at, judged_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT (catalog_id, entity_id, step) DO UPDATE SET
      lens = excluded.lens, lens_version = excluded.lens_version, a_level = excluded.a_level,
      findings = excluded.findings, model = excluded.model, effort = excluded.effort,
      artifact_updated_at = excluded.artifact_updated_at, judged_at = excluded.judged_at
  `,
    )
    .run(
      v.catalogId,
      v.entityId,
      v.step,
      v.lens,
      v.lensVersion,
      v.aLevel,
      JSON.stringify(v.findings),
      v.model,
      v.effort ?? '',
      v.artifactUpdatedAt ?? null,
    );
  return v;
}
