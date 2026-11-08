/**
 * POST /api/economy-simulator `set-baseline` with an id that names no saved run.
 *
 * `setBaseline(id)` first clears EVERY baseline flag, then sets the one matching `id`. A stale or
 * mistyped id therefore matched nothing: the existing baseline was silently cleared and the route
 * answered 200 `{ baseline: null }`, so drift vs the baseline vanished with no error. An unknown id
 * is now a 404 and the stored baseline is untouched.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { runs, setBaselineMock } = vi.hoisted(() => ({
  runs: new Map<string, { id: string; isBaseline: boolean }>(),
  setBaselineMock: vi.fn(),
}));

vi.mock('@/lib/economy/economy-run-db', () => ({
  listRuns: () => [...runs.values()],
  getRun: (id: string) => runs.get(id) ?? null,
  getBaselineRun: () => [...runs.values()].find((r) => r.isBaseline) ?? null,
  saveRun: vi.fn(),
  deleteRun: vi.fn(),
  setBaseline: (id: string | null) => {
    setBaselineMock(id);
    for (const r of runs.values()) r.isBaseline = false;
    if (id && runs.has(id)) runs.get(id)!.isBaseline = true;
    return id ? runs.get(id) ?? null : null;
  },
}));

import { POST } from '@/app/api/economy-simulator/route';

const post = (body: unknown) => POST(new NextRequest('http://localhost/api/economy-simulator', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}));

beforeEach(() => {
  runs.clear();
  runs.set('a', { id: 'a', isBaseline: true });
  runs.set('b', { id: 'b', isBaseline: false });
  setBaselineMock.mockClear();
});

describe('economy-simulator set-baseline', () => {
  it('refuses an unknown id with 404 and leaves the baseline in place', async () => {
    const res = await post({ action: 'set-baseline', id: 'gone' });
    expect(res.status).toBe(404);
    expect(setBaselineMock).not.toHaveBeenCalled();
    expect(runs.get('a')!.isBaseline).toBe(true);
  });

  it('still moves the baseline to a known run', async () => {
    const res = await post({ action: 'set-baseline', id: 'b' });
    expect(res.status).toBe(200);
    expect((await res.json()).data.baseline.id).toBe('b');
    expect(runs.get('a')!.isBaseline).toBe(false);
  });

  it('still clears the baseline on an explicit null', async () => {
    const res = await post({ action: 'set-baseline', id: null });
    expect(res.status).toBe(200);
    expect((await res.json()).data.baseline).toBeNull();
    expect(runs.get('a')!.isBaseline).toBe(false);
  });
});
