import { randomUUID } from 'crypto';
import { getDb } from '@/lib/db';
import type { EconomyRun, EconomyRunMetrics } from './economy-run';
import type { SimulationConfig } from '@/types/economy-simulator';

function ensureTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS economy_runs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      config TEXT NOT NULL DEFAULT '{}',
      metrics TEXT NOT NULL DEFAULT '{}',
      is_baseline INTEGER NOT NULL DEFAULT 0,
      captured_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  getDb().exec(`
    CREATE INDEX IF NOT EXISTS idx_economy_runs_captured
    ON economy_runs(captured_at DESC)
  `);
}

/** Column row → EconomyRun. Pure (exported for unit test). */
export function rowToRun(row: Record<string, unknown>): EconomyRun {
  return {
    id: row.id as string,
    name: row.name as string,
    config: JSON.parse((row.config as string) || '{}') as SimulationConfig,
    metrics: JSON.parse((row.metrics as string) || '{}') as EconomyRunMetrics,
    isBaseline: Number(row.is_baseline) === 1,
    capturedAt: (row.captured_at as string | null) ?? undefined,
  };
}

export interface SaveRunInput {
  name: string;
  config: SimulationConfig;
  metrics: EconomyRunMetrics;
}

export function saveRun(input: SaveRunInput): EconomyRun {
  ensureTable();
  const id = randomUUID();
  getDb().prepare(`
    INSERT INTO economy_runs (id, name, config, metrics, is_baseline, captured_at)
    VALUES (@id, @name, @config, @metrics, 0, datetime('now'))
    ON CONFLICT(name) DO UPDATE SET
      config = @config,
      metrics = @metrics,
      captured_at = datetime('now')
  `).run({
    id,
    name: input.name,
    config: JSON.stringify(input.config),
    metrics: JSON.stringify(input.metrics),
  });
  // ON CONFLICT keeps the original id; fetch by name to return the canonical row.
  return getRunByName(input.name)!;
}

export function getRun(id: string): EconomyRun | null {
  ensureTable();
  const row = getDb()
    .prepare('SELECT * FROM economy_runs WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToRun(row) : null;
}

export function getRunByName(name: string): EconomyRun | null {
  ensureTable();
  const row = getDb()
    .prepare('SELECT * FROM economy_runs WHERE name = ?')
    .get(name) as Record<string, unknown> | undefined;
  return row ? rowToRun(row) : null;
}

export function listRuns(): EconomyRun[] {
  ensureTable();
  const rows = getDb()
    .prepare('SELECT * FROM economy_runs ORDER BY captured_at DESC')
    .all() as Record<string, unknown>[];
  return rows.map(rowToRun);
}

export function deleteRun(id: string): boolean {
  ensureTable();
  const info = getDb().prepare('DELETE FROM economy_runs WHERE id = ?').run(id);
  return info.changes > 0;
}

/** Atomically promote exactly one run to baseline (or clear all when id is null). */
export function setBaseline(id: string | null): EconomyRun | null {
  ensureTable();
  const db = getDb();
  const tx = db.transaction((targetId: string | null) => {
    db.prepare('UPDATE economy_runs SET is_baseline = 0').run();
    if (targetId) {
      db.prepare('UPDATE economy_runs SET is_baseline = 1 WHERE id = ?').run(targetId);
    }
  });
  tx(id);
  return id ? getRun(id) : null;
}

export function getBaselineRun(): EconomyRun | null {
  ensureTable();
  const row = getDb()
    .prepare('SELECT * FROM economy_runs WHERE is_baseline = 1 LIMIT 1')
    .get() as Record<string, unknown> | undefined;
  return row ? rowToRun(row) : null;
}
