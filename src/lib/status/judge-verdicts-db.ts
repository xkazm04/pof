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
  /** Model/panel identity for auditability (e.g. 'sonnet-fleet-w1', 'qwen3-vl-4b'). */
  model: string;
  /** Thinking effort the judge ran at (Quality Program WS0: 'low'..'max'). */
  effort?: string;
  /** Rubric version the verdict was scored under (WS2). A verdict under an older rubric
   *  must not silently count as a strict pass — statusModel prefers the newest version. */
  rubricVersion?: number;
  judgedAt?: string;
}

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
  tableEnsured = true;
}

/** Row → JudgeVerdict. Pure (exported for unit test). */
export function rowToVerdict(row: Record<string, unknown>): JudgeVerdict {
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

export function upsertVerdict(v: JudgeVerdict): JudgeVerdict {
  ensureTable();
  getDb().prepare(`
    INSERT INTO judge_verdicts (catalog_id, entity_id, step, judge, verdict, score, findings, model, effort, rubric_version, judged_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT (catalog_id, entity_id, step, judge) DO UPDATE SET
      verdict = excluded.verdict, score = excluded.score, findings = excluded.findings,
      model = excluded.model, effort = excluded.effort, rubric_version = excluded.rubric_version,
      judged_at = excluded.judged_at
  `).run(v.catalogId, v.entityId, v.step, v.judge, v.verdict, Math.round(v.score), v.findings, v.model, v.effort ?? '', v.rubricVersion ?? 1);
  return v;
}
