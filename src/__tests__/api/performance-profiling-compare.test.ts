/**
 * POST /api/performance-profiling — the 'compare' action and the enriched
 * list-sessions rows. Sessions live in the route's module-level Maps, so every
 * case in this file shares one process-lifetime store (as the dev server does).
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/performance-profiling/route';

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/performance-profiling', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

interface Row { id: string; hasTriage: boolean; overallScore: number | null }
interface Data {
  session: { id: string };
  sessions: Row[];
  base: { id: string };
  head: { id: string };
  metrics: Array<{ key: string }>;
  findings: unknown;
}

async function call(body: unknown): Promise<{ status: number; json: { success: boolean; data: Data; error?: string } }> {
  const res = await POST(post(body));
  return { status: res.status, json: await res.json() };
}

const CSV_SLOW = 'Name,Group,Inclusive,Exclusive,Calls\nSTAT_GameThread,GameThread,24,24,1\nSTAT_RenderThread,RenderThread,9,9,1\nSTAT_GPU,GPU,11,11,1';
const CSV_FAST = 'Name,Group,Inclusive,Exclusive,Calls\nSTAT_GameThread,GameThread,9,9,1\nSTAT_RenderThread,RenderThread,7,7,1\nSTAT_GPU,GPU,8,8,1';

async function importCsv(csvContent: string, sessionName: string): Promise<string> {
  const r = await call({ action: 'import-csv', csvContent, sessionName });
  expect(r.status).toBe(200);
  return r.json.data.session.id;
}

describe('POST /api/performance-profiling — compare + list-sessions', () => {
  let beforeId = '';
  let afterId = '';

  it('list-sessions after two imports: newest first, overallScore null while untriaged', async () => {
    beforeId = await importCsv(CSV_SLOW, 'before-fix');
    afterId = await importCsv(CSV_FAST, 'after-fix');
    const r = await call({ action: 'list-sessions' });
    expect(r.status).toBe(200);
    const rows = r.json.data.sessions;
    const ids = rows.map((s) => s.id);
    expect(ids.indexOf(afterId)).toBeLessThan(ids.indexOf(beforeId));
    for (const id of [beforeId, afterId]) {
      const row = rows.find((s) => s.id === id)!;
      expect(row.hasTriage).toBe(false);
      expect(row.overallScore).toBeNull();
    }
  });

  it('compare triages the untriaged sides first and returns base/head/metrics/findings', async () => {
    const r = await call({ action: 'compare', baseId: beforeId, headId: afterId });
    expect(r.status).toBe(200);
    const d = r.json.data;
    expect(d.base.id).toBe(beforeId);
    expect(d.head.id).toBe(afterId);
    expect(Array.isArray(d.metrics)).toBe(true);
    expect(d.metrics.find((m) => m.key === 'avgFrameMs')).toBeTruthy();
    expect(d.findings).toMatchObject({ resolved: expect.any(Array), introduced: expect.any(Array), persisting: expect.any(Array) });

    const list = await call({ action: 'list-sessions' });
    const rows = list.json.data.sessions;
    for (const id of [beforeId, afterId]) {
      const row = rows.find((s) => s.id === id)!;
      expect(row.hasTriage).toBe(true);
      expect(typeof row.overallScore).toBe('number');
    }
  });

  it('unknown id -> 404 naming the id', async () => {
    const r = await call({ action: 'compare', baseId: beforeId, headId: 'no-such-session' });
    expect(r.status).toBe(404);
    expect(r.json.error).toContain('no-such-session');
  });

  it('baseId === headId -> 400', async () => {
    const r = await call({ action: 'compare', baseId: beforeId, headId: beforeId });
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/must differ/i);
  });
});
