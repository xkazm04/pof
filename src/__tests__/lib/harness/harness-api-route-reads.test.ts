/**
 * GET /api/harness — the READ side of the control surface.
 *
 * (a) `?action=progress` must honour the state-io contract: a MISSING log is an
 *     honest `[]` (first run), a CORRUPT log is an error naming the file — never
 *     `[]`, which would tell the UI / `pof_harness_status` that nothing ever ran.
 * (b) `?statePath=` (or the last config's statePath when no in-memory run exists)
 *     serves the status snapshot from the durable sidecars on disk, so a status
 *     read after a server restart reports the resumable run instead of `idle`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { NextRequest } from 'next/server';

const getRunMock = vi.fn((): { status: string } | null => null);
vi.mock('@/lib/harness-runs-db', () => ({
  reapStrandedRuns: vi.fn(() => 0),
  getRun: () => getRunMock(),
}));

import { GET } from '@/app/api/harness/route';

type G = { harnessConfig?: { statePath: string } | undefined; harnessOrchestrator?: unknown; harnessStatus?: string; harnessEvents?: unknown[] };
const g = globalThis as unknown as G;

function getReq(query: Record<string, string> = {}): NextRequest {
  const sp = new URLSearchParams(query);
  return { nextUrl: { searchParams: sp } } as unknown as NextRequest;
}

const dirs: string[] = [];
function tmpState(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-state-'));
  dirs.push(d);
  return d;
}

beforeEach(() => {
  g.harnessOrchestrator = undefined;
  g.harnessConfig = undefined;
  g.harnessStatus = 'idle';
  g.harnessEvents = [];
  getRunMock.mockReset();
  getRunMock.mockReturnValue(null);
});
afterEach(() => {
  for (const d of dirs.splice(0)) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* */ } }
});

describe('GET /api/harness?action=progress — corrupt is never an empty log', () => {
  it('a missing progress.json is an honest empty log', async () => {
    g.harnessConfig = { statePath: tmpState() };
    const res = await GET(getReq({ action: 'progress' }));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });

  it('a parseable progress.json is returned as-is', async () => {
    const sp = tmpState();
    fs.writeFileSync(path.join(sp, 'progress.json'), JSON.stringify([{ iteration: 1, areaId: 'a' }]));
    g.harnessConfig = { statePath: sp };
    const res = await GET(getReq({ action: 'progress' }));
    expect((await res.json()).data).toEqual([{ iteration: 1, areaId: 'a' }]);
  });

  it('a CORRUPT progress.json is an error naming the file, never []', async () => {
    const sp = tmpState();
    fs.writeFileSync(path.join(sp, 'progress.json'), '[{"iteration": 1, "areaId": "a"'); // truncated write
    g.harnessConfig = { statePath: sp };
    const res = await GET(getReq({ action: 'progress' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/CORRUPT/);
    expect(body.error).toContain('progress.json');
  });
});

// ── (b) the disk read: a restart must not turn a resumable run into "idle" ─────

function seedRun(sp: string, runId = 'run_disk_1') {
  fs.writeFileSync(path.join(sp, 'run-meta.json'), JSON.stringify({
    runId, projectPath: 'C:/proj', statePath: sp, startedAt: '2026-01-01T00:00:00.000Z',
  }));
  fs.writeFileSync(path.join(sp, 'game-plan.json'), JSON.stringify({
    game: 'PoF', projectPath: 'C:/proj', ueVersion: '5.8', iteration: 4,
    totalFeatures: 10, passingFeatures: 6, verifiedFeatures: 4, createdAt: '', updatedAt: '',
    areas: [
      { id: 'a', status: 'completed', label: 'A', features: [] },
      { id: 'b', status: 'in-progress', label: 'B', features: [] },
      { id: 'c', status: 'completed-with-gaps', label: 'C', features: [] },
    ],
  }));
  fs.writeFileSync(path.join(sp, 'cost.json'), JSON.stringify({
    spentUsd: 3.25, byArea: { a: 3.25 }, sessions: 2, budgetUsd: 25, paused: false,
  }));
  fs.writeFileSync(path.join(sp, 'checkpoints.json'), JSON.stringify({
    branch: `harness/${runId}`,
    checkpoints: [{ areaId: '__baseline__', iteration: 0, sha: 'aaaa', tag: '', timestamp: '' }, { areaId: 'a', iteration: 1, sha: 'bbbb', tag: 't', timestamp: '' }],
  }));
}

describe('GET /api/harness — disk read of the durable sidecars', () => {
  it('with no in-memory run and an explicit ?statePath=, the status is served from disk', async () => {
    const sp = tmpState();
    seedRun(sp);
    const res = await GET(getReq({ statePath: sp }));
    expect(res.status).toBe(200);
    const d = (await res.json()).data;
    expect(d.source).toBe('disk');
    expect(d.statePath).toBe(sp);
    expect(d.runId).toBe('run_disk_1');
    // run-meta present, DB row gone → still resumable (resolveRunIdentity's rule).
    expect(d.resumable).toBe(true);
    expect(d.runStatus).toBeNull();
    expect(d.plan).toMatchObject({
      game: 'PoF', iteration: 4, totalFeatures: 10, passingFeatures: 6, verifiedFeatures: 4,
      selfReportedPassRate: 60, verifiedPassRate: 40,
      totalAreas: 3, completedAreas: 1, gappedAreas: 1, currentArea: 'B',
    });
    expect(d.cost).toMatchObject({ spentUsd: 3.25, budgetUsd: 25, sessions: 2, remainingUsd: 21.75 });
    expect(d.checkpoints).toMatchObject({ branch: 'harness/run_disk_1', count: 2, lastGreenSha: 'bbbb' });
  });

  it('a terminal DB row makes the disk run NOT resumable, and says which status it holds', async () => {
    const sp = tmpState();
    seedRun(sp);
    getRunMock.mockReturnValue({ status: 'completed' });
    const d = (await (await GET(getReq({ statePath: sp }))).json()).data;
    expect(d.resumable).toBe(false);
    expect(d.runStatus).toBe('completed');
  });

  it('with no in-memory run, the last config statePath is read from disk without an override', async () => {
    const sp = tmpState();
    seedRun(sp, 'run_disk_2');
    g.harnessConfig = { statePath: sp };
    const d = (await (await GET(getReq())).json()).data;
    expect(d.source).toBe('disk');
    expect(d.runId).toBe('run_disk_2');
  });

  it('an empty statePath is an honest empty disk read, not an error', async () => {
    const sp = tmpState();
    const d = (await (await GET(getReq({ statePath: sp }))).json()).data;
    expect(d).toMatchObject({ source: 'disk', runId: null, resumable: false, plan: null, cost: null, checkpoints: null });
  });

  it('?action=plan&statePath= returns the full plan from disk (404 when none)', async () => {
    const sp = tmpState();
    expect((await GET(getReq({ action: 'plan', statePath: sp }))).status).toBe(404);
    seedRun(sp);
    const d = (await (await GET(getReq({ action: 'plan', statePath: sp }))).json()).data;
    expect(d.areas.map((a: { id: string }) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('a live in-memory run with no override still answers from memory', async () => {
    g.harnessOrchestrator = {
      getPlan: () => null, getGuide: () => null, getCost: () => null, getRunId: () => 'run_mem', getCheckpoints: () => null,
    };
    g.harnessStatus = 'running';
    const d = (await (await GET(getReq())).json()).data;
    expect(d.source).toBe('memory');
    expect(d.runId).toBe('run_mem');
  });
});
