import { getDb } from './db';
import { buildUpdateQuery } from './db-utils';
import { summarizeScenarios, RUN_HISTORY_LIMIT } from '@/types/ai-testing';
import { scenarioDefinitionHash } from '@/lib/ai-testing/run-trend';
import type {
  ScenarioRunRecord,
  TestSuite,
  TestScenario,
  TestSuiteSummary,
  CreateSuitePayload,
  UpdateSuitePayload,
  CreateScenarioPayload,
  UpdateScenarioPayload,
  ScenarioStatus,
  MockStimulus,
  ExpectedAction,
} from '@/types/ai-testing';

/** A history row keeps the head of the graded output (the scenario row keeps it whole). */
const HISTORY_OUTPUT_MAX = 2000;

// ── Schema bootstrap ──

export function ensureAITestingTables() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_test_suites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      target_class TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_test_scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      suite_id INTEGER NOT NULL REFERENCES ai_test_suites(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      stimuli TEXT NOT NULL DEFAULT '[]',
      expected_actions TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft', 'ready', 'running', 'passed', 'failed', 'error')),
      last_run_output TEXT NOT NULL DEFAULT '',
      last_run_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // getSuite() filters scenarios by suite_id; without this index that is a full
  // table scan of ai_test_scenarios on every suite open.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_test_scenarios_suite
    ON ai_test_scenarios(suite_id)
  `);

  // Additive (no existing column or row is touched): one row per (scenario, run),
  // written only by recordRunVerdicts — i.e. by a report-graded run write-back.
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_test_run_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario_id INTEGER NOT NULL REFERENCES ai_test_scenarios(id) ON DELETE CASCADE,
      run_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('passed', 'failed', 'error')),
      ran_at TEXT NOT NULL,
      definition_hash TEXT NOT NULL,
      output TEXT NOT NULL DEFAULT '',
      UNIQUE(scenario_id, run_id)
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_test_run_history_scenario
    ON ai_test_run_history(scenario_id, ran_at DESC)
  `);
}

// ── Row types ──

interface SuiteRow {
  id: number;
  name: string;
  description: string;
  target_class: string;
  created_at: string;
  updated_at: string;
}

