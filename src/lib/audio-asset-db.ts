import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AudioAsset, AudioSet, AudioUsageSummary } from '@/types/audio-asset';
import type { AudioKind } from '@/lib/audio-gen/types';

export const AUDIO_DIR = join(homedir(), '.pof', 'audio');

/** Informational monthly generation budget the usage meter fills against. */
export const DEFAULT_AUDIO_MONTHLY_QUOTA = 200;

export function ensureAudioDir(): string {
  if (!existsSync(AUDIO_DIR)) mkdirSync(AUDIO_DIR, { recursive: true });
  return AUDIO_DIR;
}

export function createAudioAssetDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audio_sets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      eventKey TEXT,
      surface TEXT,
      loopable INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audio_assets (
      id TEXT PRIMARY KEY,
      setId TEXT NOT NULL,
      filename TEXT NOT NULL,
      relPath TEXT NOT NULL,
      prompt TEXT NOT NULL,
      provider TEXT NOT NULL,
      durationMs INTEGER NOT NULL DEFAULT 0,
      format TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (setId) REFERENCES audio_sets(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_audio_assets_setId ON audio_assets(setId);
    CREATE TABLE IF NOT EXISTS audio_gen_usage (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      kind TEXT NOT NULL,
      promptHash TEXT NOT NULL,
      cached INTEGER NOT NULL DEFAULT 0,
      durationMs INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audio_gen_usage_createdAt ON audio_gen_usage(createdAt);
  `);

  // Add the favorites + content-hash-cache columns on legacy DBs (idempotent).
  const cols = db.prepare(`PRAGMA table_info(audio_assets)`).all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('favorite')) db.exec(`ALTER TABLE audio_assets ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0`);
  if (!names.has('promptHash')) db.exec(`ALTER TABLE audio_assets ADD COLUMN promptHash TEXT`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audio_assets_promptHash ON audio_assets(promptHash)`);

  db.pragma('foreign_keys = ON');
}

export interface UpsertSetInput {
  id?: string;
  name: string;
  kind: AudioKind;
  eventKey?: string | null;
  surface?: string | null;
  loopable: boolean;
}

export function upsertSet(db: Database.Database, input: UpsertSetInput): AudioSet {
  const id = input.id ?? randomUUID();
  const createdAt = Date.now();
  db.prepare(`
    INSERT INTO audio_sets (id, name, kind, eventKey, surface, loopable, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, kind=excluded.kind, eventKey=excluded.eventKey,
      surface=excluded.surface, loopable=excluded.loopable
  `).run(id, input.name, input.kind, input.eventKey ?? null, input.surface ?? null, input.loopable ? 1 : 0, createdAt);
  return getSet(db, id)!;
}

export function listSets(db: Database.Database): AudioSet[] {
  const rows = db.prepare('SELECT * FROM audio_sets ORDER BY createdAt DESC').all() as Array<Record<string, unknown>>;
  return rows.map(rowToSet);
}

export function getSet(db: Database.Database, id: string): AudioSet | null {
  const row = db.prepare('SELECT * FROM audio_sets WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToSet(row) : null;
}

export function deleteSet(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM audio_sets WHERE id = ?').run(id);
}

export interface AddAssetInput {
  setId: string;
  filename: string;
  relPath: string;
  prompt: string;
  provider: string;
  durationMs: number;
  format: 'mp3' | 'wav';
  /** Content hash of the generation request (cache key). */
  promptHash?: string | null;
}

export function addAsset(db: Database.Database, input: AddAssetInput): AudioAsset {
  const id = randomUUID();
  const createdAt = Date.now();
  const promptHash = input.promptHash ?? null;
  db.prepare(`
    INSERT INTO audio_assets (id, setId, filename, relPath, prompt, provider, durationMs, format, favorite, promptHash, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(id, input.setId, input.filename, input.relPath, input.prompt, input.provider, input.durationMs, input.format, promptHash, createdAt);
  return { id, ...input, promptHash, favorite: false, createdAt };
}

export function listAssets(db: Database.Database, setId: string): AudioAsset[] {
  const rows = db.prepare('SELECT * FROM audio_assets WHERE setId = ? ORDER BY createdAt ASC').all(setId) as Array<Record<string, unknown>>;
  return rows.map(rowToAsset);
}

/**
 * Fetch every asset across all sets in a single indexed pass. Replaces the
 * per-set N+1 (`sets.flatMap(s => listAssets(s.id))`) the library GET used to
 * issue; rows already carry `setId`, so the client groups them itself.
 */
export function listAllAssets(db: Database.Database): AudioAsset[] {
  const rows = db.prepare('SELECT * FROM audio_assets ORDER BY createdAt ASC').all() as Array<Record<string, unknown>>;
  return rows.map(rowToAsset);
}

export function deleteAsset(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM audio_assets WHERE id = ?').run(id);
}

/** Star/unstar a variation. Returns the updated asset, or null if it's gone. */
export function setAssetFavorite(db: Database.Database, id: string, favorite: boolean): AudioAsset | null {
  db.prepare('UPDATE audio_assets SET favorite = ? WHERE id = ?').run(favorite ? 1 : 0, id);
  const row = db.prepare('SELECT * FROM audio_assets WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToAsset(row) : null;
}

/**
 * Look up the most recent asset generated from an identical prompt (the
 * content-hash cache). A hit lets the API skip a billed provider call.
 */
export function findAssetByPromptHash(db: Database.Database, promptHash: string): AudioAsset | null {
  const row = db.prepare(
    'SELECT * FROM audio_assets WHERE promptHash = ? ORDER BY createdAt DESC, rowid DESC LIMIT 1',
  ).get(promptHash) as Record<string, unknown> | undefined;
  return row ? rowToAsset(row) : null;
}

function rowToSet(r: Record<string, unknown>): AudioSet {
  return {
    id: String(r.id), name: String(r.name), kind: r.kind as AudioKind,
    eventKey: (r.eventKey as string | null) ?? null,
    surface: (r.surface as string | null) ?? null,
    loopable: Number(r.loopable) === 1,
    createdAt: Number(r.createdAt),
  };
}
function rowToAsset(r: Record<string, unknown>): AudioAsset {
  return {
    id: String(r.id), setId: String(r.setId), filename: String(r.filename), relPath: String(r.relPath),
    prompt: String(r.prompt), provider: String(r.provider),
    durationMs: Number(r.durationMs), format: r.format as 'mp3' | 'wav',
    favorite: Number(r.favorite) === 1,
    promptHash: (r.promptHash as string | null) ?? null,
    createdAt: Number(r.createdAt),
  };
}

// ── Generation usage log (powers the quota meter) ──

export interface LogUsageInput {
  provider: string;
  kind: AudioKind;
  promptHash: string;
  /** True when served from cache (a billed call we skipped). */
  cached: boolean;
  durationMs: number;
}

export function logUsage(db: Database.Database, input: LogUsageInput): void {
  db.prepare(`
    INSERT INTO audio_gen_usage (id, provider, kind, promptHash, cached, durationMs, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), input.provider, input.kind, input.promptHash, input.cached ? 1 : 0, input.durationMs, Date.now());
}

/**
 * Summarise generation usage for the meter. `windowStart` bounds the "this
 * period" counts (e.g. start of the current month); totals are all-time.
 */
export function getUsageSummary(
  db: Database.Database,
  windowStart: number,
  quota = DEFAULT_AUDIO_MONTHLY_QUOTA,
): AudioUsageSummary {
  const win = db.prepare(
    `SELECT
       SUM(CASE WHEN cached = 0 THEN 1 ELSE 0 END) AS generated,
       SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) AS cached
     FROM audio_gen_usage WHERE createdAt >= ?`,
  ).get(windowStart) as { generated: number | null; cached: number | null };
  const all = db.prepare(
    `SELECT
       SUM(CASE WHEN cached = 0 THEN 1 ELSE 0 END) AS generated,
       SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) AS cached
     FROM audio_gen_usage`,
  ).get() as { generated: number | null; cached: number | null };
  return {
    generated: win.generated ?? 0,
    cached: win.cached ?? 0,
    quota,
    windowStart,
    totalGenerated: all.generated ?? 0,
    totalCached: all.cached ?? 0,
  };
}
