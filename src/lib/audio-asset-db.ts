import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, normalize, relative } from 'node:path';
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

export function getAsset(db: Database.Database, id: string): AudioAsset | null {
  const row = db.prepare('SELECT * FROM audio_assets WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToAsset(row) : null;
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

// ── On-disk lifecycle (nothing here used to garbage-collect) ──

/**
 * Outcome of one delete's file work. Never a bare boolean: when an unlink fails
 * the caller must be able to state WHAT was left behind and WHERE, alongside the
 * DB row's fate — a half-silent state (row gone, bytes forever) is the bug.
 */
export interface FileRemoval {
  ok: boolean;
  /** The path acted on (resolved + verified), or null when it could not be resolved. */
  path: string | null;
  /** How many files were actually removed. */
  removed: number;
  /** Populated whenever `ok` is false. */
  reason?: string;
}

/**
 * Resolve a module-relative path under {@link AUDIO_DIR} and prove containment.
 *
 * Deletion must only ever touch paths inside the module's own root — never a
 * caller-supplied path. Same structural guard the asset-serving route uses:
 * reject `..` up front, then require `path.relative(root, abs)` to be non-empty,
 * not `..`-prefixed and not absolute. Returns null when containment fails.
 */
export function resolveAudioPath(rel: string): string | null {
  if (!rel || rel.includes('..')) return null;
  const root = normalize(AUDIO_DIR);
  const abs = normalize(join(root, rel));
  const r = relative(root, abs);
  if (!r || r.startsWith('..') || isAbsolute(r)) return null;
  return abs;
}

/**
 * Delete one variation's file. Absence is success (the goal state is "gone"),
 * a containment failure or an fs error is reported with its reason.
 */
export function removeAssetFile(relPath: string): FileRemoval {
  const abs = resolveAudioPath(relPath);
  if (!abs) {
    return { ok: false, path: null, removed: 0, reason: `Refused: "${relPath}" does not resolve inside ${AUDIO_DIR}` };
  }
  if (!existsSync(abs)) return { ok: true, path: abs, removed: 0 };
  try {
    unlinkSync(abs);
    return { ok: true, path: abs, removed: 1 };
  } catch (e) {
    return { ok: false, path: abs, removed: 0, reason: e instanceof Error ? e.message : 'unlink failed' };
  }
}

/** Delete a set's whole `~/.pof/audio/<setId>` directory, guard-checked as above. */
export function removeSetDirectory(setId: string): FileRemoval {
  const abs = resolveAudioPath(setId);
  if (!abs) {
    return { ok: false, path: null, removed: 0, reason: `Refused: set id "${setId}" does not resolve inside ${AUDIO_DIR}` };
  }
  if (!existsSync(abs)) return { ok: true, path: abs, removed: 0 };
  let removed = 0;
  try {
    removed = readdirSync(abs).length;
    rmSync(abs, { recursive: true, force: true });
    return { ok: true, path: abs, removed };
  } catch (e) {
    return { ok: false, path: abs, removed: 0, reason: e instanceof Error ? e.message : 'directory removal failed' };
  }
}

/** Total bytes + file count actually sitting under AUDIO_DIR. */
export interface AudioDiskFootprint { bytes: number; files: number }

/**
 * Measure the module's real on-disk footprint. Disk grew monotonically with no
 * surface even showing it; the Library now states this number.
 */
export function getDiskFootprint(root: string = AUDIO_DIR): AudioDiskFootprint {
  let bytes = 0;
  let files = 0;
  const walk = (dir: string) => {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      const p = join(dir, name);
      try {
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else { bytes += st.size; files += 1; }
      } catch { /* raced with a delete — not part of the footprint */ }
    }
  };
  if (existsSync(root)) walk(root);
  return { bytes, files };
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
