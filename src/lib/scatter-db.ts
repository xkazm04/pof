import { getDb } from '@/lib/db';
import type { ScatterRun } from '@/types/procgen';
import {
  ensureLedgerColumns,
  readLedger,
  ledgerInsert,
  clampHistoryLimit,
  type LedgerInput,
} from '@/lib/level-design/run-ledger';

function ensureScatterTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS scatter_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_count INTEGER NOT NULL,
      seed INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Additive: the provenance/outcome columns land on existing tables too.
  ensureLedgerColumns(db, 'scatter_runs');
}

function rowToRun(row: Record<string, unknown>): ScatterRun {
  return {
    ...readLedger(row),
    instanceCount: (row.instance_count as number) ?? 0,
  };
}

export type ScatterRunInput = LedgerInput & { instanceCount?: number };

export function recordScatterRun(input: ScatterRunInput): ScatterRun {
  ensureScatterTable();
  const db = getDb();
  const { columns, values } = ledgerInsert(input);
  const cols = ['instance_count', ...columns];
  const info = db
    .prepare(`INSERT INTO scatter_runs (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(input.instanceCount ?? 0, ...values);
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

/** The scatter history, newest first — failures included (see `listProcgenRuns`). */
export function listScatterRuns(opts: { limit?: unknown; docId?: number | null } = {}): ScatterRun[] {
  ensureScatterTable();
  const limit = clampHistoryLimit(opts.limit);
  const where = typeof opts.docId === 'number' ? 'WHERE doc_id = ?' : '';
  const params = typeof opts.docId === 'number' ? [opts.docId, limit] : [limit];
  const rows = getDb()
    .prepare(`SELECT * FROM scatter_runs ${where} ORDER BY id DESC LIMIT ?`)
    .all(...params) as Record<string, unknown>[];
  return rows.map(rowToRun);
}
