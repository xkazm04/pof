/**
 * POST /api/harness launches an autonomous CLI loop that runs with permissions skipped, so it
 * sits behind `requireOperator`, and its inputs are refused before anything is touched.
 * Nothing here starts a run: the orchestrator is a stub.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  created: 0,
  identity: (() => ({ mode: 'new' })) as () => unknown,
  deleted: [] as string[],
}));

vi.mock('@/lib/harness', () => ({
  createDefaultConfig: (c: Record<string, unknown>) => ({ statePath: 'C:/state/default', ...c }),
  createHarnessOrchestrator: () => {
    h.created += 1;
    return { on: () => undefined, start: async () => undefined, pause: () => undefined, resume: async () => undefined, getRunId: () => 'r1' };
  },
  rehydrateHarnessOrchestrator: () => null,
  resolveRunIdentity: () => h.identity(),
}));
vi.mock('@/lib/harness/guide-generator', () => ({ renderGuideMarkdown: () => '', loadGuide: () => null }));
vi.mock('@/lib/harness/orchestrator', () => ({
  readHarnessPlan: () => null, readHarnessCost: () => null, readCheckpoints: () => null,
  readRunMeta: () => null, isResumableStatus: () => false,
}));
vi.mock('@/lib/harness-runs-db', () => ({
  reapStrandedRuns: () => undefined,
  getRun: () => null,
  deleteRun: (id: string) => { h.deleted.push(id); return true; },
}));

import { POST, GET } from '@/app/api/harness/route';
import { DELETE } from '@/app/api/harness/runs/[id]/route';

const G = globalThis as unknown as {
  harnessOrchestrator: unknown;
  harnessConfig: { statePath: string } | undefined;
  harnessStatus: string;
  harnessEvents: unknown[];
};

const START = { action: 'start', projectPath: 'C:/p', projectName: 'P', ueVersion: '5.8' };

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(new NextRequest('http://localhost:3001/api/harness', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'localhost:3001', ...headers },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  h.created = 0;
  h.deleted = [];
  h.identity = () => ({ mode: 'new' });
  G.harnessOrchestrator = undefined;
  G.harnessConfig = undefined;
  G.harnessStatus = 'idle';
  G.harnessEvents = [];
});

afterEach(() => { vi.unstubAllEnvs(); });

describe('harness writes are operator-guarded', () => {
  for (const action of ['start', 'pause', 'resume']) {
    it(`refuses a cross-site ${action} with 403`, async () => {
      const res = await post({ ...START, action }, { origin: 'https://evil.example' });
      expect(res.status).toBe(403);
      expect(h.created).toBe(0);
    });
  }

  it('requires the token when one is configured', async () => {
    vi.stubEnv('POF_OPERATOR_TOKEN', 'secret');
    expect((await post(START)).status).toBe(401);
    expect(h.created).toBe(0);
    expect((await post(START, { 'x-operator-token': 'secret' })).status).toBe(200);
    expect(h.created).toBe(1);
  });

  it('still admits a same-origin browser start and a header-less MCP start', async () => {
    expect((await post(START, { origin: 'http://localhost:3001' })).status).toBe(200);
    G.harnessStatus = 'idle';
    expect((await post(START)).status).toBe(200);
  });

  it('refuses a cross-site run deletion, as the experiment run DELETE does', async () => {
    const del = (headers: Record<string, string>) => DELETE(
      new NextRequest('http://localhost:3001/api/harness/runs/r1', { method: 'DELETE', headers: { host: 'localhost:3001', ...headers } }),
      { params: Promise.resolve({ id: 'r1' }) },
    );
    expect((await del({ origin: 'https://evil.example' })).status).toBe(403);
    expect(h.deleted).toEqual([]);
    expect((await del({})).status).toBe(200);
    expect(h.deleted).toEqual(['r1']);
  });
});

describe("a refused start leaves the current run's server state alone", () => {
  it('keeps the previous config and event buffer when the statePath belongs to another project', async () => {
    const previous = { statePath: 'C:/state/live' };
    const events = [{ type: 'harness:started' }];
    G.harnessConfig = previous;
    G.harnessEvents = events;
    G.harnessStatus = 'paused';
    h.identity = () => { throw new Error('statePath belongs to C:/other'); };

    const res = await post({ ...START, statePath: 'C:/state/foreign' });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('C:/other');
    expect(h.created).toBe(0);
    expect(G.harnessConfig).toBe(previous);
    expect(G.harnessEvents).toBe(events);
  });
});

describe('a start over a paused run', () => {
  const orchestrator = { getRunId: () => 'paused-run', on: () => undefined, start: async () => undefined };

  function pause() {
    G.harnessOrchestrator = orchestrator;
    G.harnessConfig = { statePath: 'C:/state/live' };
    G.harnessStatus = 'paused';
  }

  it('answers 409 naming the paused run and leaves the orchestrator in place', async () => {
    pause();
    const res = await post({ ...START, statePath: 'C:/state/other' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('paused-run');
    expect(h.created).toBe(0);
    expect(G.harnessOrchestrator).toBe(orchestrator);
    expect(G.harnessStatus).toBe('paused');
  });

  it('admits a start at the paused own statePath', async () => {
    pause();
    expect((await post({ ...START, statePath: 'C:/state/live' })).status).toBe(200);
    expect(h.created).toBe(1);
  });

  it('admits a deliberate replace with replacePaused: true', async () => {
    pause();
    expect((await post({ ...START, statePath: 'C:/state/other', replacePaused: true })).status).toBe(200);
    expect(h.created).toBe(1);
  });
});

describe('start refuses input the run could not honour', () => {
  for (const scenario of ['constructor', 'toString', '__proto__', 42]) {
    it(`refuses scenario ${JSON.stringify(scenario)} instead of running the default plan`, async () => {
      const res = await post({ ...START, scenario });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('scenario');
      expect(h.created).toBe(0);
    });
  }

  const BAD: [string, unknown][] = [
    ['projectPath', 42], ['projectName', true], ['ueVersion', 5.8], ['statePath', 7],
    ['maxIterations', 0], ['maxIterations', 1.5], ['maxIterations', '3'],
    ['targetPassRate', 0], ['targetPassRate', 101], ['targetPassRate', 'high'],
    ['sessionTimeoutMs', -1], ['sessionTimeoutMs', 'soon'],
    ['budgetUsd', -5], ['budgetUsd', 'ten'],
    ['maxConcurrent', 0], ['maxConcurrent', 2.5],
    ['unlimited', 'yes'], ['checkpoint', 1], ['ueTests', 'true'], ['ueVisual', 1], ['fork', 'true'],
    ['ueTestFilter', 9],
  ];
  for (const [field, value] of BAD) {
    it(`refuses ${field}=${JSON.stringify(value)} naming the field`, async () => {
      const res = await post({ ...START, [field]: value });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain(field);
      expect(h.created).toBe(0);
    });
  }

  it('admits a whole, valid start, a 0-1 target rate and a 0-100 one', async () => {
    const res = await post({
      ...START, statePath: 'C:/s', maxIterations: 3, targetPassRate: 0.9, sessionTimeoutMs: 1000, budgetUsd: 5,
      maxConcurrent: 2, unlimited: false, checkpoint: true, ueTests: true, ueTestFilter: 'PoF.', ueVisual: false, fork: false,
    });
    expect(res.status).toBe(200);
    G.harnessStatus = 'idle';
    expect((await post({ ...START, targetPassRate: 90 })).status).toBe(200);
  });

  it('refuses a non-string statePath on resume', async () => {
    const res = await post({ action: 'resume', statePath: 7 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('statePath');
  });
});

describe('GET /api/harness', () => {
  const get = (q: string) => GET(new NextRequest(`http://localhost:3001/api/harness${q}`));

  it('refuses an unknown action instead of answering the status summary', async () => {
    const res = await get('?action=plaan');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('plaan');
  });

  it('still answers the bare status read and the known actions', async () => {
    expect((await get('')).status).toBe(200);
    expect((await get('?action=events')).status).toBe(200);
  });
});
