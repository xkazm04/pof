/**
 * POST /api/visual-gen/linear-prop — the endpoint the shape refusal points at.
 *
 * A refusal that names no alternative is just a wall, so these tests pin that the
 * alternative actually produces an asset: real OBJ bytes on disk, at the anchors the
 * caller gave, with the length that implies. Real files, no mocked `fs` — the whole
 * claim is that something was written.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '@/app/api/visual-gen/linear-prop/route';

const outDir = mkdtempSync(join(tmpdir(), 'pof-linear-prop-'));
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

const post = (body: unknown) =>
  new NextRequest('http://localhost/api/visual-gen/linear-prop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/visual-gen/linear-prop', () => {
  it('computes a rope between two anchors and writes it', async () => {
    const res = await POST(
      post({ from: { x: 0, y: 3, z: 0 }, to: { x: 6, y: 3, z: 0 }, name: 'pier-rope', outDir }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(existsSync(body.data.objPath)).toBe(true);

    const obj = readFileSync(body.data.objPath, 'utf8');
    expect(obj).toContain('v ');
    expect(obj).toContain('f ');
    // The asset spans its anchors: a 6 m chord with slack is longer than 6 m, and nothing
    // like the ~1 m box a generator returns.
    expect(body.data.lengthM).toBeGreaterThan(6);
    expect(body.data.lengthM).toBeLessThan(8);
    expect(body.data.triangles).toBeGreaterThan(0);
    // No credit was spent, and the response says so rather than leaving it implied.
    expect(body.data.cost).toMatch(/no .*credit|free|\$0/i);
  });

  it('honours the anchors exactly — the property a generated mesh cannot offer', async () => {
    const from = { x: -1.5, y: 4, z: 2 };
    const to = { x: 3.5, y: 4, z: 2 };
    const res = await POST(post({ from, to, slack: 0, name: 'taut', outDir }));
    const { data } = await res.json();

    const verts = readFileSync(data.objPath, 'utf8')
      .split('\n')
      .filter((l) => l.startsWith('v '))
      .map((l) => l.slice(2).split(' ').map(Number));
    const xs = verts.map((v) => v[0]);
    // With zero slack the tube spans exactly the chord, plus its own radius at the caps.
    expect(Math.min(...xs)).toBeCloseTo(from.x, 1);
    expect(Math.max(...xs)).toBeCloseTo(to.x, 1);
  });

  it('requires both anchors — they are the asset, and cannot be defaulted', async () => {
    const res = await POST(post({ to: { x: 1, y: 0, z: 0 } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/from|anchor/i);
  });

  it('rejects anchors that are the same point with the generator\'s own reason', async () => {
    const res = await POST(post({ from: { x: 1, y: 1, z: 1 }, to: { x: 1, y: 1, z: 1 } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('same point');
  });

  it('rejects a non-numeric anchor rather than writing NaN geometry', async () => {
    const res = await POST(post({ from: { x: 0, y: 'high', z: 0 }, to: { x: 1, y: 0, z: 0 } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/number|finite/i);
  });
});
