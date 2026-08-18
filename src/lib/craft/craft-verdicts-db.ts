import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';
import { recordSpend, type RecordSpendInput } from '@/lib/cli-spend-db';
import type { CliRunMetrics } from '@/lib/judge/spendMeter';
import type { GaugedCraftLevel } from '@/lib/status/craft';
import type { LensId } from './lens-map';
import { CRAFT_HISTORY_LIMIT } from './craftCell';

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

/**
 * How many gauges are kept per (catalog, entity, step) in {@link listCraftVerdictHistory}.
 *
 * RETENTION IS BOUNDED and this is the bound: the newest 20 re-gauges, mirroring the R-axis
 * `VERDICT_HISTORY_LIMIT`. Pruning happens inside the same transaction as the write, so the
 * table can never exceed it. The CURRENT gauge is never pruned — it lives in `craft_verdicts`,
 * which this cap does not touch.
 */
// Defined in the PURE cell module so a client component can display the bound without
// importing this file (which opens better-sqlite3 at import time). Re-exported for callers.
export { CRAFT_HISTORY_LIMIT };

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
  ensureHistoryTable();
  tableEnsured = true;
}

/**
 * The append-only GAUGE LOG (additive; `craft_verdicts` is untouched).
 *
 * A re-gauge used to DESTROY the record of the previous craft level — the table keeps one row
 * per (catalog, entity, step), so a campaign could raise a cell from A1 to A3 and leave no
 * evidence it moved. That is the one question a craft loop exists to answer.
 *
 * Deliberately a SECOND table rather than a widened primary key: `craft_verdicts` must keep
 * holding exactly ONE row per cell so the projection in `craftCell` still sees exactly one
 * applicable gauge. History is evidence; nothing in `src/lib/catalog/acceptance/` or
 * `statusModel` reads it, so like the rest of the A-axis it provably cannot move an R-grade.
 */
