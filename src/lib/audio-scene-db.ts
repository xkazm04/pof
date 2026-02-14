import { getDb } from './db';
import { buildUpdateQuery } from './db-utils';
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

// ── Helpers ──

function rowToDoc(row: Record<string, unknown>): AudioSceneDocument {
  return {
    id: row.id as number,
    name: row.name as string,
    description: row.description as string,
    zones: JSON.parse((row.zones as string) || '[]'),
    emitters: JSON.parse((row.emitters as string) || '[]'),
    globalReverbPreset: (row.global_reverb_preset as AudioSceneDocument['globalReverbPreset']) || 'none',
    soundPoolSize: (row.sound_pool_size as number) || 32,
    maxConcurrentSounds: (row.max_concurrent_sounds as number) || 16,
    lastGeneratedAt: row.last_generated_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── CRUD ──

export function getAllAudioScenes(): AudioSceneDocument[] {
  ensureAudioSceneTable();
  const rows = getDb()
    .prepare('SELECT * FROM audio_scenes ORDER BY updated_at DESC')
    .all() as Record<string, unknown>[];
  return rows.map(rowToDoc);
}

export function getAudioScene(id: number): AudioSceneDocument | null {
  ensureAudioSceneTable();
  const row = getDb()
    .prepare('SELECT * FROM audio_scenes WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToDoc(row) : null;
}

export function createAudioScene(payload: CreateAudioScenePayload): AudioSceneDocument {
  ensureAudioSceneTable();
  const db = getDb();
  const result = db
    .prepare('INSERT INTO audio_scenes (name, description) VALUES (?, ?)')
    .run(payload.name, payload.description ?? '');
  return getAudioScene(result.lastInsertRowid as number)!;
}

export function updateAudioScene(payload: UpdateAudioScenePayload): AudioSceneDocument | null {
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

export function getAudioSceneSummary(): AudioSceneSummary {
  const docs = getAllAudioScenes();

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
