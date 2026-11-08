import { describe, it, expect, vi, afterEach } from 'vitest';

// Own throwaway DB: the test inserts deliberately damaged rows.
vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-vitest/audio-scene-corrupt-blob-${process.pid}/pof.db`;
});
import { NextRequest } from 'next/server';
import { cleanup } from '@testing-library/react';
import { getDb } from '@/lib/db';
import { createAudioScene, ensureAudioSceneTable } from '@/lib/audio-scene-db';
import { GET } from '@/app/api/audio-scene/route';

/**
 * One damaged audio_scenes row (a truncated write, or a non-array blob written before the
 * route guard) used to throw out of rowToDoc / the summary and 500 the whole list GET.
 * Twin of level-design-db's parseBlob: unreadable blobs read as [] and the doc is flagged.
 */

afterEach(cleanup);

function insertRaw(name: string, zones: string, emitters: string): number {
  ensureAudioSceneTable();
  const r = getDb()
    .prepare('INSERT INTO audio_scenes (name, zones, emitters) VALUES (?, ?, ?)')
    .run(name, zones, emitters);
  return Number(r.lastInsertRowid);
}

describe('GET /api/audio-scene with a damaged row', () => {
  it.each([
    ['emitters is JSON null', '[]', 'null'],
    ['zones is truncated JSON', '{', '[]'],
    ['emitters is an object', '[]', '{"a":1}'],
  ])('list stays 200 and flags the bad scene when %s', async (_label, zones, emitters) => {
    const goodName = `good-${process.pid}-${_label}`;
    createAudioScene({ name: goodName });
    const badId = insertRaw(`bad-${_label}`, zones, emitters);

    const res = await GET(new NextRequest('http://localhost/api/audio-scene'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const names = body.data.docs.map((d: { name: string }) => d.name);
    expect(names).toContain(goodName);
    const bad = body.data.docs.find((d: { id: number }) => d.id === badId);
    expect(bad.name).toContain('UNREADABLE');
    expect(Array.isArray(bad.zones)).toBe(true);
    expect(Array.isArray(bad.emitters)).toBe(true);

    const one = await GET(new NextRequest(`http://localhost/api/audio-scene?id=${badId}`));
    expect(one.status).toBe(200);
  });
});
