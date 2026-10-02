/**
 * POST /api/project-rules refuses a law whose scope reaches no prompt (scan-sweep --challenge
 * catalog-seed-data/B). This file imports ONLY the route — never the pipeline registry — so a
 * route that forgets to populate the registry through its own import graph would refuse every
 * catalog scope, and the 'currencies' case catches it.
 * Throwaway DB per file (`fs.mkdtempSync`); the user's `~/.pof/pof.db` is never opened.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

let dir = '';
let route: typeof import('@/app/api/project-rules/route');

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-test-rules-scope-'));
  process.env.POF_DB_PATH = path.join(dir, 'pof.db');
  vi.resetModules();
  route = await import('@/app/api/project-rules/route');
}, 60_000);

afterAll(async () => {
  // Cleanup only (after every case ran): release the WAL handles so the temp dir can go.
  try { (await import('@/lib/db')).getDb().close(); } catch { /* already closed */ }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* WAL handles may still be open on Windows */ }
});

const post = (body: unknown) => route.POST(new NextRequest('http://localhost/api/project-rules', {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
}));
const rows = async () => ((await (await route.GET()).json()).data as { id: string; scope: string; title: string }[]);
const law = (id: string, scope: string) => ({ id, category: 'game' as const, scope, title: `Law ${id}`, body: `Body of ${id}` });

describe('POST /api/project-rules scope', () => {
  it('refuses an unknown scope with 400 "Unknown scope" and stores nothing', async () => {
    const res = await post(law('typo-law', 'bestiarys'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/Unknown scope/);
    expect(json.error).toContain('bestiarys');
    expect((await rows()).some((r) => r.id === 'typo-law')).toBe(false);
  });

  it('[guard] accepts a global law and upserts the row as before', async () => {
    const res = await post(law('global-law', 'global'));
    expect(res.status).toBe(200);
    expect((await rows()).find((r) => r.id === 'global-law')).toMatchObject({ scope: 'global', title: 'Law global-law' });
  });

  it('accepts a registered catalog scope (the route populates the registry itself)', async () => {
    const res = await post(law('currency-law', 'currencies'));
    expect(res.status).toBe(200);
    expect((await rows()).find((r) => r.id === 'currency-law')).toMatchObject({ scope: 'currencies', title: 'Law currency-law' });
  });
});
