import { VERDICT_HISTORY_LIMIT } from '@/lib/judge/verdictTrend';
import { getDb } from '@/lib/db';

/**
 * Judge verdicts — the content-quality layer the automated checkers cannot provide
 * (2026-07-07 fleet audit: 316/342 accept checkers are shape-only). A verdict is an
 * LLM-panel (Sonnet fleet) or VLM (Qwen) judgment of a step's PRODUCED CONTENT against
 * the project canon + ARPG laws. Stored separately from pipeline_artifacts on purpose:
 * the artifact POST route re-grades with the step's shape checker, which would erase a
 * judge's verdict. /status merges the two — judge-pass on a step whose audited judge
 * class matches → verified; judge-fail → attention.
 */
export interface JudgeVerdict {
  catalogId: string;
  entityId: string;
  step: string;
  /** Who judged: the Sonnet content panel or the local Qwen vision tier. */
  judge: 'llm-panel' | 'vlm' | 'human';
  verdict: 'pass' | 'fail';
  /** 0-100 content-quality score. */
  score: number;
  /** The judge's concrete findings (why it passed/failed). */
  findings: string;
  /** Per-dimension 0-100 craft scores keyed by the rubric dimension (Quality Program WS2;
   *  see src/lib/judge/dimensions.ts). Absent on verdicts scored before this column existed —
   *  the flat `score` remains the source of truth; these enrich the detail views when present. */
  dimensions?: Record<string, number>;
  /** Model/panel identity for auditability (e.g. 'sonnet-fleet-w1', 'qwen3-vl-4b'). */
  model: string;
  /** Thinking effort the judge ran at (Quality Program WS0: 'low'..'max'). */
  effort?: string;
  /** Rubric version the verdict was scored under (WS2). A verdict under an older rubric
   *  must not silently count as a strict pass — statusModel prefers the newest version. */
  rubricVersion?: number;
  /**
   * Fingerprint of the artifact CONTENT this verdict judged (`stepContentHash`), so a verdict
   * is bound to what it actually read. Without it a condemnation outlived the content: fix the
   * step, re-produce it, and the stale verdict still downgraded the step forever.
   *
   * ABSENT on every verdict written before this column existed — those degrade to
   * `unknown` provenance (see `judgeBridge.verdictProvenance`), NEVER to "current". Stamped
   * server-side by `POST /api/judge-verdicts` from the artifact then on record, so every
   * producer (judge-run, the gap-loop scripts, any future one) binds without opting in.
   */
  contentHash?: string;
  judgedAt?: string;
}

/**
 * How many judgments are kept per (catalog, entity, step, judge) in {@link listVerdictHistory}.
 *
 * RETENTION IS BOUNDED and this is the bound: the newest 20 re-judges. A judging campaign
 * re-scores the same step many times, and an unbounded log of full `findings` strings would
 * grow the DB without limit for a trend nobody reads that far back. Pruning happens inside the
 * same transaction as the write, so the table can never exceed it. The CURRENT verdict is never
 * pruned — it lives in `judge_verdicts`, which this cap does not touch.
 */
// Defined in the PURE trend module so a client component can display the bound without
// importing this file (which opens better-sqlite3 at import time). Re-exported for callers.
export { VERDICT_HISTORY_LIMIT };

