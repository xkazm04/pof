import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

/** A body that is not a JSON object is the caller's mistake on all five library handlers. */
vi.mock('@/lib/visual-gen/library-db-conn', () => ({ getLibraryDb: () => { throw new Error('reached the database'); } }));

const library = await import('@/app/api/visual-gen/library/route');
const asset = await import('@/app/api/visual-gen/library/[id]/route');
const collections = await import('@/app/api/visual-gen/library/collections/route');
const collection = await import('@/app/api/visual-gen/library/collections/[id]/route');
const items = await import('@/app/api/visual-gen/library/collections/[id]/items/route');

const req = (body: string) => new NextRequest('http://localhost/api/visual-gen/library', { method: 'POST', body });
const ctx = { params: Promise.resolve({ id: 'x' }) };

const HANDLERS: Array<[string, (r: NextRequest) => Promise<Response>]> = [
  ['library POST', (r) => library.POST(r)],
  ['asset PATCH', (r) => asset.PATCH(r, ctx)],
  ['collections POST', (r) => collections.POST(r)],
  ['collection PATCH', (r) => collection.PATCH(r, ctx)],
  ['items POST', (r) => items.POST(r, ctx)],
];

describe('visual-gen library routes refuse a non-object body', () => {
  for (const [name, call] of HANDLERS) {
    for (const body of ['{nope', 'null', '[1]', '"str"']) {
      it(`${name} answers 400 for ${body}`, async () => {
        expect((await call(req(body))).status).toBe(400);
      });
    }
  }

  it.each([
    ['collections POST', (r: NextRequest) => collections.POST(r)],
    ['collection PATCH', (r: NextRequest) => collection.PATCH(r, ctx)],
  ])('%s answers 400 for a non-string name', async (_n, call) => {
    expect((await call(req('{"name":5}'))).status).toBe(400);
  });

  it('items POST answers 400 for a non-string assetId', async () => {
    expect((await items.POST(req('{"assetId":{"a":1}}'), ctx)).status).toBe(400);
  });
});
