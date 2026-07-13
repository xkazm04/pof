import { describe, it, expect } from 'vitest';
import { verify, formatVerificationSummary } from '@/lib/harness/verifier';
import { attemptSelfHeal } from '@/lib/harness/orchestrator';
import type { ModuleArea, VerificationGate } from '@/lib/harness/types';

function area(): ModuleArea {
  return {
    id: 'a', moduleId: 'arpg-combat' as never, label: 'A', description: '',
    checklistItemIds: [], featureNames: [], dependsOn: [], status: 'in-progress', features: [],
  };
}

// ── unverifiable UE compile gate (NEVER a silent pass) ──────────────────────
// The commandless compile gate runs NO process, so this exercises the real
// verify() path without ever spawning UE.

describe('verify — UE compile gate with no env is unverifiable, not a pass', () => {
  it('reports unverifiable + a required failure (the area is not self-certified)', async () => {
    const gates: VerificationGate[] = [{ name: 'ue-compile', type: 'ue-compile', required: true }];
    const report = await verify(area(), 1, 'C:/proj', gates, undefined);
    const g = report.gates[0];
    expect(g.unverifiable).toBe(true);
    expect(g.passed).toBe(false);
    expect(report.requiredFailures).toBe(1);
    expect(report.allPassed).toBe(false);
    expect(g.output).toMatch(/UNVERIFIABLE/i);
  });

  it('formatVerificationSummary labels an unverifiable gate distinctly', () => {
    const summary = formatVerificationSummary({
      iteration: 1, areaId: 'a', timestamp: '', allPassed: false, requiredFailures: 1,
      gates: [{ gate: 'ue-compile', passed: false, unverifiable: true, output: 'x', durationMs: 0 }],
    });
    expect(summary).toContain('UNVERIFIABLE');
  });
});

// ── self-heal with no verify command → healed:false + reason ────────────────
// Early-returns before spawning any session, so this is safe to run.

describe('attemptSelfHeal — no verify command', () => {
  it('refuses to claim a repair it cannot confirm', async () => {
    const res = await attemptSelfHeal('C:/proj', ['some error'], null, {
      sessionTimeoutMs: 1000, skipPermissions: true,
    });
    expect(res.healed).toBe(false);
    expect(res.reason).toMatch(/no verify command/i);
  });
});
