import { describe, it, expect, vi } from 'vitest';

// The build ledger (headless_builds) is real, on an in-memory DB.
vi.mock('@/lib/db', async () => {
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(':memory:');
  return { getDb: () => db };
});

// The queue's executor is the UBT spawn — mocked so a progress line can be driven by hand.
const { executeBuildMock } = vi.hoisted(() => ({ executeBuildMock: vi.fn() }));
vi.mock('@/lib/ue5-bridge/build-pipeline', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ue5-bridge/build-pipeline')>()),
  executeBuild: executeBuildMock,
  generateBuildId: () => 'build-q-1',
}));

import {
  defaultBuildRequest,
  buildRunReducer,
  BUILD_RUN_IDLE,
  MAX_MISSED_POLLS,
  type BuildRunState,
} from '@/lib/ue5-bridge/build-run';
import { buildQueue } from '@/lib/ue5-bridge/build-queue';
import type { BuildOptions, BuildResult } from '@/types/ue5-bridge';

describe('defaultBuildRequest', () => {
  it("builds the project's Editor target, Development, Win64 (case 1)", () => {
    const r = defaultBuildRequest({ projectPath: 'C:\\Proj', projectName: 'Did', ueVersion: '5.8.0' });
    expect(r).toEqual({
      ok: true,
      data: {
        action: 'start',
        projectPath: 'C:\\Proj',
        targetName: 'Did',
        targetType: 'Editor',
        configuration: 'Development',
        platform: 'Win64',
        ueVersion: '5.8.0',
      },
    });
  });

  it('refuses a projectName the route would reject, naming the field (case 2)', () => {
    const r = defaultBuildRequest({ projectPath: 'C:\\Proj', projectName: 'My Game', ueVersion: '5.8.0' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/projectName/);
  });

  it('refuses an empty projectPath, naming the field (case 2)', () => {
    const r = defaultBuildRequest({ projectPath: '', projectName: 'Did', ueVersion: '5.8.0' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/projectPath/);
  });
});

describe('build queue progress (case 5)', () => {
  it("keeps the running item's latest [N/M] progress readable through getStatus", async () => {
    let release: (r: BuildResult) => void = () => {};
    executeBuildMock.mockImplementation((_req: unknown, opts: BuildOptions) => {
      opts.onProgress?.('[3/42] Compile A.cpp', 7);
      return new Promise<BuildResult>((res) => { release = res; });
    });

    const id = buildQueue.enqueue({
      projectPath: 'C:\\Proj', targetName: 'Did', ueVersion: '5.8.0',
      platform: 'Win64', configuration: 'Development', targetType: 'Editor',
    });

    expect(buildQueue.getStatus(id)?.progress).toEqual({ message: '[3/42] Compile A.cpp', percent: 7 });
    expect(buildQueue.getQueue()[0].progress).toEqual({ message: '[3/42] Compile A.cpp', percent: 7 });

    release({
      buildId: id, status: 'success', startedAt: '', completedAt: '', durationMs: 1, exitCode: 0,
      errorCount: 0, warningCount: 0, diagnostics: [], output: '',
    });
    await vi.waitFor(() => expect(buildQueue.getStatus(id)).toBeNull());
  });
});

describe('buildRunReducer (case 6)', () => {
  const id = 'build-1-abc';

  it('idle -> queued -> running 26% -> settled failed with a report refetch', () => {
    let s: BuildRunState = buildRunReducer(BUILD_RUN_IDLE, { type: 'started', buildId: id });
    expect(s.phase).toBe('queued');

    s = buildRunReducer(s, { type: 'status', status: { buildId: id, status: 'running', progress: { message: '[1/4] A', percent: 26 } } });
    expect(s).toMatchObject({ phase: 'running', buildId: id, percent: 26 });

    s = buildRunReducer(s, { type: 'status', status: { buildId: id, status: 'failed', errorCount: 4 } });
    expect(s).toMatchObject({ phase: 'settled', buildId: id, status: 'failed', errorCount: 4, refetchReport: true });
  });

  it(`goes 'lost' with a reason after ${20} unreadable polls — never a silent spinner`, () => {
    expect(MAX_MISSED_POLLS).toBe(20);
    let s: BuildRunState = buildRunReducer(BUILD_RUN_IDLE, { type: 'started', buildId: id });
    for (let i = 0; i < 19; i++) {
      s = buildRunReducer(s, { type: 'pollFailed', reason: `Build ${id} not found` });
    }
    expect(s.phase).toBe('queued');
    s = buildRunReducer(s, { type: 'pollFailed', reason: `Build ${id} not found` });
    expect(s.phase).toBe('lost');
    if (s.phase === 'lost') expect(s.reason).toContain('not found');
  });
});

describe('buildRunReducer follows by id (ue5-build-bridge/A case 8)', () => {
  it('a by-id failed status settles the run with a report refetch', () => {
    const s = buildRunReducer(
      { phase: 'running', buildId: 'b1', missedPolls: 0 },
      { type: 'status', status: { buildId: 'b1', status: 'failed', errorCount: 4 } },
    );
    expect(s).toEqual({ phase: 'settled', buildId: 'b1', status: 'failed', errorCount: 4, refetchReport: true });
  });

  it("an interrupted build settles failed and carries the server's reason", () => {
    const s = buildRunReducer(
      { phase: 'queued', buildId: 'b1', missedPolls: 3 },
      { type: 'status', status: { buildId: 'b1', status: 'failed', interrupted: true, reason: 'b1 is no longer queued' } },
    );
    expect(s).toEqual({
      phase: 'settled', buildId: 'b1', status: 'failed', errorCount: 0, refetchReport: true, reason: 'b1 is no longer queued',
    });
  });
});
