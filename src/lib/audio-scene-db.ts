import { getDb } from './db';
import { logger } from './logger';
import { brokenDocName } from './level-design-db';
import { buildUpdateQuery } from './db-utils';
import { clampConfigInt } from './economy/normalize-config';
import type {
  AudioSceneDocument,
  AudioSceneSummary,
  CreateAudioScenePayload,
  UpdateAudioScenePayload,
  EmitterType,
} from '@/types/audio-scene';

// ── Schema bootstrap ──

export function ensureAudioSceneTable() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS audio_scenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      zones TEXT NOT NULL DEFAULT '[]',
      emitters TEXT NOT NULL DEFAULT '[]',
      global_reverb_preset TEXT NOT NULL DEFAULT 'none',
      sound_pool_size INTEGER NOT NULL DEFAULT 32,
      max_concurrent_sounds INTEGER NOT NULL DEFAULT 16,
      last_generated_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

// ── Row type ──

interface AudioSceneRow {
  id: number;
  name: string;
  description: string;
  zones: string;
  emitters: string;
  global_reverb_preset: string;
  sound_pool_size: number;
  max_concurrent_sounds: number;
  last_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Helpers ──

/**
 * Parse one JSON blob column, reporting failure instead of throwing. Twin of
 * level-design-db's parseBlob: a truncated write or a non-array blob must not 500
 * the whole list GET or crash the summary that iterates the value.
 */
function parseBlob<T>(raw: unknown, field: string, broken: string[]): T[] {
  const text = typeof raw === 'string' ? raw : '';
  if (!text) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      broken.push(field);
      return [];
    }
    return parsed as T[];
  } catch {
    broken.push(field);
    return [];
  }
}

function rowToDoc(row: AudioSceneRow): AudioSceneDocument {
  const broken: string[] = [];
  const doc: AudioSceneDocument = {
    id: row.id,
    name: row.name,
    description: row.description,
    zones: parseBlob<AudioSceneDocument['zones'][number]>(row.zones, 'zones', broken),
    emitters: parseBlob<AudioSceneDocument['emitters'][number]>(row.emitters, 'emitters', broken),
    globalReverbPreset: (row.global_reverb_preset as AudioSceneDocument['globalReverbPreset']) || 'none',
    soundPoolSize: row.sound_pool_size || 32,
    maxConcurrentSounds: row.max_concurrent_sounds || 16,
    lastGeneratedAt: row.last_generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (broken.length > 0) {
    logger.error(`audio scene ${doc.id} has unreadable data in: ${broken.join(', ')}`);
    doc.name = brokenDocName(doc.name, broken);
  }
  return doc;
}

// ── CRUD ──

export function getAllAudioScenes(): AudioSceneDocument[] {
  ensureAudioSceneTable();
  const rows = getDb()
    .prepare('SELECT * FROM audio_scenes ORDER BY updated_at DESC')
    .all() as AudioSceneRow[];
  return rows.map(rowToDoc);
}

export function getAudioScene(id: number): AudioSceneDocument | null {
  ensureAudioSceneTable();
  const row = getDb()
    .prepare('SELECT * FROM audio_scenes WHERE id = ?')
    .get(id) as AudioSceneRow | undefined;
  return row ? rowToDoc(row) : null;
}

export function createAudioScene(payload: CreateAudioScenePayload): AudioSceneDocument {
  ensureAudioSceneTable();
  const db = getDb();
  const result = db
    .prepare('INSERT INTO audio_scenes (name, description) VALUES (?, ?)')
    .run(payload.name, payload.description ?? '');
  const scene = getAudioScene(result.lastInsertRowid as number);
  if (!scene) {
    throw new Error(`Failed to retrieve audio_scenes record after INSERT (rowid=${result.lastInsertRowid})`);
  }
  return scene;
}

/** Same ranges as the Settings tab fields; both are emitted verbatim as int32 by the codegen. */
export const SOUND_POOL_SIZE_RANGE = { min: 1, max: 256, fallback: 32 } as const;
export const MAX_CONCURRENT_SOUNDS_RANGE = { min: 1, max: 128, fallback: 16 } as const;

/** The server is the trust boundary: a replayed or older client can still send 2.5 or 99999. */
function clampSceneSettings(payload: UpdateAudioScenePayload): UpdateAudioScenePayload {
  const out = { ...payload };
  const p = SOUND_POOL_SIZE_RANGE;
  const c = MAX_CONCURRENT_SOUNDS_RANGE;
  if (out.soundPoolSize !== undefined) out.soundPoolSize = clampConfigInt(out.soundPoolSize, p.min, p.max, p.fallback);
  if (out.maxConcurrentSounds !== undefined) out.maxConcurrentSounds = clampConfigInt(out.maxConcurrentSounds, c.min, c.max, c.fallback);
  return out;
}

export function updateAudioScene(rawPayload: UpdateAudioScenePayload): AudioSceneDocument | null {
  const payload = clampSceneSettings(rawPayload);
  ensureAudioSceneTable();
  const db = getDb();
  const existing = getAudioScene(payload.id);
  if (!existing) return null;

  const query = buildUpdateQuery('audio_scenes', payload.id, payload, [
    { key: 'name', column: 'name' },
    { key: 'description', column: 'description' },
    { key: 'zones', column: 'zones' },
    { key: 'emitters', column: 'emitters' },
    { key: 'globalReverbPreset', column: 'global_reverb_preset' },
    { key: 'soundPoolSize', column: 'sound_pool_size' },
    { key: 'maxConcurrentSounds', column: 'max_concurrent_sounds' },
    { key: 'lastGeneratedAt', column: 'last_generated_at' },
  ], new Set(['zones', 'emitters']));

  if (!query) return existing;

  db.prepare(query.sql).run(...query.values);
  return getAudioScene(payload.id);
}

export function deleteAudioScene(id: number): boolean {
  ensureAudioSceneTable();
  const result = getDb().prepare('DELETE FROM audio_scenes WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Summary ──

/** Pass `docs` when the caller already read them, so the table is read and parsed once. */
export function getAudioSceneSummary(docs: AudioSceneDocument[] = getAllAudioScenes()): AudioSceneSummary {

  const allZones = docs.flatMap((d) => d.zones);
  const allEmitters = docs.flatMap((d) => d.emitters);

  const zonesByReverb: Record<string, number> = {};
  for (const zone of allZones) {
    zonesByReverb[zone.reverbPreset] = (zonesByReverb[zone.reverbPreset] ?? 0) + 1;
  }

  const emittersByType: Record<EmitterType, number> = {
    ambient: 0, point: 0, loop: 0, oneshot: 0, music: 0,
  };
  for (const emitter of allEmitters) {
    if (emitter.type in emittersByType) emittersByType[emitter.type]++;
  }

  return {
    totalScenes: docs.length,
    totalZones: allZones.length,
    totalEmitters: allEmitters.length,
    zonesByReverb,
    emittersByType,
  };
}