let tableEnsured = false;
function ensureTable() {
  if (tableEnsured) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS judge_verdicts (
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      step TEXT NOT NULL,
      judge TEXT NOT NULL,
      verdict TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      findings TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      judged_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id, step, judge)
    )
  `);
  // Additive columns (Quality Program WS0/WS2) — safe on existing tables.
  const cols = new Set((getDb().prepare('PRAGMA table_info(judge_verdicts)').all() as { name: string }[]).map((c) => c.name));
  if (!cols.has('effort')) getDb().exec("ALTER TABLE judge_verdicts ADD COLUMN effort TEXT NOT NULL DEFAULT ''");
  if (!cols.has('rubric_version')) getDb().exec('ALTER TABLE judge_verdicts ADD COLUMN rubric_version INTEGER NOT NULL DEFAULT 1');
  // Nullable JSON (no default) — old rows stay NULL and render exactly as before (WS2).
  if (!cols.has('dimensions')) getDb().exec('ALTER TABLE judge_verdicts ADD COLUMN dimensions TEXT');
  // Nullable content binding — legacy rows stay NULL and are reported as unknown-provenance,
  // never silently upgraded to "judged the current content".
  if (!cols.has('content_hash')) getDb().exec('ALTER TABLE judge_verdicts ADD COLUMN content_hash TEXT');
  ensureHistoryTable();
  tableEnsured = true;
}

/**
 * The append-only judgment LOG (additive; `judge_verdicts` is untouched).
 *
 * A re-judge used to DESTROY the record of what the judge previously said — the table keeps one
 * row per judge class per step, so the second run overwrote the first. That made the one question
 * a quality loop exists to answer, "did my fix actually improve this?", unanswerable from the data,
 * even though the loop's own campaigns re-judge repeatedly.
 *
 * Deliberately a SECOND table rather than a widened primary key: `judge_verdicts` must keep
 * holding exactly ONE row per (catalog, entity, step, judge) so `bridgeJudgeVerdict` still sees
 * exactly one applicable verdict per judge class and acceptance is provably unchanged. History is
 * evidence; it never participates in grading and nothing in `src/lib/catalog/acceptance/` reads it.
 */
function ensureHistoryTable() {
  const existed = getDb()
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'judge_verdict_history'")
    .get() != null;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS judge_verdict_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      step TEXT NOT NULL,
      judge TEXT NOT NULL,
      verdict TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      findings TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      effort TEXT NOT NULL DEFAULT '',
      rubric_version INTEGER NOT NULL DEFAULT 1,
      dimensions TEXT,
      content_hash TEXT,
      judged_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_jvh_step ON judge_verdict_history (catalog_id, entity_id, step, judge, id);
  `);
  // One-time seed: the verdicts already on record ARE the first point of every trend. Without
  // this the log would start empty and a step judged 20 times would read as never judged until
  // the next run. Only ever runs when the table did not exist (never re-inserts).
  if (!existed) {
    getDb().exec(`
      INSERT INTO judge_verdict_history
        (catalog_id, entity_id, step, judge, verdict, score, findings, model, effort, rubric_version, dimensions, content_hash, judged_at)
      SELECT catalog_id, entity_id, step, judge, verdict, score, findings, model, effort, rubric_version, dimensions, content_hash, judged_at
        FROM judge_verdicts
    `);
  }
}

/** Parse the stored dimensions JSON into a `{ key: number }` map, tolerating legacy NULL /
 *  malformed rows (they simply yield no dimensions — never throw). */
function parseDimensions(raw: unknown): Record<string, number> | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return undefined;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
    return Object.keys(out).length ? out : undefined;
  } catch {
    return undefined;
  }
}

/** Row → JudgeVerdict. Pure (exported for unit test). */
export function rowToVerdict(row: Record<string, unknown>): JudgeVerdict {
  const dimensions = parseDimensions(row.dimensions);
  return {
    catalogId: row.catalog_id as string,
    entityId: row.entity_id as string,
    step: row.step as string,
    judge: row.judge as JudgeVerdict['judge'],
    verdict: row.verdict as JudgeVerdict['verdict'],
    score: Number(row.score ?? 0),
    findings: (row.findings as string) ?? '',
    model: (row.model as string) ?? '',
    ...(row.effort ? { effort: row.effort as string } : {}),
    ...(row.rubric_version != null ? { rubricVersion: Number(row.rubric_version) } : {}),
    ...(row.content_hash ? { contentHash: row.content_hash as string } : {}),
    ...(dimensions ? { dimensions } : {}),
    ...(row.judged_at ? { judgedAt: row.judged_at as string } : {}),
  };
}

