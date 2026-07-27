/**
 * No gate self-certifies — honest `unverifiable` everywhere.
 *
 * (a) `runGate` used to return `passed:true` "No command specified — skipped"
 *     for ANY commandless gate, so a required custom/build/test gate configured
 *     without a command silently green-lit the area. Only `ue-compile` had the
 *     honest treatment; it is now uniform.
 * (b) Compounding that: the default `passRateBasis:'verified'` plus a required
 *     gate that cannot verify makes the success stop-condition UNREACHABLE — the
 *     loop grinds every iteration to the budget cap with nothing warning the
 *     operator. `checkSuccessReachable` is the launch preflight for exactly that
 *     combination (it WARNS; it never blocks).
 */

import { describe, it, expect, vi } from 'vitest';
import { verify, checkSuccessReachable } from '@/lib/harness/verifier';
import type { ModuleArea, VerificationGate } from '@/lib/harness/types';

function area(): ModuleArea {
  return {
    id: 'area-a', moduleId: 'arpg-combat' as never, label: 'a', description: '',
    checklistItemIds: [], featureNames: [], dependsOn: [], status: 'pending', features: [],
  };
}

// ── (a) commandless gates are unverifiable, never a pass ─────────────────────

describe('commandless gates are UNVERIFIABLE', () => {
  const kinds: Array<VerificationGate['type']> = ['custom', 'build', 'test', 'lint', 'typecheck', 'playtest'];

  it.each(kinds)('a required commandless %s gate never self-certifies', async (type) => {
    const gates: VerificationGate[] = [{ name: `no-cmd-${type}`, type, required: true }];
    const report = await verify(area(), 1, 'C:/proj', gates, undefined);

    const result = report.gates[0];
    expect(result.passed).toBe(false);
    expect(result.unverifiable).toBe(true);
    expect(result.output).toContain('UNVERIFIABLE');
    expect(result.errors?.[0].message).toContain('no command configured');
    // Same requiredGates consequences ue-compile already had.
    expect(report.requiredFailures).toBe(1);
    expect(report.allPassed).toBe(false);
  });

  it('an ADVISORY commandless gate is still unverifiable but does not block', async () => {
    const gates: VerificationGate[] = [{ name: 'advisory', type: 'custom', required: false }];
    const report = await verify(area(), 1, 'C:/proj', gates, undefined);
    expect(report.gates[0].unverifiable).toBe(true);
    expect(report.gates[0].passed).toBe(false);
    expect(report.requiredFailures).toBe(0);
  });

  it('gates WITH a command are untouched — a real exit-0 command still passes', async () => {
    const gates: VerificationGate[] = [
      { name: 'green', type: 'custom', required: true, command: 'node -e "process.exit(0)"' },
      { name: 'red', type: 'custom', required: true, command: 'node -e "process.exit(1)"' },
    ];
    const report = await verify(area(), 1, process.cwd(), gates, undefined);

    const green = report.gates.find(g => g.gate === 'green')!;
    const red = report.gates.find(g => g.gate === 'red')!;
    expect(green.passed).toBe(true);
    expect(green.unverifiable).toBeUndefined();
    expect(red.passed).toBe(false);
    expect(red.unverifiable).toBeUndefined(); // a real failure, not "unknown"
    expect(report.requiredFailures).toBe(1);
  });
});

// ── (b) unreachable-success preflight ────────────────────────────────────────

