import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import Database from 'better-sqlite3';
import { createAssetLibraryDb } from '@/lib/visual-gen/asset-library-db';

let db: Database.Database;
vi.mock('@/lib/visual-gen/library-db-conn', () => ({ getLibraryDb: () => db }));

const { GET, POST } = await import('@/app/api/visual-gen/library/route');

const VALID = { assetId: 'a1', name: 'Rock', source: 'polyhaven', category: 'models' };
const get = (qs: string) => GET(new NextRequest(`http://localhost/api/visual-gen/library?${qs}`));
const post = (body: unknown) => POST(new NextRequest('http://localhost/api/visual-gen/library', { method: 'POST', body: JSON.stringify(body) }));
const rows = () => (db.prepare('SELECT COUNT(*) AS n FROM asset_library').get() as { n: number }).n;

beforeEach(() => {
  db = new Database(':memory:');
  createAssetLibraryDb(db);
});

describe('GET /api/visual-gen/library filters', () => {
  it.each(['source=sketchfab', 'category=meshes'])('refuses %s instead of answering an empty list', async (qs) => {
    expect((await get(qs)).status).toBe(400);
  });

  it.each(['', 'source=all', 'category=all', 'source=ambientcg&category=hdris'])('accepts "%s"', async (qs) => {
    expect((await get(qs)).status).toBe(200);
  });
});

describe('POST /api/visual-gen/library fields', () => {
  it.each([
    ['unknown source', { source: 'sketchfab' }],
    ['unknown category', { category: 'meshes' }],
    ['"all" as a source', { source: 'all' }],
    ['non-string assetId', { assetId: 5 }],
    ['non-string name', { name: ['Rock'] }],
    ['non-string license', { license: 5 }],
    ['non-string thumbnailUrl', { thumbnailUrl: {} }],
    ['non-string downloadUrl', { downloadUrl: 5 }],
    ['tags that are not an array', { tags: 'rock' }],
    ['tags that are not strings', { tags: [1] }],
  ])('refuses %s and stores nothing', async (_label, extra) => {
    expect((await post({ ...VALID, ...extra })).status).toBe(400);
    expect(rows()).toBe(0);
  });

  it('records a valid asset', async () => {
    const res = await post({ ...VALID, tags: ['rock'], license: 'CC0' });
    expect(res.status).toBe(201);
    expect((await res.json()).data.tags).toEqual(['rock']);
  });
});
