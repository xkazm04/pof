import { getDb } from '@/lib/db';
import type { ScatterRun } from '@/types/procgen';

function ensureScatterTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS scatter_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_count INTEGER NOT NULL,
      seed INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function rowToRun(row: Record<string, unknown>): ScatterRun {
  return {
    id: row.id as number,
    instanceCount: row.instance_count as number,
    seed: row.seed as number,
    createdAt: row.created_at as string,
  };
}

export function recordScatterRun(input: { instanceCount: number; seed: number }): ScatterRun {
  ensureScatterTable();
  const db = getDb();
  const info = db
    .prepare('INSERT INTO scatter_runs (instance_count, seed) VALUES (?, ?)')
    .run(input.instanceCount, input.seed);
  const row = db
    .prepare('SELECT * FROM scatter_runs WHERE id = ?')
    .get(info.lastInsertRowid) as Record<string, unknown>;
  return rowToRun(row);
}

export function getLatestScatterRun(): ScatterRun | null {
  ensureScatterTable();
  const row = getDb()
    .prepare('SELECT * FROM scatter_runs ORDER BY id DESC LIMIT 1')
    .get() as Record<string, unknown> | undefined;
  return row ? rowToRun(row) : null;
}