export function listVerdicts(catalogId?: string): JudgeVerdict[] {
  ensureTable();
  const rows = catalogId
    ? getDb().prepare('SELECT * FROM judge_verdicts WHERE catalog_id = ?').all(catalogId)
    : getDb().prepare('SELECT * FROM judge_verdicts').all();
  return (rows as Record<string, unknown>[]).map(rowToVerdict);
}

/**
 * Record a judgment: append it to the bounded history AND make it the CURRENT verdict.
 *
 * Both writes happen in ONE transaction against ONE `judged_at`, so the current row and its
 * newest history entry can never disagree, and a crash can never leave a trend point with no
 * verdict (or the reverse). Acceptance is untouched: `judge_verdicts` still holds exactly one
 * row per (catalog, entity, step, judge).
 */
export function upsertVerdict(v: JudgeVerdict): JudgeVerdict {
  ensureTable();
  const db = getDb();
  const dimensionsJson = v.dimensions && Object.keys(v.dimensions).length ? JSON.stringify(v.dimensions) : null;
  // One timestamp for both writes, in SQLite's own format (the column's historic shape).
  const now = (db.prepare("SELECT datetime('now') AS t").get() as { t: string }).t;
  const args = [v.catalogId, v.entityId, v.step, v.judge, v.verdict, Math.round(v.score), v.findings, v.model, v.effort ?? '', v.rubricVersion ?? 1, dimensionsJson, v.contentHash ?? null, now] as const;

  const write = db.transaction(() => {
    db.prepare(`
      INSERT INTO judge_verdict_history (catalog_id, entity_id, step, judge, verdict, score, findings, model, effort, rubric_version, dimensions, content_hash, judged_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...args);
    // Bounded retention — prune inside the same transaction so the cap always holds.
    db.prepare(`
      DELETE FROM judge_verdict_history
       WHERE catalog_id = ? AND entity_id = ? AND step = ? AND judge = ?
         AND id NOT IN (
           SELECT id FROM judge_verdict_history
            WHERE catalog_id = ? AND entity_id = ? AND step = ? AND judge = ?
            ORDER BY id DESC LIMIT ?
         )
    `).run(v.catalogId, v.entityId, v.step, v.judge, v.catalogId, v.entityId, v.step, v.judge, VERDICT_HISTORY_LIMIT);
    db.prepare(`
      INSERT INTO judge_verdicts (catalog_id, entity_id, step, judge, verdict, score, findings, model, effort, rubric_version, dimensions, content_hash, judged_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (catalog_id, entity_id, step, judge) DO UPDATE SET
        verdict = excluded.verdict, score = excluded.score, findings = excluded.findings,
        model = excluded.model, effort = excluded.effort, rubric_version = excluded.rubric_version,
        dimensions = excluded.dimensions, content_hash = excluded.content_hash, judged_at = excluded.judged_at
    `).run(...args);
  });
  write();
  return v;
}

/**
 * The kept judgments for one step, OLDEST FIRST (the order a trend reads in) — at most
 * {@link VERDICT_HISTORY_LIMIT} per judge class. Evidence only: no acceptance path calls this.
 * Omit `judge` to get every judge class interleaved by write order.
 */
export function listVerdictHistory(catalogId: string, entityId: string, step: string, judge?: JudgeVerdict['judge']): JudgeVerdict[] {
  ensureTable();
  const rows = judge
    ? getDb().prepare('SELECT * FROM judge_verdict_history WHERE catalog_id = ? AND entity_id = ? AND step = ? AND judge = ? ORDER BY id ASC').all(catalogId, entityId, step, judge)
    : getDb().prepare('SELECT * FROM judge_verdict_history WHERE catalog_id = ? AND entity_id = ? AND step = ? ORDER BY id ASC').all(catalogId, entityId, step);
  return (rows as Record<string, unknown>[]).map(rowToVerdict);
}
