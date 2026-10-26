import type Database from 'better-sqlite3';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import type { TaskClass } from '@/lib/model-policy';

/**
 * Model benchmark results (Quality Program WS3). Each row is ONE judged DRAW: a task produced at
 * a (model, effort) combo and scored by the strict judge of record. A matrix CELL is every draw
 * of one (run, taskClass, model, effort, taskId); its score is the MEDIAN of those draws, never
 * the last one — a re-run accumulates rows instead of overwriting the cell.
 *
 * Every row is stamped with the RUBRIC_VERSION it was judged under, the judge id that scored it
 * and its cost. A row whose rubric differs from the current one (including legacy rows written
 * before the stamp existed, read as NULL) is STALE: it is still readable, but it never feeds a
 * current aggregate or a model_policy winner. The /status Models panel reads these aggregates.
 */
export interface BenchmarkSample {
  /** One harness invocation; groups the draws of a matrix run. */
  runId: string;
  taskClass: TaskClass;
  model: string;
  effort: string;
  taskId: string;   // which sample task (e.g. 'produce-text:items')
  /** 1-based draw index within the cell. */
  draw: number;
  score: number;    // strict-judge score 0-100
  tokens?: number;
  wallMs?: number;
  /** USD computed from returned tokens × the harness rate table; null when a rate is unknown. */
  costUsd: number | null;
  /** The judge id of record that scored this draw. */
  judgeModelId?: string;
  ranAt?: string;
}

export interface BenchmarkDrawRow extends Omit<BenchmarkSample, 'taskClass' | 'tokens' | 'wallMs' | 'judgeModelId' | 'ranAt'> {
  taskClass: string;
  tokens: number | null;
  wallMs: number | null;
  judgeModelId: string | null;
  /** NULL on rows written before the stamp existed. */
  rubricVersion: number | null;
  ranAt: string;
}

export interface BenchmarkCell {
  runId: string;
  taskClass: string;
  model: string;
  effort: string;
  taskId: string;
  draws: BenchmarkDrawRow[];
  medianScore: number | null;
  tokens: number | null;
  wallMs: number | null;
  /** Sum of the draws' costs; null when ANY draw's cost is unknown (a partial sum is not a cost). */
  costUsd: number | null;
  stale: boolean;
}

export interface BenchmarkAgg {
  taskClass: string;
  model: string;
  effort: string;
  samples: number;
  medianScore: number;
  avgTokens: number;
  avgWallMs: number;
  /** Mean cost per draw over draws with a known cost; null when none is known. */
  avgCostUsd: number | null;
  /** Rubric the aggregated draws were judged under (null = legacy, unstamped). */
  rubricVersion: number | null;
  stale: boolean;
}

/** Is this row's judgment from a rubric other than the current one? NULL (legacy) is stale. */
export function isStaleBenchmark(row: { rubricVersion: number | null | undefined }): boolean {
  return row.rubricVersion !== RUBRIC_VERSION;
}

const TABLE = 'model_benchmarks';
const SCRATCH = 'model_benchmarks__rebuild';

const TABLE_SQL = (name: string) => `
  CREATE TABLE IF NOT EXISTS ${name} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL DEFAULT 'legacy',
    task_class TEXT NOT NULL,
    model TEXT NOT NULL,
    effort TEXT NOT NULL,
    task_id TEXT NOT NULL,
    draw INTEGER NOT NULL DEFAULT 1,
    score INTEGER NOT NULL,
    tokens INTEGER,
    wall_ms INTEGER,
    cost_usd REAL,
    judge_model_id TEXT,
    rubric_version INTEGER,
    ran_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (run_id, task_class, model, effort, task_id, draw)
  )
`;

/**
 * Idempotent migration. The pre-2026-10-22 table keyed rows on (task_class, model, effort,
 * task_id), so a second draw overwrote the first; SQLite cannot drop a primary key in place, so
 * an old-shape table is rebuilt (scratch table, row-count check, rename — the shape
 * scan-findings-db uses). Legacy rows keep their data with run_id 'legacy', draw 1 and a NULL
 * rubric_version, so they read as stale rather than vanishing. A current-shape table is untouched.
 */
