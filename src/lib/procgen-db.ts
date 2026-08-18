import { getDb } from '@/lib/db';
import type { ProcgenRun, ZoneGraphPin } from '@/types/procgen';
import type { ZoneGraphParams } from '@/lib/world/zone-graph-generator';
import {
  ensureLedgerColumns,
  readLedger,
  ledgerInsert,
  clampHistoryLimit,
  type LedgerInput,
} from '@/lib/level-design/run-ledger';

function ensureProcgenTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS procgen_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_count INTEGER NOT NULL,
      seed INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Additive: the provenance/outcome columns land on existing tables too.
  ensureLedgerColumns(db, 'procgen_runs');
}

function rowToRun(row: Record<string, unknown>): ProcgenRun {
  return {
    ...readLedger(row),
    roomCount: (row.room_count as number) ?? 0,
  };
}

export type ProcgenRunInput = LedgerInput & { roomCount?: number };

export function recordProcgenRun(input: ProcgenRunInput): ProcgenRun {
  ensureProcgenTable();
  const db = getDb();
  const { columns, values } = ledgerInsert(input);
  const cols = ['room_count', ...columns];
  const info = db
    .prepare(`INSERT INTO procgen_runs (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(input.roomCount ?? 0, ...values);
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

/**
 * The run history, newest first — failures included. History IS the seed memory:
 * a re-roll is only safe because the previous seed is still a row here.
 */
export function listProcgenRuns(opts: { limit?: unknown; docId?: number | null } = {}): ProcgenRun[] {
  ensureProcgenTable();
  const limit = clampHistoryLimit(opts.limit);
  const where = typeof opts.docId === 'number' ? 'WHERE doc_id = ?' : '';
  const params = typeof opts.docId === 'number' ? [opts.docId, limit] : [limit];
  const rows = getDb()
    .prepare(`SELECT * FROM procgen_runs ${where} ORDER BY id DESC LIMIT ?`)
    .all(...params) as Record<string, unknown>[];
  return rows.map(rowToRun);
}

function ensureZonePinTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS zone_graph_pins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seed INTEGER NOT NULL,
      params TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      zone_count INTEGER NOT NULL,
      topology TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function rowToPin(row: Record<string, unknown>): ZoneGraphPin {
  return {
    id: row.id as number,
    seed: row.seed as number,
    params: JSON.parse(row.params as string) as ZoneGraphParams,
    label: row.label as string,
    zoneCount: row.zone_count as number,
    topology: row.topology as string,
    createdAt: row.created_at as string,
  };
}

export function saveZonePin(input: {
  seed: number; params: ZoneGraphParams; label?: string; zoneCount: number; topology: string;
}): ZoneGraphPin {
  ensureZonePinTable();
  const db = getDb();
  const info = db
    .prepare('INSERT INTO zone_graph_pins (seed, params, label, zone_count, topology) VALUES (?, ?, ?, ?, ?)')
    .run(input.seed, JSON.stringify(input.params), input.label ?? '', input.zoneCount, input.topology);
  const row = db.prepare('SELECT * FROM zone_graph_pins WHERE id = ?').get(info.lastInsertRowid) as Record<string, unknown>;
  return rowToPin(row);
}

export function listZonePins(): ZoneGraphPin[] {
  ensureZonePinTable();
  const rows = getDb().prepare('SELECT * FROM zone_graph_pins ORDER BY id DESC').all() as Record<string, unknown>[];
  return rows.map(rowToPin);
}

export function deleteZonePin(id: number): void {
  ensureZonePinTable();
  getDb().prepare('DELETE FROM zone_graph_pins WHERE id = ?').run(id);
}