describe('checkSuccessReachable', () => {
  const withCmd: VerificationGate = { name: 'build', type: 'build', required: true, command: 'npx next build' };
  const noCmd: VerificationGate = { name: 'ue-compile', type: 'ue-compile', required: true };

  it('flags the verified-basis + unverifiable-required-gate combination', () => {
    const r = checkSuccessReachable([noCmd], 'verified', { hasUeEnv: false });
    expect(r.reachable).toBe(false);
    expect(r.blockingGates).toEqual(['ue-compile']);
    expect(r.reason).toContain('UNREACHABLE');
    expect(r.reason).toContain('ue-compile');
    expect(r.reason).toContain('self-reported'); // names the escape hatch
  });

  it('is reachable when every required gate carries a command', () => {
    expect(checkSuccessReachable([withCmd], 'verified', { hasUeEnv: false }))
      .toEqual({ reachable: true, blockingGates: [] });
  });

  it('an ADVISORY gate that cannot verify does not make success unreachable', () => {
    const advisory: VerificationGate = { name: 'ue-tests', type: 'ue-test', required: false };
    expect(checkSuccessReachable([withCmd, advisory], 'verified', { hasUeEnv: false }).reachable).toBe(true);
  });

  it('a required ue-test gate needs the UE env, not a command', () => {
    const ueTest: VerificationGate = { name: 'ue-tests', type: 'ue-test', required: true };
    expect(checkSuccessReachable([ueTest], 'verified', { hasUeEnv: false }).reachable).toBe(false);
    expect(checkSuccessReachable([ueTest], 'verified', { hasUeEnv: true }).reachable).toBe(true);
  });

  it('required visual gates are not judged statically (runtime-determined)', () => {
    const visual: VerificationGate = { name: 'visual-check', type: 'visual', required: true };
    const ueVisual: VerificationGate = { name: 'ue-visual', type: 'ue-visual', required: true };
    expect(checkSuccessReachable([visual, ueVisual], 'verified', { hasUeEnv: false }).reachable).toBe(true);
  });

  it("the 'self-reported' basis is always reachable (it never needs a gate)", () => {
    expect(checkSuccessReachable([noCmd], 'self-reported', { hasUeEnv: false }).reachable).toBe(true);
  });
});

// ── (b') the orchestrator WARNS at launch, and does not block ────────────────

describe('orchestrator launch preflight', () => {
  it('emits a non-fatal harness:error + logger.warn and still runs the loop', async () => {
    // Isolated module graph so the executor/DB stubs here can't leak.
    vi.resetModules();
    const warn = vi.fn();
    vi.doMock('@/lib/logger', () => ({ logger: { warn, info: () => {}, error: () => {}, debug: () => {} } }));
    vi.doMock('@/lib/harness-runs-db', () => ({
      startRun: () => {}, finalizeRun: () => {}, reopenRun: () => true, getRun: () => null,
    }));
    vi.doMock('@/lib/harness/executor', () => ({
      executeArea: async () => ({ completed: true, assistantOutput: 'ok', costUsd: 0.01, durationMs: 1, errors: [] }),
      parseAreaResult: () => ({ features: [], learnings: [], summary: 'done' }),
      readAgentsMd: () => '', appendAgentsMd: () => {},
    }));

    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const { createHarnessOrchestrator } = await import('@/lib/harness/orchestrator');

    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-proj-'));
    const statePath = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-state-'));
    fs.writeFileSync(path.join(statePath, 'game-plan.json'), JSON.stringify({
      game: 'PoF', projectPath, ueVersion: '5.8', areas: [], iteration: 0,
      totalFeatures: 0, passingFeatures: 0, createdAt: '', updatedAt: '',
    }));

    const orch = createHarnessOrchestrator({
      projectPath, projectName: 'PoF', ueVersion: '5.8', statePath,
      executor: {
        sessionTimeoutMs: 1000, maxRetriesPerArea: 1, allowedTools: [],
        skipPermissions: true, bareMode: true, maxConcurrent: 1,
      },
      // A required gate with no command → nothing can ever verify.
      gates: [{ name: 'ue-compile', type: 'ue-compile', required: true }],
      maxIterations: 1, generateGuide: false, updateAgentsMd: false,
      targetPassRate: 90, passRateBasis: 'verified', unlimited: true,
    });

    const errors: string[] = [];
    orch.on((e) => { if (e.type === 'harness:error') errors.push(`${e.fatal}:${e.error}`); });
    await orch.start(); // WARNS, never blocks — the run still completes

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('false:'); // non-fatal
    expect(errors[0]).toContain('UNREACHABLE');
    expect(errors[0]).toContain('ue-compile');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('[harness]');

    fs.rmSync(statePath, { recursive: true, force: true });
    fs.rmSync(projectPath, { recursive: true, force: true });
    vi.doUnmock('@/lib/logger');
    vi.doUnmock('@/lib/harness-runs-db');
    vi.doUnmock('@/lib/harness/executor');
    vi.resetModules();
  });
});
