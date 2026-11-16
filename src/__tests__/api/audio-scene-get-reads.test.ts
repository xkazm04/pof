import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { createAudioScene, getAudioSceneSummary, getAllAudioScenes } from '@/lib/audio-scene-db';
import { GET } from '@/app/api/audio-scene/route';

/**
 * The list GET returns `docs` and a `summary` derived from them. It used to read
 * and JSON-parse the whole table twice (getAllAudioScenes, then again inside
 * getAudioSceneSummary). One read is enough; the summary is derived from it.
 */

afterEach(() => vi.restoreAllMocks());

describe('GET /api/audio-scene', () => {
  it('reads the audio_scenes table once per list request', async () => {
    createAudioScene({ name: `reads-${Date.now()}` });
    const db = getDb();
    const prepare = vi.spyOn(db, 'prepare');
    const res = await GET(new NextRequest('http://localhost/api/audio-scene'));
    const body = await res.json();
    expect(body.success).toBe(true);
    const fullReads = prepare.mock.calls.filter(([sql]) => /SELECT \* FROM audio_scenes ORDER BY/.test(String(sql)));
    expect(fullReads).toHaveLength(1);
    expect(body.data.summary.totalScenes).toBe(body.data.docs.length);
  });

  it('a summary built from passed docs equals the self-loading summary', () => {
    expect(getAudioSceneSummary(getAllAudioScenes())).toEqual(getAudioSceneSummary());
  });
});
