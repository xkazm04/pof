/**
 * The packaging routes that START A PROCESS sit behind `requireOperator`, like every
 * other spawn/UE-touching write route (efdadb2d, experiment/run, blender-mcp):
 *   - POST /api/packaging/execute    → a full UAT BuildCookRun
 *   - POST /api/packaging/preflight  → UnrealBuildTool / the DataValidation commandlet
 *   - POST /api/packaging/smoke-test → launches the recorded game exe
 *   - POST /api/packaging/schedule   → run-now starts a cook; save re-targets the nightly
 *   - DELETE /api/packaging/cook-jobs → cancels a running cook (kills the UAT process tree)
 * A cross-site browser request is refused (403) and, when POF_OPERATOR_TOKEN is set, a
 * call without it is refused (401) — both before anything is spawned. Same-origin and
 * header-less (pof-mcp, CLI callback) calls keep working while no token is configured.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-packaging-operator-guard-${process.pid}.db`;
});

const spawned = vi.fn();
vi.mock('@/lib/packaging/cook-jobs', () => ({
  startCookJob: () => { spawned('cook'); return { ok: false, error: 'mocked busy' }; },
  cancelCookJob: () => { spawned('cancel'); return { ok: false, error: 'mocked unknown' }; },
  activeCookJob: () => null,
  getCookJob: () => null,
  cookJobEventStream: () => null,
  COOK_SSE_HEADERS: {},
}));
vi.mock('@/lib/packaging/build-profiles-db', () => ({ getProfile: () => ({ id: 'p1' }) }));
vi.mock('@/lib/packaging/preflight-runner', () => ({
  runFastPreflight: async () => { spawned('preflight'); return { results: [] }; },
}));
vi.mock('@/lib/packaging/process-utils', () => ({
  spawnCapture: async () => { spawned('ubt'); return { output: '' }; },
}));
vi.mock('@/lib/packaging/smoke-test', () => ({
  runSmokeTest: async () => { spawned('smoke'); return { status: 'pass' }; },
  deriveGameImage: () => 'PoF-Win64-Shipping.exe',
  smokeResultNote: () => '',
}));
vi.mock('@/lib/packaging/build-history-store', () => ({
  getBuild: () => ({ id: 7, platform: 'Win64', status: 'success', config: 'Shipping', outputPath: 'C:/out/PoF.exe' }),
  attachSmokeResultToBuild: () => ({ build: null, previousStatus: 'success', statusChanged: false }),
  insertBuild: () => null,
  lastGreenBaseline: () => null,
}));
vi.mock('@/lib/packaging/build-schedule-store', () => ({
  getSchedule: () => ({ enabled: false }),
  setSchedule: (p: object) => { spawned('save'); return { enabled: false, ...p }; },
  getScheduleState: () => ({}),
  isRunning: () => false,
}));
vi.mock('@/lib/packaging/scheduled-build-runner', () => ({
  tickScheduler: () => { spawned('tick'); return { ran: false }; },
  startScheduledRun: () => { spawned('run-now'); return { ran: true }; },
}));

import { POST as executePOST } from '@/app/api/packaging/execute/route';
import { POST as preflightPOST } from '@/app/api/packaging/preflight/route';
import { POST as smokePOST } from '@/app/api/packaging/smoke-test/route';
import { POST as schedulePOST } from '@/app/api/packaging/schedule/route';
import { DELETE as cookCancelDELETE } from '@/app/api/packaging/cook-jobs/route';

type Handler = (req: NextRequest) => Promise<Response>;

const ROUTES: { path: string; handler: Handler; body: unknown }[] = [
  { path: 'packaging/execute', handler: executePOST, body: { profileId: 'p1', projectPath: 'C:/p', projectName: 'PoF', ueVersion: '5.8' } },
  { path: 'packaging/preflight', handler: preflightPOST, body: { projectPath: 'C:/p', projectName: 'PoF', ueVersion: '5.8' } },
  { path: 'packaging/smoke-test', handler: smokePOST, body: { buildId: 7 } },
  { path: 'packaging/schedule', handler: schedulePOST, body: { action: 'run-now' } },
];

const req = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3001/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'localhost:3001', ...headers },
    body: JSON.stringify(body),
  });

/** DELETE carries its target in the query string, not a body. */
const delReq = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3001/api/${path}?jobId=job-1`, {
    method: 'DELETE',
    headers: { host: 'localhost:3001', ...headers },
  });

const savedToken = process.env.POF_OPERATOR_TOKEN;
beforeEach(() => { delete process.env.POF_OPERATOR_TOKEN; spawned.mockClear(); });
afterEach(() => {
  if (savedToken === undefined) delete process.env.POF_OPERATOR_TOKEN;
  else process.env.POF_OPERATOR_TOKEN = savedToken;
});

describe.each(ROUTES)('POST /api/$path — operator guard', ({ path, handler, body }) => {
  it('refuses a cross-site Origin with 403 and spawns nothing', async () => {
    const res = await handler(req(path, body, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(spawned).not.toHaveBeenCalled();
  });

  it('refuses a call without the operator token when one is configured', async () => {
    process.env.POF_OPERATOR_TOKEN = 'secret';
    const res = await handler(req(path, body));
    expect(res.status).toBe(401);
    expect(spawned).not.toHaveBeenCalled();
  });

  it('lets a same-origin call through to the work', async () => {
    await handler(req(path, body, { origin: 'http://localhost:3001' }));
    expect(spawned).toHaveBeenCalled();
  });
});

describe('DELETE /api/packaging/cook-jobs - operator guard', () => {
  const path = 'packaging/cook-jobs';

  it('refuses a cross-site Origin with 403 and cancels nothing', async () => {
    const res = await cookCancelDELETE(delReq(path, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(spawned).not.toHaveBeenCalled();
  });

  it('refuses a call without the operator token when one is configured', async () => {
    process.env.POF_OPERATOR_TOKEN = 'secret';
    const res = await cookCancelDELETE(delReq(path));
    expect(res.status).toBe(401);
    expect(spawned).not.toHaveBeenCalled();
  });

  it('lets a same-origin call through to the cancel', async () => {
    await cookCancelDELETE(delReq(path, { origin: 'http://localhost:3001' }));
    expect(spawned).toHaveBeenCalledWith('cancel');
  });
});
