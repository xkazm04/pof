import { getDb } from '@/lib/db';
import type { ProcgenRun } from '@/types/procgen';

function ensureProcgenTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS procgen_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_count INTEGER NOT NULL,
      seed INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function rowToRun(row: Record<string, unknown>): ProcgenRun {
  return {
    id: row.id as number,
    roomCount: row.room_count as number,
    seed: row.seed as number,
    createdAt: row.created_at as string,
  };
}

export function recordProcgenRun(input: { roomCount: number; seed: number }): ProcgenRun {
  ensureProcgenTable();
  const db = getDb();
  const info = db
    .prepare('INSERT INTO procgen_runs (room_count, seed) VALUES (?, ?)')
    .run(input.roomCount, input.seed);
  const row = db
    .prepare('SELECT * FROM procgen_runs WHERE id = ?')
    .get(info.lastInsertRowid) as Record<string, unknown>;
  return rowToRun(row);
}

export function getLatestProcgenRun(): ProcgenRun | null {
  ensureProcgenTable();
  const row = getDb()
    .prepare('SELECT * FROM procgen_runs ORDER BY id DESC LIMIT 1')
    .get() as Record<string, unknown> | undefined;
  return row ? rowToRun(row) : null;
}
