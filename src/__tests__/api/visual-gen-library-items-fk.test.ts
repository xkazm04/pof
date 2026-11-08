import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import Database from 'better-sqlite3';
import { createAssetLibraryDb, createCollection, recordAsset } from '@/lib/visual-gen/asset-library-db';

let db: Database.Database;
vi.mock('@/lib/visual-gen/library-db-conn', () => ({ getLibraryDb: () => db }));

const { POST } = await import('@/app/api/visual-gen/library/collections/[id]/items/route');

const add = async (collectionId: string, assetId: string) => {
  const res = await POST(
    new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ assetId }) }),
    { params: Promise.resolve({ id: collectionId }) },
  );
  return { status: res.status, json: await res.json() };
};

let assetId: string;
let collectionId: string;
beforeEach(() => {
  db = new Database(':memory:');
  createAssetLibraryDb(db);
  assetId = recordAsset(db, { assetId: 'a', name: 'A', source: 'polyhaven', category: 'models', license: '', thumbnailUrl: '', downloadUrl: '' }).id;
  collectionId = createCollection(db, 'C').id;
});

describe('POST collections/:id/items names what is missing', () => {
  it('answers 404 for an unknown asset', async () => {
    const { status, json } = await add(collectionId, 'ghost');
    expect(status).toBe(404);
    expect(json.error).toMatch(/Asset not found/);
  });

  it('answers 404 for an unknown collection', async () => {
    const { status, json } = await add('ghost', assetId);
    expect(status).toBe(404);
    expect(json.error).toMatch(/Collection not found/);
  });

  it('adds, then reports a repeat as a no-op', async () => {
    expect((await add(collectionId, assetId)).json.data.added).toBe(true);
    expect((await add(collectionId, assetId)).json.data.added).toBe(false);
  });
});
