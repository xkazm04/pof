/**
 * Style DNA persistence — named style profiles distilled from mood boards, with a
 * single ACTIVE profile that generation routes inject into prompts. Same injectable-db
 * pattern as asset-library-db: tests pass `:memory:`, API routes pass the shared
 * `getDb()` connection.
 */
import type Database from 'better-sqlite3';
import type { StyleDna } from './style-dna';

export interface StyleDnaProfile {
  id: string;
  name: string;
  dna: StyleDna;
  sourceImageCount: number;
  active: boolean;
  createdAt: string;
}

export function createStyleDnaDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS style_dna (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dna TEXT NOT NULL,
      source_image_count INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

interface Row {
  id: string;
  name: string;
  dna: string;
  source_image_count: number;
  active: number;
  created_at: string;
}

const toProfile = (r: Row): StyleDnaProfile => ({
  id: r.id,
  name: r.name,
  dna: JSON.parse(r.dna) as StyleDna,
  sourceImageCount: r.source_image_count,
  active: r.active === 1,
  createdAt: r.created_at,
});

export interface SaveStyleDnaInput {
  name: string;
  dna: StyleDna;
  sourceImageCount: number;
}

/** Save a profile; the newest save becomes the single active profile. */
export function saveStyleDna(db: Database.Database, input: SaveStyleDnaInput): StyleDnaProfile {
  createStyleDnaDb(db);
  const id = `dna-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const activate = db.transaction(() => {
    db.prepare('UPDATE style_dna SET active = 0').run();
    db.prepare(
      'INSERT INTO style_dna (id, name, dna, source_image_count, active) VALUES (?, ?, ?, ?, 1)',
    ).run(id, input.name, JSON.stringify(input.dna), input.sourceImageCount);
  });
  activate();
  return getStyleDna(db, id)!;
}

export function getStyleDna(db: Database.Database, id: string): StyleDnaProfile | null {
  createStyleDnaDb(db);
  const row = db.prepare('SELECT * FROM style_dna WHERE id = ?').get(id) as Row | undefined;
  return row ? toProfile(row) : null;
}

export function getActiveStyleDna(db: Database.Database): StyleDnaProfile | null {
  createStyleDnaDb(db);
  const row = db.prepare('SELECT * FROM style_dna WHERE active = 1 LIMIT 1').get() as Row | undefined;
  return row ? toProfile(row) : null;
}

export function listStyleDna(db: Database.Database): StyleDnaProfile[] {
  createStyleDnaDb(db);
  return (db.prepare('SELECT * FROM style_dna ORDER BY created_at DESC, id DESC').all() as Row[]).map(toProfile);
}

export function setActiveStyleDna(db: Database.Database, id: string): boolean {
  createStyleDnaDb(db);
  if (!getStyleDna(db, id)) return false;
  const activate = db.transaction(() => {
    db.prepare('UPDATE style_dna SET active = 0').run();
    db.prepare('UPDATE style_dna SET active = 1 WHERE id = ?').run(id);
  });
  activate();
  return true;
}

export function deleteStyleDna(db: Database.Database, id: string): boolean {
  createStyleDnaDb(db);
  return db.prepare('DELETE FROM style_dna WHERE id = ?').run(id).changes > 0;
}
