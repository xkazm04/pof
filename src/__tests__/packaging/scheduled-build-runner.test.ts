import { describe, it, expect, vi } from 'vitest';
import {
  runScheduledBuild,
  type ScheduledRunContext,
  type ScheduledRunDeps,
  type CookOutcome,
} from '@/lib/packaging/scheduled-build-runner';
import type { BuildProfile } from '@/lib/packaging/build-profiles';
import { createDefaultProfile } from '@/lib/packaging/build-profiles';
import type { SmokeTestResult } from '@/lib/packaging/smoke-test';

function profile(platform: 'Win64' | 'Linux' = 'Win64'): BuildProfile {
  return {
    ...createDefaultProfile(platform, 'Shipping'),
    id: 'p-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function context(overrides: Partial<ScheduledRunContext> = {}): ScheduledRunContext {
  return {
    profile: profile(),
    projectPath: 'C:\\proj',
    projectName: 'PoF',
    ueVersion: '5.5',
    lastBuiltCommit: 'oldsha',
    skipIfUnchanged: true,
    ...overrides,
  };
}

const okCook: CookOutcome = { status: 'success', exePath: 'C:\\Stage\\PoF.exe', durationMs: 1000, sizeBytes: 0 };
const okSmoke: SmokeTestResult = {
  status: 'pass', gameAlive: true, bootstrapExitCode: null, spawnError: null,
  observedMs: 25_000, gameImage: 'PoF-Win64-Shipping.exe', bootstrapExe: 'C:\\Stage\\PoF.exe',
};

function deps(overrides: Partial<ScheduledRunDeps> = {}): ScheduledRunDeps {
  let t = 0;
  return {
    getHead: vi.fn().mockResolvedValue('newsha'),
    runPreflight: vi.fn().mockResolvedValue({ overall: 'pass', results: [] }),
    runCook: vi.fn().mockResolvedValue(okCook),
    measureSize: vi.fn().mockResolvedValue(5_000_000),
    runSmoke: vi.fn().mockResolvedValue(okSmoke),
    lastGreenSize: vi.fn().mockReturnValue(4_000_000),
    evaluateSize: vi.fn().mockReturnValue(null),
    recordBuild: vi.fn().mockReturnValue({ id: 7 }),
    now: () => (t += 100),
    ...overrides,
  };
}

describe('runScheduledBuild', () => {
  it('skips when HEAD is unchanged since the last build', async () => {
    const d = deps({ getHead: vi.fn().mockResolvedValue('oldsha') });
    const res = await runScheduledBuild(context({ lastBuiltCommit: 'oldsha' }), d);
    expect(res.status).toBe('skipped');
    expect(res.reason).toMatch(/unchanged/i);
    expect(d.runCook).not.toHaveBeenCalled();
    expect(d.recordBuild).not.toHaveBeenCalled();
  });

  it('builds anyway when skip-if-unchanged is off even if HEAD matches', async () => {
    const d = deps({ getHead: vi.fn().mockResolvedValue('oldsha') });
    const res = await runScheduledBuild(context({ lastBuiltCommit: 'oldsha', skipIfUnchanged: false }), d);
    expect(res.status).toBe('success');
    expect(d.runCook).toHaveBeenCalled();
  });

  it('fails fast and records a failed build when pre-flight fails', async () => {
    const d = deps({
      runPreflight: vi.fn().mockResolvedValue({
        overall: 'fail',
        results: [{ id: 'config-sanity', label: 'Config', status: 'fail', detail: '', issues: ['ProjectID is empty'] }],
      }),
    });
    const res = await runScheduledBuild(context(), d);
    expect(res.status).toBe('failed');
    expect(res.preflight).toBe('fail');
    expect(d.runCook).not.toHaveBeenCalled();
    expect(d.recordBuild).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    expect(res.reason).toMatch(/ProjectID is empty/);
  });

  it('records a failed build when the cook fails', async () => {
    const d = deps({
      runCook: vi.fn().mockResolvedValue({ status: 'failed', exePath: '', durationMs: 500, sizeBytes: 0, message: 'cook exited with code 1' }),
    });
    const res = await runScheduledBuild(context(), d);
    expect(res.status).toBe('failed');
    expect(res.reason).toMatch(/code 1/);
    expect(d.runSmoke).not.toHaveBeenCalled();
    expect(d.recordBuild).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('runs the full chain on success and records a success build', async () => {
    const d = deps();
    const res = await runScheduledBuild(context(), d);
    expect(res.status).toBe('success');
    expect(res.commit).toBe('newsha');
    expect(res.buildId).toBe(7);
    expect(res.smoke).toBe('pass');
    expect(d.runSmoke).toHaveBeenCalled();
    // measured size feeds the size-budget evaluation
    expect(d.evaluateSize).toHaveBeenCalledWith('Win64', 5_000_000, 4_000_000);
    expect(d.recordBuild).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', sizeBytes: 5_000_000 }));
  });

  it('treats a smoke-test failure as a failed gate', async () => {
    const failSmoke: SmokeTestResult = { ...okSmoke, status: 'fail', gameAlive: false };
    const d = deps({ runSmoke: vi.fn().mockResolvedValue(failSmoke) });
    const res = await runScheduledBuild(context(), d);
    expect(res.status).toBe('failed');
    expect(res.smoke).toBe('fail');
    expect(d.recordBuild).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('skips the smoke-test for non-Win64 platforms', async () => {
    const d = deps();
    const res = await runScheduledBuild(context({ profile: profile('Linux') }), d);
    expect(res.status).toBe('success');
    expect(res.smoke).toBeNull();
    expect(d.runSmoke).not.toHaveBeenCalled();
  });

  it('records a size-regression note without failing the gate', async () => {
    const d = deps({
      evaluateSize: vi.fn().mockReturnValue({ note: '[SIZE_BUDGET] Win64 6.0 GB — exceeds 5 GB budget', exceedsBudget: true } as never),
    });
    const res = await runScheduledBuild(context(), d);
    expect(res.status).toBe('success');
    expect(res.sizeRegression).toMatch(/SIZE_BUDGET/);
    const recorded = (d.recordBuild as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(recorded.notes).toMatch(/SIZE_BUDGET/);
  });
});