function ensureHistoryTable() {
  const existed =
    getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'craft_verdict_history'")
      .get() != null;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS craft_verdict_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      judged_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cvh_step ON craft_verdict_history (catalog_id, entity_id, step, id);
  `);
  // One-time seed: the gauges already on record ARE the first point of every trend. Left alone
  // they would read as never gauged until the next re-gauge, and the first movement would start
  // from the NEW level — losing exactly the evidence this log exists to keep. Runs only when the
  // table did not exist, so it never double-inserts.
  if (!existed) {
    getDb().exec(`
      INSERT INTO craft_verdict_history
        (catalog_id, entity_id, step, lens, lens_version, a_level, findings, model, effort, artifact_updated_at, judged_at)
      SELECT catalog_id, entity_id, step, lens, lens_version, a_level, findings, model, effort, artifact_updated_at, judged_at
        FROM craft_verdicts
    `);
  }
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

// ── Spend metering — the A-axis's half of the ledger ────────────────────────────────
//
// Every R-axis judge draw reaches `recordSpend` through `@/lib/judge/spendMeter`, so the judge
// fleet's ROI is visible. The A-axis was completely unmetered: craft gauging spends real model
// budget and appeared in no ledger, which made "is the craft campaign worth what it spends?"
// unanswerable while the same question was answerable next door. These helpers put craft writes
// in the SAME `cli_spend` ledger under a DISTINCT module + task types, so the two axes are
// separable in reporting rather than fused into one opaque total.

/** The spend module every craft gauge is attributed to. Distinct from `judge` on purpose. */
export const CRAFT_SPEND_MODULE = 'craft';

/**
 * The spend task types a craft write is recorded under: a per-step gauge, or the per-catalog
 * `production-process` scorecard (a different unit of work at a different frequency).
 */
export type CraftTaskType = 'craft-gauge' | 'craft-process';

export function craftTaskType(v: Pick<CraftVerdict, 'entityId' | 'step'>): CraftTaskType {
  return v.step === PROCESS_STEP || v.entityId === PROCESS_ENTITY ? 'craft-process' : 'craft-gauge';
}

/**
 * The metered cost of one craft gauge — the metering half of the judge fleet's
 * {@link CliRunMetrics}, minus the CLI transcript a craft POST has no analogue for. Reusing that
 * shape means a future craft runner that spawns `claude -p --output-format json` can hand
 * `parseCliJsonRun(stdout)` straight in.
 */
export type CraftGaugeCost = Omit<CliRunMetrics, 'text'>;

function meteredNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}

/**
 * Normalize the OPTIONAL cost a craft writer may report into the metering shape.
 *
 * `costKnown` is the honesty flag. The only thing writing craft verdicts today is an agent
 * following the craft-loop skill, which cannot report its own cost — so an absent (or explicitly
 * disclaimed) cost yields `costKnown: false`, and the run is recorded as unmeasured rather than
 * as a measured $0.00. A fabricated zero that looked like a real measurement is exactly the
 * invisibility this seam exists to remove.
 */
export function craftGaugeCost(reported?: Partial<CraftGaugeCost>): CraftGaugeCost {
  const usd = typeof reported?.costUsd === 'number' && Number.isFinite(reported.costUsd) ? reported.costUsd : null;
  const costKnown = reported?.costKnown === false ? false : usd !== null;
  return {
    costUsd: costKnown && usd !== null ? usd : 0,
    costKnown,
    tokensIn: meteredNumber(reported?.tokensIn),
    tokensOut: meteredNumber(reported?.tokensOut),
    cacheReadTokens: meteredNumber(reported?.cacheReadTokens),
    cacheCreationTokens: meteredNumber(reported?.cacheCreationTokens),
    durationMs: meteredNumber(reported?.durationMs),
    sessionKey: typeof reported?.sessionKey === 'string' ? reported.sessionKey : null,
    isError: reported?.isError === true,
  };
}

/**
 * Build the `recordSpend` input for one craft gauge. Pure, so the metering contract (module,
 * task type, label, status) is asserted in a test without a DB.
 *
 * `label` names the exact unit of work so a campaign's cost is attributable per gauge instead of
 * arriving as one opaque total. A write whose cost the caller did not report is LABELLED as
 * unreported rather than presented as a measured $0.00 — the same honesty marker the judge path
 * uses, and the only one the `cli_spend` schema can carry today (it has no `cost_known` column).
 */
export function craftSpendRecord(v: CraftVerdict, m: CraftGaugeCost): RecordSpendInput {
  const label = `${v.catalogId}::${v.step} [${v.entityId}] ${v.lens} → ${v.aLevel}`;
  return {
    moduleId: CRAFT_SPEND_MODULE,
    taskType: craftTaskType(v),
    taskLabel: (m.costKnown ? label : `${label} (cost unreported by writer)`).slice(0, 300),
    sessionKey: m.sessionKey,
    costUsd: m.costUsd,
    tokensIn: m.tokensIn,
    tokensOut: m.tokensOut,
    cacheReadTokens: m.cacheReadTokens,
    cacheCreationTokens: m.cacheCreationTokens,
    durationMs: m.durationMs,
    success: !m.isError,
    status: m.isError ? 'failed' : 'completed',
  };
}

/**
 * Record a craft gauge: append it to the bounded history AND make it the CURRENT verdict.
 *
 * Both writes happen in ONE transaction against ONE `judged_at`, so the current row and its
 * newest history entry can never disagree, and a crash can never leave a trend point with no
 * verdict (or the reverse). `craft_verdicts` still holds exactly one row per cell, so the
 * projection in `craftCell` — and therefore the /status chip — is unchanged.
 *
 * The write is also the METERING seam: every gauge lands in `cli_spend` under the `craft` module
 * (see {@link craftSpendRecord}), so any producer — the route, a future script — is costed
 * without opting in. `cost` is OPTIONAL: the skill-driven writer that cannot report its spend
 * still succeeds, and its run is recorded as cost-unknown rather than free.
 */
export function upsertCraftVerdict(v: CraftVerdict, cost?: Partial<CraftGaugeCost>): CraftVerdict {
  ensureTable();
  const db = getDb();
  // One timestamp for both writes, in SQLite's own format (the column's historic shape).
  const now = (db.prepare("SELECT datetime('now') AS t").get() as { t: string }).t;
  const args = [
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
    now,
  ] as const;

  const write = db.transaction(() => {
    db.prepare(
      `INSERT INTO craft_verdict_history (catalog_id, entity_id, step, lens, lens_version, a_level, findings, model, effort, artifact_updated_at, judged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(...args);
    // Bounded retention — prune inside the same transaction so the cap always holds.
    db.prepare(
      `DELETE FROM craft_verdict_history
        WHERE catalog_id = ? AND entity_id = ? AND step = ?
          AND id NOT IN (
            SELECT id FROM craft_verdict_history
             WHERE catalog_id = ? AND entity_id = ? AND step = ?
             ORDER BY id DESC LIMIT ?
          )`,
    ).run(v.catalogId, v.entityId, v.step, v.catalogId, v.entityId, v.step, CRAFT_HISTORY_LIMIT);
    db.prepare(
      `INSERT INTO craft_verdicts (catalog_id, entity_id, step, lens, lens_version, a_level, findings, model, effort, artifact_updated_at, judged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (catalog_id, entity_id, step) DO UPDATE SET
         lens = excluded.lens, lens_version = excluded.lens_version, a_level = excluded.a_level,
         findings = excluded.findings, model = excluded.model, effort = excluded.effort,
         artifact_updated_at = excluded.artifact_updated_at, judged_at = excluded.judged_at`,
    ).run(...args);
  });
  write();
  // Metering is secondary to the gauge and deliberately OUTSIDE the transaction: a ledger
  // failure must never lose a verdict that was already committed.
  try {
    recordSpend(craftSpendRecord(v, craftGaugeCost(cost)));
  } catch (e) {
    logger.warn('craft spend metering failed; the gauge is recorded regardless', e);
  }
  return { ...v, judgedAt: now };
}

