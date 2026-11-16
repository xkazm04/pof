/**
 * POST /api/pipeline-artifacts/drain/worker — the worker's timing knobs are validated at the
 * door. `Math.max(MIN, "abc")` is NaN and `setInterval(fn, NaN)` fires about every
 * millisecond, so a non-numeric `intervalMs` used to start a drain tick hot-loop against the
 * shared UE editor; a non-numeric `cooldownMs` is string-concatenated onto `now`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { startDrainWorker } = vi.hoisted(() => ({ startDrainWorker: vi.fn((cfg: unknown) => ({ running: true, cfg })) }));
vi.mock('@/lib/test-gate-runner', () => ({
  startDrainWorker,
  stopDrainWorker: vi.fn(() => ({ running: false })),
  getWorkerStatus: vi.fn(() => ({ running: false })),
  parseDrainFilter: () => ({}),
  MIN_WORKER_INTERVAL_MS: 5_000,
}));

import { POST } from '@/app/api/pipeline-artifacts/drain/worker/route';

const post = (body: unknown) => POST(new NextRequest('http://localhost/api/pipeline-artifacts/drain/worker', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}));

const cfg = () => startDrainWorker.mock.calls[0][0] as { intervalMs: number; cooldownMs?: number };

beforeEach(() => startDrainWorker.mockClear());

describe('POST /api/pipeline-artifacts/drain/worker — timing validation', () => {
  it.each([
    { intervalMs: 'abc' }, { intervalMs: '60000' }, { intervalMs: null }, { cooldownMs: 'abc' }, { cooldownMs: -1 },
  ])('refuses %o with 400 and starts nothing', async (knob) => {
    const res = await post({ action: 'start', ...knob });
    expect(res.status).toBe(400);
    expect(startDrainWorker).not.toHaveBeenCalled();
  });

  it('defaults the interval and clamps a too-small one to the floor', async () => {
    expect((await post({ action: 'start' })).status).toBe(200);
    expect(cfg().intervalMs).toBe(30_000);
    startDrainWorker.mockClear();
    expect((await post({ action: 'start', intervalMs: 10, cooldownMs: 0 })).status).toBe(200);
    expect(cfg().intervalMs).toBe(5_000);
    expect(cfg().cooldownMs).toBe(0);
  });
});
