/**
 * A `?limit=` on the quality-evaluation reads is an integer >= 1 or a 400 naming it. `1.5`
 * reached `LIMIT ?` as a REAL (SQLite: datatype mismatch, so a 500), and `abc` or `-1` were
 * quietly swapped for the default window, so the caller read a different range than it asked for.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { GET as getResults } from '@/app/api/evaluator/results/route';
import { GET as getDeltas } from '@/app/api/evaluator/deltas/route';
import { GET as getHistory } from '@/app/api/experiment/history/route';
import { GET as getRuns } from '@/app/api/harness/runs/route';

const ROUTES: [string, (req: NextRequest) => Promise<Response> | Response][] = [
  ['evaluator/results', getResults],
  ['evaluator/deltas', getDeltas],
  ['experiment/history', getHistory],
  ['harness/runs', getRuns],
];

const url = (name: string, q: string) => new NextRequest(`http://localhost/api/${name}${q}`);

describe('limit is validated before it reaches SQLite', () => {
  for (const [name, handler] of ROUTES) {
    for (const bad of ['abc', '1.5', '-1', '0', '']) {
      it(`${name} refuses limit=${JSON.stringify(bad)}`, async () => {
        const res = await handler(url(name, `?limit=${bad}`));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('limit');
      });
    }

    it(`${name} still answers a valid limit and an absent one`, async () => {
      expect((await handler(url(name, '?limit=5'))).status).toBe(200);
      expect((await handler(url(name, ''))).status).toBe(200);
    });
  }
});
