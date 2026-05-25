import { describe, it, expect } from 'vitest';
import { rowToTrack } from '@/lib/pipeline-db';

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
