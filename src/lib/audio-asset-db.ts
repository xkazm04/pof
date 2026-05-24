import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AudioAsset, AudioSet } from '@/types/audio-asset';
import type { AudioKind } from '@/lib/audio-gen/types';

export const AUDIO_DIR = join(homedir(), '.pof', 'audio');

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
  `);
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
}

export function addAsset(db: Database.Database, input: AddAssetInput): AudioAsset {
  const id = randomUUID();
  const createdAt = Date.now();
  db.prepare(`
    INSERT INTO audio_assets (id, setId, filename, relPath, prompt, provider, durationMs, format, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.setId, input.filename, input.relPath, input.prompt, input.provider, input.durationMs, input.format, createdAt);
  return { id, ...input, createdAt };
}

export function listAssets(db: Database.Database, setId: string): AudioAsset[] {
  const rows = db.prepare('SELECT * FROM audio_assets WHERE setId = ? ORDER BY createdAt ASC').all(setId) as Array<Record<string, unknown>>;
  return rows.map(rowToAsset);
}

export function deleteAsset(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM audio_assets WHERE id = ?').run(id);
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
    createdAt: Number(r.createdAt),
  };
}