export function ensureBenchmarkTable(db: Database.Database): void {
  const cols = new Set((db.prepare(`PRAGMA table_info(${TABLE})`).all() as { name: string }[]).map((c) => c.name));
  if (!cols.size) { db.exec(TABLE_SQL(TABLE)); return; }
  if (cols.has('draw') && cols.has('rubric_version') && cols.has('cost_usd')) return;

  logger.info(`[benchmark-db] rebuilding ${TABLE}: one row per draw + rubric_version + cost_usd`);
  db.transaction(() => {
    const count = (t: string) => (db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c;
    const before = count(TABLE);
    db.exec(`DROP TABLE IF EXISTS ${SCRATCH}`);
    db.exec(TABLE_SQL(SCRATCH));
    const carried = ['task_class', 'model', 'effort', 'task_id', 'score', 'tokens', 'wall_ms', 'ran_at'].filter((c) => cols.has(c));
    db.exec(`INSERT INTO ${SCRATCH} (${carried.join(', ')}) SELECT ${carried.join(', ')} FROM ${TABLE}`);
    const after = count(SCRATCH);
    if (before !== after) throw new Error(`${TABLE} rebuild would lose rows (${before} -> ${after}) — aborted`);
    db.exec(`DROP TABLE ${TABLE}`);
    db.exec(`ALTER TABLE ${SCRATCH} RENAME TO ${TABLE}`);
  })();
}

const ensured = new WeakSet<Database.Database>();
function db(): Database.Database {
  const d = getDb();
  if (!ensured.has(d)) { ensureBenchmarkTable(d); ensured.add(d); }
  return d;
}

/** Record one draw, stamped with the CURRENT rubric version. A repeat of the same draw key replaces it. */
export function recordSample(s: BenchmarkSample): void {
  db().prepare(`
    INSERT INTO ${TABLE} (run_id, task_class, model, effort, task_id, draw, score, tokens, wall_ms, cost_usd, judge_model_id, rubric_version, ran_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
    ON CONFLICT (run_id, task_class, model, effort, task_id, draw) DO UPDATE SET
      score = excluded.score, tokens = excluded.tokens, wall_ms = excluded.wall_ms, cost_usd = excluded.cost_usd,
      judge_model_id = excluded.judge_model_id, rubric_version = excluded.rubric_version, ran_at = excluded.ran_at
  `).run(
    s.runId, s.taskClass, s.model, s.effort, s.taskId, s.draw, Math.round(s.score),
    s.tokens ?? null, s.wallMs ?? null, s.costUsd, s.judgeModelId ?? null, RUBRIC_VERSION, s.ranAt ?? null,
  );
}

function toRow(r: Record<string, unknown>): BenchmarkDrawRow {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    runId: String(r.run_id), taskClass: String(r.task_class), model: String(r.model), effort: String(r.effort),
    taskId: String(r.task_id), draw: Number(r.draw), score: Number(r.score),
    tokens: n(r.tokens), wallMs: n(r.wall_ms), costUsd: n(r.cost_usd),
    judgeModelId: r.judge_model_id == null ? null : String(r.judge_model_id),
    rubricVersion: n(r.rubric_version), ranAt: String(r.ran_at),
  };
}

/** Every recorded draw (optionally one run's), oldest first. */
export function listDraws(runId?: string): BenchmarkDrawRow[] {
  const rows = (runId
    ? db().prepare(`SELECT * FROM ${TABLE} WHERE run_id = ? ORDER BY id`).all(runId)
    : db().prepare(`SELECT * FROM ${TABLE} ORDER BY id`).all()) as Record<string, unknown>[];
  return rows.map(toRow);
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function sumOrNull(xs: (number | null)[]): number | null {
  if (!xs.length || xs.some((x) => x === null)) return null;
  return (xs as number[]).reduce((a, b) => a + b, 0);
}

/** One matrix cell: its draws, the median score and the cell's summed tokens / wall time / cost. */
export function getCell(key: { runId: string; taskClass: string; model: string; effort: string; taskId: string }): BenchmarkCell {
  const draws = (db().prepare(
    `SELECT * FROM ${TABLE} WHERE run_id = ? AND task_class = ? AND model = ? AND effort = ? AND task_id = ? ORDER BY draw`,
  ).all(key.runId, key.taskClass, key.model, key.effort, key.taskId) as Record<string, unknown>[]).map(toRow);
  return {
    ...key,
    draws,
    medianScore: median(draws.map((d) => d.score)),
    tokens: sumOrNull(draws.map((d) => d.tokens)),
    wallMs: sumOrNull(draws.map((d) => d.wallMs)),
    costUsd: sumOrNull(draws.map((d) => d.costUsd)),
    stale: draws.some(isStaleBenchmark),
  };
}

/**
 * Aggregate draws into per-(taskClass, model, effort, rubric) medians. Stale rubrics are kept as
 * their OWN groups (flagged `stale`) so an old-rubric score is visible but never pooled with, or
 * mistaken for, a current one. Sorted: current before stale, then taskClass, then median desc,
 * then cheaper first.
 */
export function listBenchmarks(): BenchmarkAgg[] {
  const groups = new Map<string, BenchmarkDrawRow[]>();
  for (const r of listDraws()) {
    const k = `${r.taskClass}|${r.model}|${r.effort}|${r.rubricVersion ?? ''}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const out: BenchmarkAgg[] = [];
  for (const rs of groups.values()) {
    const { taskClass, model, effort, rubricVersion } = rs[0];
    const costs = rs.map((r) => r.costUsd).filter((c): c is number => c !== null);
    out.push({
      taskClass, model, effort, samples: rs.length,
      medianScore: median(rs.map((r) => r.score)) ?? 0,
      avgTokens: Math.round(avg(rs.map((r) => r.tokens ?? 0).filter(Boolean)) ?? 0),
      avgWallMs: Math.round(avg(rs.map((r) => r.wallMs ?? 0).filter(Boolean)) ?? 0),
      avgCostUsd: avg(costs),
      rubricVersion,
      stale: isStaleBenchmark({ rubricVersion }),
    });
  }
  const cost = (a: BenchmarkAgg) => a.avgCostUsd ?? Number.POSITIVE_INFINITY;
  return out.sort((a, b) =>
    Number(a.stale) - Number(b.stale)
    || a.taskClass.localeCompare(b.taskClass)
    || b.medianScore - a.medianScore
    || cost(a) - cost(b));
}
