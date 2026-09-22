/**
 * Style DNA persistence — named style profiles distilled from mood boards, with a
 * single ACTIVE profile that generation routes inject into prompts. Same injectable-db
 * pattern as asset-library-db: tests pass `:memory:`, API routes pass the shared
 * `getDb()` connection.
 */
import type Database from 'better-sqlite3';
import type { StyleDna } from './style-dna';
import { CANON_PROFILES, DEFAULT_CANON_PROFILE } from '@/lib/catalog/canon/profiles';

export interface StyleDnaProfile {
  id: string;
  name: string;
  dna: StyleDna;
  sourceImageCount: number;
  active: boolean;
  /**
   * The canon profile this style belongs to (/diablo W03, D13), or null for the project's own
   * style. A bound profile is never the global ACTIVE one: it reaches only entities of its canon
   * profile, through {@link styleDnaForProfile}.
   */
  canonProfile?: string | null;
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      canon_profile TEXT
    )
  `);
  const cols = db.prepare('PRAGMA table_info(style_dna)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'canon_profile')) db.exec('ALTER TABLE style_dna ADD COLUMN canon_profile TEXT');
}

interface Row {
  id: string;
  name: string;
  dna: string;
  source_image_count: number;
  active: number;
  created_at: string;
  canon_profile: string | null;
}

const toProfile = (r: Row): StyleDnaProfile => ({
  id: r.id,
  name: r.name,
  dna: JSON.parse(r.dna) as StyleDna,
  sourceImageCount: r.source_image_count,
  active: r.active === 1,
  canonProfile: r.canon_profile ?? null,
  createdAt: r.created_at,
});

export interface SaveStyleDnaInput {
  name: string;
  dna: StyleDna;
  sourceImageCount: number;
  /** Bind it to a canon profile (e.g. 'diablo1') instead of making it the project's active style. */
  canonProfile?: string;
}

const boundProfile = (p?: string | null): string | null => (p && p !== DEFAULT_CANON_PROFILE ? p : null);

/**
 * Save a profile. An unbound save becomes the single active profile (the project's style); a save
 * bound to a canon profile never touches the active flag — the newest binding for that profile wins.
 */
export function saveStyleDna(db: Database.Database, input: SaveStyleDnaInput): StyleDnaProfile {
  createStyleDnaDb(db);
  const id = `dna-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const bound = boundProfile(input.canonProfile);
  const write = db.transaction(() => {
    if (!bound) db.prepare('UPDATE style_dna SET active = 0').run();
    db.prepare(
      'INSERT INTO style_dna (id, name, dna, source_image_count, active, canon_profile) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, input.name, JSON.stringify(input.dna), input.sourceImageCount, bound ? 0 : 1, bound);
  });
  write();
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

/**
 * The style for an entity of `canonProfile` (/diablo W03, D13). The project's own profile (or none)
 * gets the ACTIVE style, exactly as before. Any other canon profile gets ONLY its own — a Style DNA
 * bound to it in the DB, else the profile's shipped `styleDna` — never the project's: a Diablo entity rendered in PoF's style is the defect this exists to stop,
 * and "no style" is the honest answer until one is bound.
 */
export function styleDnaForProfile(db: Database.Database, canonProfile?: string | null): StyleDnaProfile | null {
  const bound = boundProfile(canonProfile);
  if (!bound) return getActiveStyleDna(db);
  createStyleDnaDb(db);
  const row = db
    .prepare('SELECT * FROM style_dna WHERE canon_profile = ? ORDER BY created_at DESC, id DESC LIMIT 1')
    .get(bound) as Row | undefined;
  if (row) return toProfile(row);
  // No DB binding: the profile's SHIPPED generation-ready style, if it has one (D13b).
  const shipped = CANON_PROFILES[bound]?.styleDna;
  return shipped
    ? { id: `shipped:${bound}`, name: `${CANON_PROFILES[bound].title} — shipped style`, dna: shipped, sourceImageCount: 0, active: false, canonProfile: bound, createdAt: '' }
    : null;
}

export function listStyleDna(db: Database.Database): StyleDnaProfile[] {
  createStyleDnaDb(db);
  return (db.prepare('SELECT * FROM style_dna ORDER BY created_at DESC, id DESC').all() as Row[]).map(toProfile);
}

export function setActiveStyleDna(db: Database.Database, id: string): boolean {
  createStyleDnaDb(db);
  const target = getStyleDna(db, id);
  // A profile bound to another canon cannot become the project's style.
  if (!target || target.canonProfile) return false;
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
