/**
 * POST /api/economy-simulator `generate-code` with a client-supplied `result`.
 *
 * The route passed `body.result` straight into `generateUE5Code`, so any object that was not a
 * real SimulationResult crashed with a 500, and a hand-edited one emitted "calibrated" UE5 C++
 * from numbers no simulation produced. The result is now only a carrier for its `config`: the
 * route re-simulates that config through `normalizeSimulationConfig` (the engine is seeded, so a
 * genuine result reproduces exactly) and generates from the server's own output.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/economy-simulator/route';
import { runSimulation } from '@/lib/economy/simulation-engine';
import { generateUE5Code } from '@/lib/economy/codegen';
import { normalizeSimulationConfig } from '@/lib/economy/normalize-config';

const post = (body: unknown) => POST(new NextRequest('http://localhost/api/economy-simulator', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}));

const config = normalizeSimulationConfig({ agentCount: 5, maxLevel: 10, maxPlayHours: 5, seed: 7 });

describe('economy-simulator generate-code from a result', () => {
  // codegen stamps `new Date()` into every file; pin it so the comparison is about content.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-08T00:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it.each([
    ['empty object', {}],
    ['metrics only', { metrics: [] }],
    ['a string', 'x'],
    ['config not an object', { config: 3 }],
  ])('refuses a result without a usable config (%s) with 400', async (_label, result) => {
    const res = await post({ action: 'generate-code', result });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('result.config');
  });

  it('generates from the re-simulated config, not from client-edited metrics', async () => {
    const genuine = JSON.parse(JSON.stringify(runSimulation(config)));
    const expected = JSON.parse(JSON.stringify(generateUE5Code(runSimulation(config))));
    const forged = { ...genuine, metrics: genuine.metrics.map((m: Record<string, unknown>) => ({ ...m, avgGold: 1e12 })) };

    const res = await post({ action: 'generate-code', result: forged });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(expected);
  });

  it('a genuine result still generates byte-identical code', async () => {
    const genuine = JSON.parse(JSON.stringify(runSimulation(config)));
    const expected = JSON.parse(JSON.stringify(generateUE5Code(genuine)));
    const res = await post({ action: 'generate-code', result: genuine });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(expected);
  });
});