/** Stable index key for one gauged cell. */
export function craftVerdictKey(catalogId: string, entityId: string, step: string): string {
  return `${catalogId} ${entityId} ${step}`;
}

/**
 * The kept gauges for one cell, OLDEST FIRST (the order a trend reads in) — at most
 * {@link CRAFT_HISTORY_LIMIT}. Evidence only: no acceptance or grading path calls this.
 */
export function listCraftVerdictHistory(catalogId: string, entityId: string, step: string): CraftVerdict[] {
  ensureTable();
  const rows = getDb()
    .prepare(
      'SELECT * FROM craft_verdict_history WHERE catalog_id = ? AND entity_id = ? AND step = ? ORDER BY id ASC',
    )
    .all(catalogId, entityId, step);
  return (rows as Record<string, unknown>[]).map(rowToCraftVerdict);
}

/**
 * Every kept gauge, grouped by {@link craftVerdictKey}, oldest first — in ONE query.
 *
 * This is what lets `GET /api/craft-verdicts` attach each cell's movement to the verdict rows
 * it already returns: the /status map holds ~342 cells, and a per-cell history request would
 * be 342 round-trips for a display chip.
 */
export function craftHistoryIndex(catalogId?: string): Map<string, CraftVerdict[]> {
  ensureTable();
  const rows = (
    catalogId
      ? getDb().prepare('SELECT * FROM craft_verdict_history WHERE catalog_id = ? ORDER BY id ASC').all(catalogId)
      : getDb().prepare('SELECT * FROM craft_verdict_history ORDER BY id ASC').all()
  ) as Record<string, unknown>[];
  const out = new Map<string, CraftVerdict[]>();
  for (const row of rows) {
    const v = rowToCraftVerdict(row);
    const key = craftVerdictKey(v.catalogId, v.entityId, v.step);
    const list = out.get(key);
    if (list) list.push(v);
    else out.set(key, [v]);
  }
  return out;
}
