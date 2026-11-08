import { describe, it, expect, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '@/app/api/visual-gen/linear-prop/route';

/** `outDir` is a caller-chosen disk location, so this route takes the operator guard. */
const outDir = mkdtempSync(join(tmpdir(), 'pof-linear-guard-'));
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

const BODY = JSON.stringify({ from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 0, z: 0 }, outDir });
const post = (headers: Record<string, string>) =>
  POST(new NextRequest('http://localhost:3001/api/visual-gen/linear-prop', { method: 'POST', headers, body: BODY }));

describe('POST /api/visual-gen/linear-prop operator guard', () => {
  it('refuses a cross-site browser request and writes nothing', async () => {
    const res = await post({ origin: 'https://evil.example', host: 'localhost:3001' });
    expect(res.status).toBe(403);
    expect(readdirSync(outDir)).toEqual([]);
  });

  it('still serves a same-origin or header-less caller', async () => {
    expect((await post({ origin: 'http://localhost:3001', host: 'localhost:3001' })).status).toBe(200);
    expect((await post({})).status).toBe(200);
  });
});
