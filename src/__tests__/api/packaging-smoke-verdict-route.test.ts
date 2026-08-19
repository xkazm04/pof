/**
 * `POST /api/packaging/smoke-test` must hand the store the whole verdict — the note
 * AND the pass/fail — and must report back what it did, including "nothing in scope
 * received this". Returning `recordedToBuildId: null` beside a pass was a silent
 * failure: the only proof the packaged exe runs went nowhere and nobody was told.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/packaging/smoke-test', async (orig) => {
  const actual = await orig<typeof import('@/lib/packaging/smoke-test')>();
  return { ...actual, runSmokeTest: vi.fn() };
});

vi.mock('@/lib/packaging/build-history-store', () => ({
  attachSmokeResultToLatestBuild: vi.fn(),
}));

import { POST } from '@/app/api/packaging/smoke-test/route';
import { runSmokeTest } from '@/lib/packaging/smoke-test';
import { attachSmokeResultToLatestBuild } from '@/lib/packaging/build-history-store';

const PROJECT = 'C:/Users/kazda/Documents/Unreal Projects/PoF';

const FAIL_RESULT = {
  status: 'fail' as const,
  gameAlive: false,
  bootstrapExitCode: 1,
  spawnError: null,
  observedMs: 25000,
  gameImage: 'PoF-Win64-Shipping.exe',
  bootstrapExe: 'C:\\out\\PoF.exe',
};

function req(body: unknown): Request {
  return new Request('http://localhost:3001/api/packaging/smoke-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const BODY = { exePath: 'C:\\out\\PoF.exe', projectName: 'PoF', platform: 'Win64', config: 'Shipping', projectPath: PROJECT };

beforeEach(() => {
  vi.mocked(runSmokeTest).mockResolvedValue(FAIL_RESULT);
  vi.mocked(attachSmokeResultToLatestBuild).mockReturnValue({
    build: { id: 42, status: 'failed' } as never,
    previousStatus: 'success',
    statusChanged: true,
    unrecordedReason: null,
  });
});

describe('the route hands the store the verdict, not just a note', () => {
  it('passes the smoke pass/fail through so the build can be condemned', async () => {
    await POST(req(BODY));
    const call = vi.mocked(attachSmokeResultToLatestBuild).mock.calls[0];
    expect(call[0]).toBe('Win64');
    expect(call[1]).toBe('Shipping');
    expect(call[2]).toContain('smoke-test: fail');
    expect(call[3]).toBe(PROJECT);
    expect(call[4]).toBe('fail');
  });

  it('reports the status flip so the panel and the DB cannot disagree', async () => {
    const res = await POST(req(BODY));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.recordedToBuildId).toBe(42);
    expect(json.data.buildStatus).toBe('failed');
    expect(json.data.statusChanged).toBe(true);
    expect(json.data.unrecordedReason).toBeNull();
  });

  it('reports that NOTHING received the verdict instead of a bare null', async () => {
    vi.mocked(attachSmokeResultToLatestBuild).mockReturnValue({
      build: null,
      previousStatus: null,
      statusChanged: false,
      unrecordedReason: 'no successful Win64/Shipping build is recorded under this project',
    });
    const res = await POST(req(BODY));
    const json = await res.json();
    expect(json.data.recordedToBuildId).toBeNull();
    expect(json.data.unrecordedReason).toContain('Win64/Shipping');
    expect(json.data.buildStatus).toBeNull();
  });
});
