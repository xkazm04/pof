import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// Capture the config the route hands to the orchestrator, and stub the loop so
// no real Claude sessions spawn. createDefaultConfig stays REAL (via ...actual)
// so we exercise the true body → config mapping — the actual bug site.
let capturedConfig: unknown = null;
const fakeOrchestrator = {
  on: vi.fn(() => () => {}),
  start: vi.fn(async () => ({})),
  pause: vi.fn(),
  resume: vi.fn(async () => ({})),
  getPlan: vi.fn(() => null),
  getGuide: vi.fn(() => null),
  getCost: vi.fn(() => null),
  getRunId: vi.fn(() => null),
  getCheckpoints: vi.fn(() => null),
};

vi.mock('@/lib/harness', async (orig) => {
  const actual = await orig<typeof import('@/lib/harness')>();
  return {
    ...actual,
    createHarnessOrchestrator: vi.fn((cfg: unknown) => {
      capturedConfig = cfg;
      return fakeOrchestrator;
    }),
  };
});
vi.mock('@/lib/harness-runs-db', () => ({ reapStrandedRuns: vi.fn(() => 0) }));

import { POST } from '@/app/api/harness/route';
import { SCENARIOS } from '@/lib/harness/scenarios';

type Cfg = import('@/lib/harness').HarnessConfig;

function startReq(body: Record<string, unknown>): NextRequest {
  return { json: async () => ({ action: 'start', ...body }) } as unknown as NextRequest;
}

const REQUIRED = { projectPath: 'C:/proj', projectName: 'Proj', ueVersion: '5.8' };

beforeEach(() => {
  capturedConfig = null;
  (globalThis as unknown as { harnessStatus: string }).harnessStatus = 'idle';
});

describe('POST /api/harness — control-surface mapping', () => {
  it('1b: maxConcurrent from the POST body reaches the executor config', async () => {
    const res = await POST(startReq({ ...REQUIRED, maxConcurrent: 5 }));
    expect(res.status).toBe(200);
    expect((capturedConfig as Cfg).executor.maxConcurrent).toBe(5);
  });

  it('1b: maxConcurrent is reachable even WITHOUT sessionTimeoutMs (the old gate)', async () => {
    await POST(startReq({ ...REQUIRED, maxConcurrent: 3 }));
    const cfg = capturedConfig as Cfg;
    expect(cfg.executor.maxConcurrent).toBe(3);
    // default timeout still applied when only concurrency is passed
    expect(cfg.executor.sessionTimeoutMs).toBe(30 * 60 * 1000);
  });

  it('1c: a scenario name selects the shared curated area set', async () => {
    await POST(startReq({ ...REQUIRED, scenario: 'ui-overhaul' }));
    expect((capturedConfig as Cfg).areas).toBe(SCENARIOS['ui-overhaul'].areas);
  });

  it('1c: an unknown scenario is rejected loudly (400), not silently ignored', async () => {
    const res = await POST(startReq({ ...REQUIRED, scenario: 'does-not-exist' }));
    expect(res.status).toBe(400);
    expect(capturedConfig).toBeNull();
  });

  it('1a: a 0–1 targetPassRate fraction is normalized to a percent', async () => {
    await POST(startReq({ ...REQUIRED, targetPassRate: 0.9 }));
    expect((capturedConfig as Cfg).targetPassRate).toBe(90);
  });

  it('1d: the unlimited opt-out flows through to config', async () => {
    await POST(startReq({ ...REQUIRED, unlimited: true }));
    expect((capturedConfig as Cfg).unlimited).toBe(true);
  });
});

describe('POST /api/harness — Direction 3 control-surface parity', () => {
  it('themeDirective flows through to config', async () => {
    await POST(startReq({ ...REQUIRED, themeDirective: 'Star Wars ARPG' }));
    expect((capturedConfig as Cfg).themeDirective).toBe('Star Wars ARPG');
  });

  it('rejects an over-length themeDirective loudly (400)', async () => {
    const res = await POST(startReq({ ...REQUIRED, themeDirective: 'x'.repeat(2001) }));
    expect(res.status).toBe(400);
    expect(capturedConfig).toBeNull();
  });

  it('areaPassThreshold reaches the executor config', async () => {
    await POST(startReq({ ...REQUIRED, areaPassThreshold: 80 }));
    expect((capturedConfig as Cfg).executor.areaPassThreshold).toBe(80);
  });

  it('areaPassThreshold is reachable even WITHOUT sessionTimeoutMs/maxConcurrent', async () => {
    await POST(startReq({ ...REQUIRED, areaPassThreshold: 0.75 }));
    const cfg = capturedConfig as Cfg;
    expect(cfg.executor.areaPassThreshold).toBe(0.75);
    expect(cfg.executor.sessionTimeoutMs).toBe(30 * 60 * 1000);
  });

  it('rejects an out-of-range areaPassThreshold (400)', async () => {
    for (const bad of [0, -1, 150, Number.NaN]) {
      capturedConfig = null;
      (globalThis as unknown as { harnessStatus: string }).harnessStatus = 'idle';
      const res = await POST(startReq({ ...REQUIRED, areaPassThreshold: bad }));
      expect(res.status).toBe(400);
      expect(capturedConfig).toBeNull();
    }
  });

  it('passRateBasis flows through and rejects an unknown basis (400)', async () => {
    await POST(startReq({ ...REQUIRED, passRateBasis: 'self-reported' }));
    expect((capturedConfig as Cfg).passRateBasis).toBe('self-reported');

    capturedConfig = null;
    (globalThis as unknown as { harnessStatus: string }).harnessStatus = 'idle';
    const res = await POST(startReq({ ...REQUIRED, passRateBasis: 'wishful' }));
    expect(res.status).toBe(400);
    expect(capturedConfig).toBeNull();
  });
});
