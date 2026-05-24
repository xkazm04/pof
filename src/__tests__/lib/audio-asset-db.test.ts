import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  createAudioAssetDb,
  upsertSet,
  listSets,
  getSet,
  addAsset,
  listAssets,
  deleteAsset,
  deleteSet,
} from '@/lib/audio-asset-db';

let db: Database.Database;
beforeEach(() => {
  db = new Database(':memory:');
  createAudioAssetDb(db);
});

describe('audio-asset-db', () => {
  it('upserts a set and lists it', () => {
    const set = upsertSet(db, { name: 'footstep-stone', kind: 'sfx', eventKey: 'footstep', surface: 'stone', loopable: false });
    expect(set.id).toBeTruthy();
    const sets = listSets(db);
    expect(sets).toHaveLength(1);
    expect(sets[0].name).toBe('footstep-stone');
  });

  it('upsert by id replaces metadata', () => {
    const a = upsertSet(db, { name: 'fs', kind: 'sfx', loopable: false });
    const b = upsertSet(db, { id: a.id, name: 'fs', kind: 'sfx', eventKey: 'footstep', surface: 'wood', loopable: false });
    expect(b.id).toBe(a.id);
    expect(getSet(db, a.id)?.surface).toBe('wood');
  });

  it('adds + lists + deletes assets scoped to a set', () => {
    const s = upsertSet(db, { name: 'fs', kind: 'sfx', loopable: false });
    const a = addAsset(db, { setId: s.id, filename: 'v1.mp3', relPath: `${s.id}/v1.mp3`, prompt: 'p', provider: 'elevenlabs', durationMs: 1500, format: 'mp3' });
    addAsset(db, { setId: s.id, filename: 'v2.mp3', relPath: `${s.id}/v2.mp3`, prompt: 'p', provider: 'elevenlabs', durationMs: 1500, format: 'mp3' });
    expect(listAssets(db, s.id)).toHaveLength(2);
    deleteAsset(db, a.id);
    expect(listAssets(db, s.id)).toHaveLength(1);
  });

  it('deleting a set cascades its assets', () => {
    const s = upsertSet(db, { name: 'fs', kind: 'sfx', loopable: false });
    addAsset(db, { setId: s.id, filename: 'v1.mp3', relPath: `${s.id}/v1.mp3`, prompt: 'p', provider: 'elevenlabs', durationMs: 1500, format: 'mp3' });
    deleteSet(db, s.id);
    expect(listSets(db)).toHaveLength(0);
    expect(listAssets(db, s.id)).toHaveLength(0);
  });
});