interface ScenarioRow {
  id: number;
  suite_id: number;
  name: string;
  description: string;
  stimuli: string;
  expected_actions: string;
  status: string;
  last_run_output: string;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Helpers ──

function rowToScenario(row: ScenarioRow): TestScenario {
  return {
    id: row.id,
    suiteId: row.suite_id,
    name: row.name,
    description: row.description,
    stimuli: JSON.parse(row.stimuli || '[]') as MockStimulus[],
    expectedActions: JSON.parse(row.expected_actions || '[]') as ExpectedAction[],
    status: row.status as ScenarioStatus,
    lastRunOutput: row.last_run_output,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface HistoryRow {
  scenario_id: number;
  run_id: string;
  status: ScenarioRunRecord['status'];
  ran_at: string;
  definition_hash: string;
}

/** The newest RUN_HISTORY_LIMIT runs per scenario (all scenarios, or one suite's). */
function historyByScenario(suiteId?: number): Map<number, ScenarioRunRecord[]> {
  const where = suiteId === undefined
    ? ''
    : 'WHERE scenario_id IN (SELECT id FROM ai_test_scenarios WHERE suite_id = ?)';
  const rows = getDb()
    .prepare(
      `SELECT scenario_id, run_id, status, ran_at, definition_hash FROM (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY scenario_id ORDER BY ran_at DESC, id DESC) AS rn
         FROM ai_test_run_history ${where}
       ) WHERE rn <= ? ORDER BY scenario_id, rn`,
    )
    .all(...(suiteId === undefined ? [] : [suiteId]), RUN_HISTORY_LIMIT) as HistoryRow[];
  const out = new Map<number, ScenarioRunRecord[]>();
  for (const r of rows) {
    const list = out.get(r.scenario_id) ?? [];
    list.push({ runId: r.run_id, status: r.status, ranAt: r.ran_at, definitionHash: r.definition_hash });
    out.set(r.scenario_id, list);
  }
  return out;
}

function withHistory(row: ScenarioRow, history: Map<number, ScenarioRunRecord[]>): TestScenario {
  return { ...rowToScenario(row), history: history.get(row.id) ?? [] };
}

function rowToSuite(row: SuiteRow, scenarios: TestScenario[]): TestSuite {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    targetClass: row.target_class,
    scenarios,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Suite CRUD ──

export function getAllSuites(): TestSuite[] {
  ensureAITestingTables();
  const db = getDb();
  const suiteRows = db
    .prepare('SELECT * FROM ai_test_suites ORDER BY updated_at DESC')
    .all() as SuiteRow[];

  const scenarioRows = db
    .prepare('SELECT * FROM ai_test_scenarios ORDER BY id ASC')
    .all() as ScenarioRow[];

  const history = historyByScenario();
  const scenariosBySuite = new Map<number, TestScenario[]>();
  for (const row of scenarioRows) {
    const list = scenariosBySuite.get(row.suite_id) ?? [];
    list.push(withHistory(row, history));
    scenariosBySuite.set(row.suite_id, list);
  }

  return suiteRows.map((row) =>
    rowToSuite(row, scenariosBySuite.get(row.id) ?? [])
  );
}

export function getSuite(id: number): TestSuite | null {
  ensureAITestingTables();
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM ai_test_suites WHERE id = ?')
    .get(id) as SuiteRow | undefined;
  if (!row) return null;

  const scenarioRows = db
    .prepare('SELECT * FROM ai_test_scenarios WHERE suite_id = ? ORDER BY id ASC')
    .all(id) as ScenarioRow[];

  const history = historyByScenario(id);
  return rowToSuite(row, scenarioRows.map((r) => withHistory(r, history)));
}

export function createSuite(payload: CreateSuitePayload): TestSuite {
  ensureAITestingTables();
  const db = getDb();
  const result = db
    .prepare('INSERT INTO ai_test_suites (name, description, target_class) VALUES (?, ?, ?)')
    .run(payload.name, payload.description, payload.targetClass);
  const suite = getSuite(result.lastInsertRowid as number);
  if (!suite) {
    throw new Error(`Failed to retrieve ai_test_suites record after INSERT (rowid=${result.lastInsertRowid})`);
  }
  return suite;
}

export function updateSuite(payload: UpdateSuitePayload): TestSuite | null {
  ensureAITestingTables();
  const db = getDb();
  const existing = getSuite(payload.id);
  if (!existing) return null;

  const query = buildUpdateQuery('ai_test_suites', payload.id, payload, [
    { key: 'name', column: 'name' },
    { key: 'description', column: 'description' },
    { key: 'targetClass', column: 'target_class' },
  ]);

  if (!query) return existing;

  db.prepare(query.sql).run(...query.values);
  return getSuite(payload.id);
}

export function deleteSuite(id: number): boolean {
  ensureAITestingTables();
  const result = getDb().prepare('DELETE FROM ai_test_suites WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Scenario CRUD ──

export function createScenario(payload: CreateScenarioPayload): TestScenario | null {
  ensureAITestingTables();
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO ai_test_scenarios (suite_id, name, description, stimuli, expected_actions)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      payload.suiteId,
      payload.name,
      payload.description,
      JSON.stringify(payload.stimuli ?? []),
      JSON.stringify(payload.expectedActions ?? [])
    );

  const row = db
    .prepare('SELECT * FROM ai_test_scenarios WHERE id = ?')
    .get(result.lastInsertRowid as number) as ScenarioRow | undefined;
  return row ? rowToScenario(row) : null;
}

export function updateScenario(payload: UpdateScenarioPayload): TestScenario | null {
  ensureAITestingTables();
  const db = getDb();

  const query = buildUpdateQuery('ai_test_scenarios', payload.id, payload, [
    { key: 'name', column: 'name' },
    { key: 'description', column: 'description' },
    { key: 'stimuli', column: 'stimuli' },
    { key: 'expectedActions', column: 'expected_actions' },
    { key: 'status', column: 'status' },
    { key: 'lastRunOutput', column: 'last_run_output' },
    { key: 'lastRunAt', column: 'last_run_at' },
  ], new Set(['stimuli', 'expectedActions']));

  if (!query) return null;

  db.prepare(query.sql).run(...query.values);

  const row = db
    .prepare('SELECT * FROM ai_test_scenarios WHERE id = ?')
    .get(payload.id) as ScenarioRow | undefined;
  return row ? rowToScenario(row) : null;
}

export function deleteScenario(id: number): boolean {
  ensureAITestingTables();
  const result = getDb().prepare('DELETE FROM ai_test_scenarios WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Bulk-transition a set of scenarios to a single status in one transaction.
 * Used for the "mark all running" (Run Tests) and "reset running → error"
 * (CLI-died) paths so one logical state change is one DB write + one refetch,
 * instead of N sequential PUTs each triggering a full-suite re-read.
 *
 * Returns the ids that were actually updated.
 */
export function bulkUpdateScenarioStatus(
  ids: number[],
  status: ScenarioStatus,
  fields: { lastRunOutput?: string; lastRunAt?: string | null } = {},
): number[] {
  ensureAITestingTables();
  const db = getDb();
  const valid = ids.filter((id) => Number.isInteger(id));
  if (valid.length === 0) return [];

  const setClauses = ["status = ?", "updated_at = datetime('now')"];
  const baseValues: unknown[] = [status];
  if (fields.lastRunOutput !== undefined) {
    setClauses.push('last_run_output = ?');
    baseValues.push(fields.lastRunOutput);
  }
  if (fields.lastRunAt !== undefined) {
    setClauses.push('last_run_at = ?');
    baseValues.push(fields.lastRunAt);
  }

  const stmt = db.prepare(
    `UPDATE ai_test_scenarios SET ${setClauses.join(', ')} WHERE id = ?`,
  );
  const updated: number[] = [];
  const run = db.transaction((rows: number[]) => {
    for (const id of rows) {
      const result = stmt.run(...baseValues, id);
      if (result.changes > 0) updated.push(id);
    }
  });
  run(valid);
  return updated;
}

/** A report-graded outcome for one scenario of one run (see run-verdict.ts). */
export interface RecordedVerdict {
  scenarioId: number;
  status: ScenarioRunRecord['status'];
  output: string;
}

/**
 * The ONE door a graded run outcome takes: sets the scenario's status /
 * last-run fields AND appends its run-history row, in one transaction, keyed
 * by (scenario, runId) — grading the same run twice (callback + view close)
 * keeps one row carrying the latest grade. The history row stamps the hash of
 * the definition the run graded. Plain updateScenario / bulk writes never
 * record history: an edit, a dispatch, a client-set status or an ungraded
 * reset is not a run. Returns the scenario ids that exist and were updated.
 */
export function recordRunVerdicts(runId: string, ranAt: string, verdicts: readonly RecordedVerdict[]): number[] {
  ensureAITestingTables();
  const db = getDb();
  const selectRow = db.prepare('SELECT * FROM ai_test_scenarios WHERE id = ?');
  const updateRow = db.prepare(
    "UPDATE ai_test_scenarios SET status = ?, last_run_output = ?, last_run_at = ?, updated_at = datetime('now') WHERE id = ?",
  );
  const upsertHistory = db.prepare(
    `INSERT INTO ai_test_run_history (scenario_id, run_id, status, ran_at, definition_hash, output)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(scenario_id, run_id) DO UPDATE SET
       status = excluded.status, ran_at = excluded.ran_at,
       definition_hash = excluded.definition_hash, output = excluded.output`,
  );
  const updated: number[] = [];
  db.transaction(() => {
    for (const v of verdicts) {
      const row = selectRow.get(v.scenarioId) as ScenarioRow | undefined;
      if (!row) continue;
      updateRow.run(v.status, v.output, ranAt, v.scenarioId);
      const hash = scenarioDefinitionHash(rowToScenario(row));
      upsertHistory.run(v.scenarioId, runId, v.status, ranAt, hash, v.output.slice(0, HISTORY_OUTPUT_MAX));
      updated.push(v.scenarioId);
    }
  })();
  return updated;
}

// ── Summary ──

export function getTestingSummary(): TestSuiteSummary {
  const suites = getAllSuites();
  const { total, passed, failed, draft } = summarizeScenarios(
    suites.flatMap((s) => s.scenarios)
  );

  return {
    totalSuites: suites.length,
    totalScenarios: total,
    passedCount: passed,
    failedCount: failed,
    draftCount: draft,
  };
}
