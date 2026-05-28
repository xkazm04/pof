import { getDb } from '@/lib/db';
import type { ProcgenRun, ZoneGraphPin } from '@/types/procgen';
import type { ZoneGraphParams } from '@/lib/world/zone-graph-generator';

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
