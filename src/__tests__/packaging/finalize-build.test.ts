/**
 * One cook finalizer for both automated build_history writers.
 *
 * The interactive cook (execute/route.ts) and the nightly runner
 * (scheduled-build-runner.ts) each finalized a cook inline and drifted: the nightly
 * writer never stamped a version and its size verdicts could not name their
 * baseline. `finalizeCook` is the single place the finalization rules live.
 */
import { describe, it, expect, vi } from 'vitest';
import { finalizeCook, type FinalizeDeps } from '@/lib/packaging/finalize-build';
import { evaluateBuildSize, type SizeBaselineRef, type SizeBudgetConfig } from '@/lib/packaging/size-budgets';

const BUDGET_5PCT: SizeBudgetConfig = {
  budgets: { Win64: { budgetBytes: 0, growthPercent: 5 } },
  failOnRegression: false,
};

const BASELINE_41: SizeBaselineRef = {
  buildId: 41, projectId: 'P', sizeBytes: 100_000_000, version: '0.1.4', createdAt: 't',
};

function deps(overrides: Partial<FinalizeDeps> = {}): FinalizeDeps {
  return {
    lastGreenBaseline: vi.fn().mockReturnValue(BASELINE_41),
    evaluateBuildSize: vi.fn((platform, sizeBytes, lastGreen, baseline) =>
      evaluateBuildSize(platform, sizeBytes, lastGreen, BUDGET_5PCT, baseline)),
    nextVersion: vi.fn().mockReturnValue('0.1.5'),
    insertBuild: vi.fn().mockReturnValue({ id: 42 }),
    ...overrides,
  };
}

const CTX = { projectPath: 'P', platform: 'Win64', config: 'Shipping' };

describe('finalizeCook', () => {
  it('versions a green cook and names the baseline build in its regression verdict', () => {
    const d = deps();
    const res = finalizeCook(
      { kind: 'done', exePath: 'S\G.exe', durationMs: 1000, sizeBytes: 110_000_000 }, CTX, d,
    );
    expect(d.insertBuild).toHaveBeenCalledTimes(1);
    expect(d.insertBuild).toHaveBeenCalledWith(expect.objectContaining({ version: '0.1.5', status: 'success' }));
    expect(d.lastGreenBaseline).toHaveBeenCalledWith('Win64', 'P');
    expect(res.version).toBe('0.1.5');
    expect(res.buildId).toBe(42);
    expect(res.regression?.note).toContain('build #41');
  });

  it('records a failed cook with its reason and no version', () => {
    const d = deps();
    finalizeCook({ kind: 'error', status: 'failed', message: 'cook exited with code 1' }, CTX, d);
    expect(d.insertBuild).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed', errorSummary: 'cook exited with code 1', version: null,
    }));
    expect(d.nextVersion).not.toHaveBeenCalled();
  });

  it('records a cancelled cook as cancelled, unversioned', () => {
    const d = deps();
    const res = finalizeCook({ kind: 'error', status: 'cancelled', message: 'cook cancelled' }, CTX, d);
    expect(d.insertBuild).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }));
    expect(d.nextVersion).not.toHaveBeenCalled();
    expect(res.version).toBeNull();
  });

  it('does not look up a baseline for an unmeasured cook', () => {
    const d = deps();
    const res = finalizeCook(
      { kind: 'done', exePath: 'S\G.exe', durationMs: 1000, sizeBytes: null }, CTX, d,
    );
    expect(d.lastGreenBaseline).not.toHaveBeenCalled();
    expect(res.regression).toBeNull();
    expect(d.insertBuild).toHaveBeenCalledWith(expect.objectContaining({ sizeBytes: null }));
  });
});
