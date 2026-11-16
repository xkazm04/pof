import { describe, it, expect, vi } from 'vitest';

// Own throwaway DB: on the unfixed route the PUT cases WROTE their non-array zones into
// scene 1, so a red run must not leave that row in a DB another suite reads.
vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-vitest/audio-scene-request-shape-${process.pid}/pof.db`;
});
import { NextRequest } from 'next/server';
import { POST, PUT } from '@/app/api/audio-scene/route';

/**
 * POST/PUT /api/audio-scene read `req.json()` unguarded (a malformed body was a 500) and
 * PUT forwarded non-array `zones` / `emitters` into the row, which later broke
 * generateAudioCode and the list summary (`docs.flatMap(d => d.zones)`).
 * House shape: malformed or non-object JSON -> 400, and a non-array zones/emitters -> 400,
 * all refused before the database is touched.
 */

function req(method: 'POST' | 'PUT', raw: string): NextRequest {
  return new NextRequest('http://localhost/api/audio-scene', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: raw,
  });
}

describe('POST /api/audio-scene request shape', () => {
  it('refuses malformed JSON with 400', async () => {
    const res = await POST(req('POST', '{"name":'));
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
  });

  it.each(['null', '[]', '"scene"', '7'])('refuses non-object JSON %s with 400', async (raw) => {
    const res = await POST(req('POST', raw));
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/audio-scene request shape', () => {
  it('refuses malformed JSON with 400', async () => {
    const res = await PUT(req('PUT', '{"id":1,'));
    expect(res.status).toBe(400);
  });

  it.each(['null', '[]', '"scene"'])('refuses non-object JSON %s with 400', async (raw) => {
    const res = await PUT(req('PUT', raw));
    expect(res.status).toBe(400);
  });

  it.each([
    ['zones', { zones: { a: 1 } }],
    ['zones', { zones: 'reverb' }],
    ['emitters', { emitters: 3 }],
    ['emitters', { emitters: null }],
  ])('refuses a non-array %s with 400 and names the field', async (field, patch) => {
    const res = await PUT(req('PUT', JSON.stringify({ id: 1, ...patch })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(field);
  });

  it.each([
    ['soundPoolSize', { soundPoolSize: 'lots' }],
    ['soundPoolSize', { soundPoolSize: 2.5 }],
    ['maxConcurrentSounds', { maxConcurrentSounds: -1 }],
    ['maxConcurrentSounds', { maxConcurrentSounds: 0 }],
    ['globalReverbPreset', { globalReverbPreset: 42 }],
    ['globalReverbPreset', { globalReverbPreset: 'echo-chamber' }],
    ['name', { name: {} }],
    ['name', { name: '' }],
  ])('refuses a bad %s with 400 and names the field', async (field, patch) => {
    const res = await PUT(req('PUT', JSON.stringify({ id: 1, ...patch })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(field);
  });

  it('accepts valid scalar fields', async () => {
    const created = await POST(req('POST', JSON.stringify({ name: 'scalars-ok' })));
    const { doc } = (await created.json()).data;
    const res = await PUT(req('PUT', JSON.stringify({
      id: doc.id, name: 'scalars-ok-2', globalReverbPreset: 'cave', soundPoolSize: 64, maxConcurrentSounds: 8,
    })));
    expect(res.status).toBe(200);
    const updated = (await res.json()).data.doc;
    expect(updated.globalReverbPreset).toBe('cave');
    expect(updated.soundPoolSize).toBe(64);
  });
});
