import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/performance-profiling/route';

function post(body: unknown) {
  return POST(new NextRequest('http://localhost/api/performance-profiling', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  }));
}

afterEach(() => { vi.restoreAllMocks(); });

describe('performance-profiling session retention cap', () => {
  it('evicts the oldest session beyond the cap and reports it', async () => {
    const listed = await (await post({ action: 'list-sessions' })).json();
    const cap: number = listed.data.cap;
    expect(cap).toBeGreaterThan(0);

    // Sample ids embed Date.now(); a fast loop would mint duplicates, so tick a fake clock.
    let tick = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => (tick += 1));
    const ids: string[] = [];
    let lastEvicted: { id: string }[] = [];
    for (let i = 0; i < cap + 1; i++) {
      const body = await (await post({ action: 'generate-sample', scenarioType: 'menu', enemyCount: 1 })).json();
      ids.push(body.data.session.id);
      lastEvicted = body.data.evicted;
    }

    const after = await (await post({ action: 'list-sessions' })).json();
    expect(after.data.sessions.length).toBe(cap);
    expect(after.data.sessions.some((s: { id: string }) => s.id === ids[0])).toBe(false);
    expect(after.data.sessions.some((s: { id: string }) => s.id === ids[cap])).toBe(true);
    expect(lastEvicted.map((e) => e.id)).toEqual([ids[0]]);
    const gone = await post({ action: 'get-session', sessionId: ids[0] });
    expect(gone.status).toBe(404);
  });
});
