/**
 * /api/project-rules drift review: GET ?view=drift reports shipped-vs-DB disagreements;
 * POST ?action=adopt-shipped | keep-mine | undo-adopt acts on them, behind requireOperator.
 * Adopt is REVERSIBLE: the replaced row is archived first and undo-adopt restores it byte-for-byte.
 * Throwaway DBs via `POF_DB_PATH`; the user's `~/.pof/pof.db` is never opened.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

const TMP = process.env.TEMP || process.env.TMPDIR || '/tmp';

function newDbFile(tag: string): string {
  const file = path.join(TMP, `pof-test-canon-drift-route-${process.pid}-${tag}.db`);
  for (const s of ['', '-wal', '-shm']) if (fs.existsSync(file + s)) fs.rmSync(file + s);
  return file;
}

const rule = (id: string, body: string) => ({ id, category: 'game' as const, scope: 'global', title: `T ${id}`, body, refs: ['ref-a'], profile: 'diablo1' });

async function load(file: string, seed: ReturnType<typeof rule>[]) {
  process.env.POF_DB_PATH = file;
  vi.resetModules();
  vi.doMock('@/lib/catalog/canon/profiles/diablo1', () => ({ DIABLO1_CANON: seed, DIABLO1_INHERITS_POF: [] }));
  const route = await import('@/app/api/project-rules/route');
  const db = await import('@/lib/db');
  const sync = await import('@/lib/catalog/canon/canonSync');
  await route.GET(); // first read seeds the table
  return { route, db, sync, raw: db.getDb() };
}

type Finding = { id: string; verdict: string };
async function driftIds(route: Awaited<ReturnType<typeof load>>['route']): Promise<Finding[]> {
  const res = await route.GET(new NextRequest('http://localhost/api/project-rules?view=drift'));
  const data = (await res.json()).data as { byProfile: Record<string, Record<string, Finding[]>> };
  return Object.values(data.byProfile).flatMap((byVerdict) => Object.values(byVerdict).flat());
}

function post(route: Awaited<ReturnType<typeof load>>['route'], action: string, ids: string[], headers: Record<string, string> = {}) {
  return route.POST(new NextRequest(`http://localhost/api/project-rules?action=${action}`, {
    method: 'POST', body: JSON.stringify({ ids }), headers: { 'Content-Type': 'application/json', ...headers },
  }));
}

const rowOf = (raw: Awaited<ReturnType<typeof load>>['raw'], id: string) => raw.prepare('SELECT * FROM project_rules WHERE id = ?').get(id) as Record<string, unknown>;
/** Make a row look like the real DB's: an older shipped text with no recorded offer. */
const makeLegacy = (raw: Awaited<ReturnType<typeof load>>['raw'], id: string, body: string) =>
  raw.prepare("UPDATE project_rules SET body = ?, title = 'old title', refs = '[]', shipped_hash = NULL, updated_at = '2026-09-26 23:13:33' WHERE id = ?").run(body, id);

afterEach(() => { vi.doUnmock('@/lib/catalog/canon/profiles/diablo1'); });

describe('adopt-shipped', () => {
  it('writes the shipped rule and stamps its hash; drift then omits it; a cross-site POST is refused', async () => {
    const shippedX = rule('d1-x', 'shipped x');
    const { route, sync, raw, db } = await load(newDbFile('adopt'), [shippedX, rule('d1-z', 'z')]);
    makeLegacy(raw, 'd1-x', 'old x');
    makeLegacy(raw, 'd1-z', 'old z');
    expect((await driftIds(route)).map((f) => `${f.id}:${f.verdict}`).sort()).toEqual(['d1-x:unrecorded', 'd1-z:unrecorded']);

    const denied = await post(route, 'adopt-shipped', ['d1-z'], { origin: 'https://evil.example' });
    expect(denied.status).toBe(403);
    expect(rowOf(raw, 'd1-z').body).toBe('old z');

    const res = await post(route, 'adopt-shipped', ['d1-x']);
    expect(res.status).toBe(200);
    const x = rowOf(raw, 'd1-x');
    expect({ body: x.body, title: x.title, scope: x.scope, refs: JSON.parse(x.refs as string) })
      .toEqual({ body: shippedX.body, title: shippedX.title, scope: shippedX.scope, refs: shippedX.refs });
    expect(x.shipped_hash).toBe(sync.canonTextHash(shippedX));
    expect((await driftIds(route)).map((f) => f.id)).toEqual(['d1-z']);
    db.getDb().close();
  });
});

describe('keep-mine', () => {
  it('keeps the text, leaves the review, and asks again (conflict) once the shipped text moves again', async () => {
    const file = newDbFile('keep');
    const first = await load(file, [rule('d1-y', 'v1')]);
    makeLegacy(first.raw, 'd1-y', 'my y');
    const res = await post(first.route, 'keep-mine', ['d1-y']);
    expect(res.status).toBe(200);
    expect(rowOf(first.raw, 'd1-y').body).toBe('my y');
    expect(await driftIds(first.route)).toEqual([]);
    first.db.getDb().close();

    const second = await load(file, [rule('d1-y', 'v2')]);
    expect(rowOf(second.raw, 'd1-y').body).toBe('my y'); // never auto-written
    expect((await driftIds(second.route)).map((f) => `${f.id}:${f.verdict}`)).toEqual(['d1-y:conflict']);
    second.db.getDb().close();
  });
});

describe('undo-adopt (adopt is reversible)', () => {
  it('restores the row byte-identical to its pre-adopt state and it is unrecorded again', async () => {
    const { route, raw, db } = await load(newDbFile('undo'), [rule('d1-x', 'shipped x')]);
    makeLegacy(raw, 'd1-x', 'a deliberate operator law');
    const pre = { ...rowOf(raw, 'd1-x') };

    expect((await post(route, 'adopt-shipped', ['d1-x'])).status).toBe(200);
    expect(rowOf(raw, 'd1-x').body).toBe('shipped x');
    expect((await post(route, 'undo-adopt', ['d1-x'], { origin: 'https://evil.example' })).status).toBe(403);

    expect((await post(route, 'undo-adopt', ['d1-x'])).status).toBe(200);
    expect(rowOf(raw, 'd1-x')).toEqual(pre);
    expect((await driftIds(route)).map((f) => `${f.id}:${f.verdict}`)).toEqual(['d1-x:unrecorded']);
    db.getDb().close();
  });
});
