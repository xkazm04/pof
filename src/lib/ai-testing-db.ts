import { getDb } from './db';
import { buildUpdateQuery } from './db-utils';
import type {
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

  const scenariosBySuite = new Map<number, TestScenario[]>();
  for (const row of scenarioRows) {
    const list = scenariosBySuite.get(row.suite_id) ?? [];
    list.push(rowToScenario(row));
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

  return rowToSuite(row, scenarioRows.map(rowToScenario));
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

// ── Summary ──

export function getTestingSummary(): TestSuiteSummary {
  const suites = getAllSuites();
  const allScenarios = suites.flatMap((s) => s.scenarios);

  return {
    totalSuites: suites.length,
    totalScenarios: allScenarios.length,
    passedCount: allScenarios.filter((s) => s.status === 'passed').length,
    failedCount: allScenarios.filter((s) => s.status === 'failed' || s.status === 'error').length,
    draftCount: allScenarios.filter((s) => s.status === 'draft').length,
  };
}
