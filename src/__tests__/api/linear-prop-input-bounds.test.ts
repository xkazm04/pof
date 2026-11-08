import { describe, it, expect, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '@/app/api/visual-gen/linear-prop/route';

/** The tube is built in memory before anything can refuse it, so its size is checked first. */
const outDir = mkdtempSync(join(tmpdir(), 'pof-linear-bounds-'));
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

const ANCHORS = { from: { x: 0, y: 3, z: 0 }, to: { x: 6, y: 3, z: 0 }, outDir };
const post = (body: string) => POST(new NextRequest('http://localhost/api/visual-gen/linear-prop', { method: 'POST', body }));
const send = (extra: Record<string, unknown>) => post(JSON.stringify({ ...ANCHORS, ...extra }));

describe('POST /api/visual-gen/linear-prop input bounds', () => {
  it('answers 400 for malformed or non-object JSON', async () => {
    expect((await post('{nope')).status).toBe(400);
    expect((await post('[1]')).status).toBe(400);
  });

  it.each([
    ['segments over the cap', { segments: 2000, sides: 3 }],
    ['sides over the cap', { segments: 1, sides: 1000 }],
    ['fractional segments', { segments: 1.5 }],
    ['fractional sides', { sides: 3.5 }],
    ['string segments', { segments: '8' }],
    ['string slack', { slack: 'loose' }],
    ['string radius', { radius: 'thin' }],
    ['non-string name', { name: 5 }],
    ['non-string outDir', { outDir: 5 }],
  ])('refuses %s and writes nothing', async (_label, extra) => {
    const before = readdirSync(outDir).length;
    expect((await send(extra)).status).toBe(400);
    expect(readdirSync(outDir).length).toBe(before);
  });

  it('refuses an overflowed slack literal', async () => {
    const body = `${JSON.stringify(ANCHORS).slice(0, -1)},"slack":1e999}`;
    expect((await post(body)).status).toBe(400);
  });

  it('still computes at the caps', async () => {
    expect((await send({ segments: 1024, sides: 3 })).status).toBe(200);
    expect((await send({ segments: 1, sides: 64 })).status).toBe(200);
  });

  it('leaves the low-end refusal to the generator that measures it', async () => {
    const res = await send({ sides: 2 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/3 sides/);
  });
});
