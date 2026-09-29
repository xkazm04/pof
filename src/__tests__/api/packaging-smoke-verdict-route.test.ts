/**
 * `POST /api/packaging/smoke-test` takes ONE identity — the recorded build id — and
 * everything it launches, watches and condemns is read from that row. It must hand the
 * store the whole verdict (note AND pass/fail) for THAT build, and report back what it
 * did. Nothing a caller names may reach spawn or taskkill.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/packaging/smoke-test', async (orig) => {
  const actual = await orig<typeof import('@/lib/packaging/smoke-test')>();
  return { ...actual, runSmokeTest: vi.fn() };
});

vi.mock('@/lib/packaging/build-history-store', () => ({
  getBuild: vi.fn(),
  attachSmokeResultToBuild: vi.fn(),
}));

import { POST } from '@/app/api/packaging/smoke-test/route';
import { runSmokeTest } from '@/lib/packaging/smoke-test';
import { getBuild, attachSmokeResultToBuild, type BuildRecord } from '@/lib/packaging/build-history-store';

const FAIL_RESULT = {
  status: 'fail' as const,
  gameAlive: false,
  bootstrapExitCode: 1,
  spawnError: null,
  observedMs: 25000,
  gameImage: 'PoF-Win64-Shipping.exe',
  bootstrapExe: 'C:/out/PoF.exe',
};

function req(body: unknown): Request {
  return new Request('http://localhost:3001/api/packaging/smoke-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function row(over: Partial<BuildRecord> = {}): BuildRecord {
  return {
    id: 42, projectId: 'c:/pof', platform: 'Win64', config: 'Shipping', status: 'success',
    sizeBytes: null, durationMs: null, version: '0.1.3', outputPath: 'C:/out/PoF.exe',
    errorSummary: null, cookTimeMs: null, warningCount: 0, errorCount: 0, notes: null,
    createdAt: '2026-09-29 10:00:00', ...over,
  };
}

beforeEach(() => {
  vi.mocked(runSmokeTest).mockReset().mockResolvedValue(FAIL_RESULT);
  vi.mocked(getBuild).mockReset().mockImplementation((id: number) => (id === 42 ? row() : null));
  vi.mocked(attachSmokeResultToBuild).mockReset().mockReturnValue({
    build: row({ status: 'failed' }),
    previousStatus: 'success',
    statusChanged: true,
    unrecordedReason: null,
  });
});

describe('the route smokes and condemns the build it is NAMED', () => {
  it('launches the recorded exe, derives the image from its basename, and attaches by id', async () => {
    const res = await POST(req({ buildId: 42 }));
    expect(res.status).toBe(200);
    expect(runSmokeTest).toHaveBeenCalledTimes(1);
    const opts = vi.mocked(runSmokeTest).mock.calls[0][0];
    expect(opts.bootstrapExe).toBe('C:/out/PoF.exe');
    expect(opts.gameImage).toBe('PoF-Win64-Shipping.exe');

    const call = vi.mocked(attachSmokeResultToBuild).mock.calls[0];
    expect(call[0]).toBe(42);
    expect(call[1]).toContain('smoke-test: fail');
    expect(call[2]).toBe('fail');
  });

  it('reports the status flip so the panel and the DB cannot disagree', async () => {
    const json = await (await POST(req({ buildId: 42 }))).json();
    expect(json.success).toBe(true);
    expect(json.data.recordedToBuildId).toBe(42);
    expect(json.data.buildStatus).toBe('failed');
    expect(json.data.statusChanged).toBe(true);
    expect(json.data.unrecordedReason).toBeNull();
  });
});

describe('the route never launches what a caller names', () => {
  it('a body with an exePath and no buildId is a 400 and nothing is spawned', async () => {
    const res = await POST(req({ exePath: 'C:/Windows/notepad.exe', projectName: 'x', platform: 'Win64', config: 'Shipping' }));
    expect(res.status).toBe(400);
    expect(runSmokeTest).not.toHaveBeenCalled();
    expect(attachSmokeResultToBuild).not.toHaveBeenCalled();
  });

  it.each([
    ['a failed row', row({ id: 7, status: 'failed' })],
    ['a row with no output path', row({ id: 7, outputPath: null })],
  ])('%s is a 409 that names the build', async (_n, r) => {
    vi.mocked(getBuild).mockReturnValue(r);
    const res = await POST(req({ buildId: 7 }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('#7');
    expect(runSmokeTest).not.toHaveBeenCalled();
  });

  it('an unknown id is a 404', async () => {
    const res = await POST(req({ buildId: 99 }));
    expect(res.status).toBe(404);
    expect(runSmokeTest).not.toHaveBeenCalled();
  });

  it('a non-Win64 row is a 400', async () => {
    vi.mocked(getBuild).mockReturnValue(row({ id: 7, platform: 'Linux', outputPath: '/out/PoF.sh' }));
    const res = await POST(req({ buildId: 7 }));
    expect(res.status).toBe(400);
    expect(runSmokeTest).not.toHaveBeenCalled();
  });
});
