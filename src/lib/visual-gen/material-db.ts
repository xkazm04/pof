import { getDb } from '../db';
import { logger } from '../logger';

// ── Schema bootstrap ──

let ensured = false;

/**
 * Create the `materials` table if absent and run the one-off `thumbnail` drop.
 *
 * The original schema declared a `thumbnail TEXT` column that **no code path
 * could ever write** — `createMaterial` never accepted one and nothing in the
 * Material Lab renders a material thumbnail (the preset chips draw a swatch
 * straight from `params.baseColor`). A column that is null forever reads as
 * "this preset has no thumbnail yet" rather than "this app never makes one", so
 * it is dropped rather than kept as decoration. Guarded + idempotent: on an
 * older SQLite without `DROP COLUMN` the drop is logged and skipped, and the
 * rest of the layer is unaffected because nothing selects the column by name.
 */
export function ensureMaterialTable() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      params TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  if (ensured) return;
  ensured = true;

  const columns = db.prepare('PRAGMA table_info(materials)').all() as { name: string }[];
  if (columns.some((c) => c.name === 'thumbnail')) {
    try {
      db.exec('ALTER TABLE materials DROP COLUMN thumbnail');
    } catch (error) {
      logger.warn('materials: could not drop the dead thumbnail column', error);
    }
  }
}

// ── Row type ──

interface MaterialRow {
  id: string;
  name: string;
  params: string;
  created_at: string;
  updated_at: string;
}

export interface MaterialRecord {
  id: string;
  name: string;
  params: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function rowToRecord(row: MaterialRow): MaterialRecord {
  return {
    id: row.id,
    name: row.name,
    params: JSON.parse(row.params),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Name the columns rather than `SELECT *` so a legacy DB that still carries the
// dropped `thumbnail` column returns the same shape as a fresh one.
const COLUMNS = 'id, name, params, created_at, updated_at';

// ── CRUD ──

export function listMaterials(): MaterialRecord[] {
  ensureMaterialTable();
  const db = getDb();
  const rows = db.prepare(`SELECT ${COLUMNS} FROM materials ORDER BY updated_at DESC`).all() as MaterialRow[];
  return rows.map(rowToRecord);
}

export function getMaterial(id: string): MaterialRecord | null {
  ensureMaterialTable();
  const db = getDb();
  const row = db.prepare(`SELECT ${COLUMNS} FROM materials WHERE id = ?`).get(id) as MaterialRow | undefined;
  return row ? rowToRecord(row) : null;
}

export function createMaterial(id: string, name: string, params: Record<string, unknown>): MaterialRecord {
  ensureMaterialTable();
  const db = getDb();
  db.prepare(
    `INSERT INTO materials (id, name, params) VALUES (?, ?, ?)`,
  ).run(id, name, JSON.stringify(params));
  return getMaterial(id)!;
}

export function updateMaterial(id: string, updates: { name?: string; params?: Record<string, unknown> }): MaterialRecord | null {
  ensureMaterialTable();
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    sets.push('name = ?');
    values.push(updates.name);
  }
  if (updates.params !== undefined) {
    sets.push('params = ?');
    values.push(JSON.stringify(updates.params));
  }

  if (sets.length === 0) return getMaterial(id);

  sets.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE materials SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return getMaterial(id);
}

export function deleteMaterial(id: string): boolean {
  ensureMaterialTable();
  const db = getDb();
  const result = db.prepare('DELETE FROM materials WHERE id = ?').run(id);
  return result.changes > 0;
}
