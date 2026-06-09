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
  setAssetFavorite,
  findAssetByPromptHash,
  logUsage,
  getUsageSummary,
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

  it('new assets default to not-favorite and toggle persists', () => {
    const s = upsertSet(db, { name: 'fs', kind: 'sfx', loopable: false });
    const a = addAsset(db, { setId: s.id, filename: 'v1.mp3', relPath: `${s.id}/v1.mp3`, prompt: 'p', provider: 'elevenlabs', durationMs: 1500, format: 'mp3' });
    expect(a.favorite).toBe(false);
    const starred = setAssetFavorite(db, a.id, true);
    expect(starred?.favorite).toBe(true);
    expect(listAssets(db, s.id)[0].favorite).toBe(true);
    expect(setAssetFavorite(db, a.id, false)?.favorite).toBe(false);
    expect(setAssetFavorite(db, 'missing', true)).toBeNull();
  });

  it('finds an asset by prompt hash (content-hash cache), newest first', () => {
    const s = upsertSet(db, { name: 'fs', kind: 'sfx', loopable: false });
    expect(findAssetByPromptHash(db, 'h1')).toBeNull();
    addAsset(db, { setId: s.id, filename: 'a.mp3', relPath: `${s.id}/a.mp3`, prompt: 'p', provider: 'elevenlabs', durationMs: 1000, format: 'mp3', promptHash: 'h1' });
    const second = addAsset(db, { setId: s.id, filename: 'b.mp3', relPath: `${s.id}/b.mp3`, prompt: 'p', provider: 'elevenlabs', durationMs: 1000, format: 'mp3', promptHash: 'h1' });
    const hit = findAssetByPromptHash(db, 'h1');
    expect(hit?.id).toBe(second.id);
    expect(hit?.promptHash).toBe('h1');
  });

  it('summarises usage with billed vs cached and all-time totals', () => {
    logUsage(db, { provider: 'elevenlabs', kind: 'sfx', promptHash: 'h1', cached: false, durationMs: 1000 });
    logUsage(db, { provider: 'elevenlabs', kind: 'sfx', promptHash: 'h1', cached: true, durationMs: 1000 });
    logUsage(db, { provider: 'elevenlabs', kind: 'sfx', promptHash: 'h2', cached: false, durationMs: 1000 });
    const summary = getUsageSummary(db, 0, 50);
    expect(summary.generated).toBe(2);
    expect(summary.cached).toBe(1);
    expect(summary.quota).toBe(50);
    expect(summary.totalGenerated).toBe(2);
    expect(summary.totalCached).toBe(1);
    // A window in the future excludes everything but keeps all-time totals.
    const future = getUsageSummary(db, Date.now() + 1_000_000);
    expect(future.generated).toBe(0);
    expect(future.totalGenerated).toBe(2);
  });
});
