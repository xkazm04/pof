import { describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';

const dbHolder = vi.hoisted(() => ({ current: null as Database.Database | null }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return {
    ...actual,
    getDb: () => {
      if (!dbHolder.current) dbHolder.current = new Database(':memory:');
      return dbHolder.current;
    },
  };
});

import { rowToTrack, upsertTrack } from '@/lib/pipeline-db';

describe('rowToTrack', () => {
  it('maps a full row', () => {
    const rec = rowToTrack({
      catalog_id: 'bestiary', entity_id: 'brute', track_id: 'art-3d',
      state: 'in-progress', note: 'mesh blockout done', updated_at: '2026-05-25T00:00:00.000Z',
    });
    expect(rec).toEqual({
      catalogId: 'bestiary', entityId: 'brute', trackId: 'art-3d',
      state: 'in-progress', note: 'mesh blockout done', updatedAt: '2026-05-25T00:00:00.000Z',
    });
  });

  it('omits null optionals', () => {
    const rec = rowToTrack({
      catalog_id: 'bestiary', entity_id: 'brute', track_id: 'logic',
      state: 'done', note: null, updated_at: null,
    });
    expect(rec.note).toBeUndefined();
    expect(rec.updatedAt).toBeUndefined();
    expect(rec.state).toBe('done');
  });
});

describe('pipeline-db table ensure across connection swap', () => {
  it('re-creates pipeline_tracks when getDb() returns a new Database instance', () => {
    dbHolder.current = new Database(':memory:');
    upsertTrack({ catalogId: 'bestiary', entityId: 'brute', trackId: 'art-3d', state: 'in-progress' });

    dbHolder.current = new Database(':memory:');
    const rec = upsertTrack({ catalogId: 'bestiary', entityId: 'brute', trackId: 'logic', state: 'done' });
    expect(rec.trackId).toBe('logic');
    expect(rec.state).toBe('done');
  });
});
