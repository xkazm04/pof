/**
 * POST /api/visual-gen/contact-sheet refuses a malformed body before the paid sheet. `cols: 0`
 * or `cols: "x"` used to fall back to 4 unannounced, an oversized grid went to the provider,
 * and an object `brief` reached the prompt as "[object Object]".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('@/lib/visual-gen/sheet-slice', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/sheet-slice')>()),
  runContactSheet: run,
}));
vi.mock('node:fs/promises', async (orig) => ({
  ...(await orig<typeof import('node:fs/promises')>()),
  mkdir: vi.fn(async () => undefined),
}));
vi.mock('@/lib/db', () => ({ getDb: () => { throw new Error('the DB must not open'); } }));

const { POST } = await import('@/app/api/visual-gen/contact-sheet/route');

const raw = (body: string) =>
  POST(new NextRequest('http://localhost/api/visual-gen/contact-sheet', { method: 'POST', body }));
const post = (body: unknown) => raw(JSON.stringify(body));
const CAST = [{ entityId: 'c', brief: 'C' }, { entityId: 'd', brief: 'D' }];
const BODY = { catalogId: 'bestiary', step: 'Concept 2D Art', cols: 2, rows: 1, cast: CAST };

beforeEach(() => {
  run.mockReset();
  run.mockResolvedValue({ ok: true, icons: [] });
});

describe('POST /api/visual-gen/contact-sheet — body shape', () => {
  it.each(['{not json', 'null', '[]'])('refuses the body %s with a 400', async (body) => {
    expect((await raw(body)).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it.each([
    ['cols', 0],
    ['cols', 'x'],
    ['rows', -2],
    ['rows', 1.5],
    ['cols', 17],
    ['style', {}],
    ['background', 3],
    ['cellSubject', []],
    ['accent', 1],
    ['providerId', 9],
    ['size', 1024],
  ])('refuses %s=%j before the sheet', async (field, value) => {
    const res = await post({ ...BODY, [field]: value });
    expect(res.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses a grid over the 16-cell ceiling', async () => {
    const res = await post({ ...BODY, cols: 5, rows: 4 });
    expect(res.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it.each([
    ['an object brief', [{ entityId: 'c', brief: { a: 1 } }]],
    ['a numeric entityId', [{ entityId: 7, brief: 'C' }]],
    ['a path-like entityId', [{ entityId: '../c', brief: 'C' }]],
  ])('refuses %s', async (_n, cast) => {
    expect((await post({ ...BODY, cols: 1, cast })).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses a path-like catalogId', async () => {
    expect((await post({ ...BODY, catalogId: '..\bestiary' })).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it('[guard] absent cols and rows still default, and a well-formed body runs', async () => {
    const { cols: _c, rows: _r, ...rest } = BODY;
    const cast = Array.from({ length: 16 }, (_, i) => ({ entityId: `e${i}`, brief: `B${i}` }));
    expect((await post({ ...rest, cast })).status).toBe(200);
    expect(run.mock.calls[0][0].spec).toMatchObject({ cols: 4, rows: 4 });
    expect((await post(BODY)).status).toBe(200);
  });
});
