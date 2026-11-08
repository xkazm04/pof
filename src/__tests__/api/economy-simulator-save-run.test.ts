/**
 * POST /api/economy-simulator `save-run` — a saved run's metrics come from the server's simulation.
 *
 * The route stored `extractRunMetrics(body.result)` and `body.result.config` verbatim, so a
 * client-edited result became a saved run (and possibly the BASELINE every later drift is measured
 * against) with numbers no simulation produced, and an un-normalized config. Like generate-code,
 * the result is now only a carrier for its config: the route re-simulates the normalized config
 * (seeded, so a genuine result reproduces exactly) and saves those metrics.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { runSimulation } from '@/lib/economy/simulation-engine';
import { extractRunMetrics } from '@/lib/economy/economy-run';
import { normalizeSimulationConfig } from '@/lib/economy/normalize-config';

const { saveRunMock } = vi.hoisted(() => ({ saveRunMock: vi.fn((r: Record<string, unknown>) => ({ id: 'r1', ...r })) }));

vi.mock('@/lib/economy/economy-run-db', () => ({
  listRuns: () => [], getRun: () => null, getBaselineRun: () => null,
  deleteRun: vi.fn(), setBaseline: vi.fn(), saveRun: saveRunMock,
}));

import { POST } from '@/app/api/economy-simulator/route';

const post = (body: unknown) => POST(new NextRequest('http://localhost/api/economy-simulator', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}));

const config = normalizeSimulationConfig({ agentCount: 5, maxLevel: 10, maxPlayHours: 5, seed: 7 });

beforeEach(() => saveRunMock.mockClear());

describe('economy-simulator save-run', () => {
  it('saves the re-simulated metrics, not client-edited ones', async () => {
    const genuine = JSON.parse(JSON.stringify(runSimulation(config)));
    const forged = { ...genuine, metrics: genuine.metrics.map((m: Record<string, unknown>) => ({ ...m, avgGold: 1e12 })) };

    const res = await post({ action: 'save-run', name: 'v1', result: forged });
    expect(res.status).toBe(200);
    const saved = saveRunMock.mock.calls[0][0] as { metrics: Record<string, unknown> };
    const expected = extractRunMetrics(runSimulation(config));
    expect({ ...saved.metrics, durationMs: 0 }).toEqual({ ...expected, durationMs: 0 });
  });

  it('saves the normalized config, not the raw one', async () => {
    const genuine = JSON.parse(JSON.stringify(runSimulation(config)));
    await post({ action: 'save-run', name: 'v1', result: { ...genuine, config: { ...genuine.config, agentCount: 1e9 } } });
    expect((saveRunMock.mock.calls[0][0] as { config: { agentCount: number } }).config.agentCount).toBe(500);
  });

  it('refuses a result without a usable config with 400', async () => {
    const res = await post({ action: 'save-run', name: 'v1', result: { metrics: [] } });
    expect(res.status).toBe(400);
    expect(saveRunMock).not.toHaveBeenCalled();
  });
});
