import { getDb } from '../db';

// ── Schema bootstrap ──

export function ensureMaterialTable() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      params TEXT NOT NULL DEFAULT '{}',
      thumbnail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

// ── Row type ──

interface MaterialRow {
  id: string;
  name: string;
  params: string;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialRecord {
  id: string;
  name: string;
  params: Record<string, unknown>;
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToRecord(row: MaterialRow): MaterialRecord {
  return {
    id: row.id,
    name: row.name,
    params: JSON.parse(row.params),
    thumbnail: row.thumbnail,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── CRUD ──

export function listMaterials(): MaterialRecord[] {
  ensureMaterialTable();
  const db = getDb();
  const rows = db.prepare('SELECT * FROM materials ORDER BY updated_at DESC').all() as MaterialRow[];
  return rows.map(rowToRecord);
}

export function getMaterial(id: string): MaterialRecord | null {
  ensureMaterialTable();
  const db = getDb();
  const row = db.prepare('SELECT * FROM materials WHERE id = ?').get(id) as MaterialRow | undefined;
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
