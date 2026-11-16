import { describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createAudioAssetDb, getUsageSummary } from '@/lib/audio-asset-db';

/** The usage meter reads the window and the all-time totals in ONE pass over audio_gen_usage. */

function seeded() {
  const db = new Database(':memory:');
  createAudioAssetDb(db);
  const ins = db.prepare(`INSERT INTO audio_gen_usage (id, provider, kind, promptHash, cached, durationMs, createdAt) VALUES (?, 'p', 'sfx', 'h', ?, 0, ?)`);
  // before the window: 2 generated, 1 cached; inside: 3 generated, 2 cached
  [[0, 10], [0, 20], [1, 30], [0, 200], [0, 210], [0, 220], [1, 230], [1, 240]]
    .forEach(([cached, at], i) => ins.run(`u${i}`, cached, at));
  return db;
}

describe('getUsageSummary', () => {
  it('counts the window and all-time totals correctly', () => {
    expect(getUsageSummary(seeded(), 100, 50)).toEqual({
      generated: 3, cached: 2, quota: 50, windowStart: 100, totalGenerated: 5, totalCached: 3,
    });
  });

  it('is zero (not null) on an empty table', () => {
    const db = new Database(':memory:');
    createAudioAssetDb(db);
    expect(getUsageSummary(db, 0, 10)).toMatchObject({ generated: 0, cached: 0, totalGenerated: 0, totalCached: 0 });
  });

  it('issues one statement against audio_gen_usage', () => {
    const db = seeded();
    const prepare = vi.spyOn(db, 'prepare');
    getUsageSummary(db, 100, 50);
    expect(prepare.mock.calls.filter(([sql]) => /FROM audio_gen_usage/.test(String(sql)))).toHaveLength(1);
  });
});
