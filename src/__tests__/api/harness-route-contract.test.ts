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
