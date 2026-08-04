import { describe, it, expect } from 'vitest';
import {
  readinessOf,
  readinessCode,
  readinessLabel,
  atOrAbove,
  rank,
  LADDER,
  RAMP,
  READINESS_NAME,
  READINESS_MEANING,
  type ReadinessLevel,
} from '@/lib/status/readiness';
import type { StepCell, CellGrade } from '@/lib/status/statusModel';

/** Minimal cell factory — only the fields readiness reads. */
function cell(grade: CellGrade, extra: Partial<StepCell> = {}): StepCell {
  return {
    label: 'S',
    engine: 'Claude',
    grade,
    counts: { pass: 0, deferred: 0, fail: 0, pending: 0 },
    ...extra,
  };
}

describe('readinessOf — every grade lands on exactly one rung', () => {
  const cases: Array<[CellGrade, ReadinessLevel]> = [
    ['unwired', 'R0'],
    ['unpowered', 'R1'],
    ['pending', 'R1'],
    ['ungated', 'R2'],
    ['trusted', 'R3'],
    ['verified', 'R4'],
  ];

  for (const [grade, level] of cases) {
    it(`${grade} → ${level} reached`, () => {
      const r = readinessOf(cell(grade));
      expect(r.level).toBe(level);
      expect(r.state).toBe('reached');
      expect(r.because.length).toBeGreaterThan(0);
    });
  }
});

describe('waiting — a declared-but-unrun gate is never progress', () => {
  it('deferred sits at R4 but in the waiting state, not reached', () => {
    const r = readinessOf(cell('deferred', { tier: 'L4' }));
    expect(r.level).toBe('R4');
    expect(r.state).toBe('waiting');
  });

  it('is coded with the waiting glyph so it survives greyscale', () => {
    expect(readinessCode(readinessOf(cell('deferred')))).toBe('R4⋯');
  });

  it('a deferred cell claiming L4 does NOT read as a reached R4', () => {
    // This is the exact defect the old tier stripe created: tier L4 painted the same
    // green as a passed gate. Waiting must never equal reached at the same rung.
    const waiting = readinessOf(cell('deferred', { tier: 'L4' }));
    const reached = readinessOf(cell('verified', { tier: 'L4' }));
    expect(waiting.level).toBe(reached.level);
    expect(waiting.state).not.toBe(reached.state);
  });
});

describe('blocked — a failure is a state, not a rung', () => {
  it('attention with nothing passing sits at R1, blocked', () => {
    const r = readinessOf(cell('attention', { counts: { pass: 0, deferred: 0, fail: 1, pending: 0 } }));
    expect(r.level).toBe('R1');
    expect(r.state).toBe('blocked');
  });

  it('a judge-fail over a meaningful passing checker keeps the R3 it earned', () => {
    const r = readinessOf(
      cell('attention', { counts: { pass: 1, deferred: 0, fail: 0, pending: 0 }, checkerMeaningful: true }),
    );
    expect(r.level).toBe('R3');
    expect(r.state).toBe('blocked');
  });

  it('a judge-fail over a shape-only checker drops to R2', () => {
    const r = readinessOf(
      cell('attention', { counts: { pass: 1, deferred: 0, fail: 0, pending: 0 }, checkerMeaningful: false }),
    );
    expect(r.level).toBe('R2');
  });

  it('is coded with the blocked glyph', () => {
    expect(readinessCode(readinessOf(cell('attention')))).toContain('✕');
  });
});

describe('R5 — the only rung that means production', () => {
  it('verified + UE-proven realization reaches R5', () => {
    const r = readinessOf(
      cell('verified', { realization: { browser: 'no', ue: 'proven', note: 'walked in PIE' } }),
    );
    expect(r.level).toBe('R5');
    expect(r.state).toBe('reached');
  });

  it('verified with UE merely probable stays at R4', () => {
    const r = readinessOf(
      cell('verified', { realization: { browser: 'proven', ue: 'probable', note: 'path exists' } }),
    );
    expect(r.level).toBe('R4');
  });

  it('UE-proven does NOT lift a cell that never earned R4', () => {
    // Realization is evidence that output RUNS, not that it is good. It may only add the
    // final rung on top of a gate/judge pass — never rescue an ungated or blocked cell.
    const r = readinessOf(
      cell('ungated', { realization: { browser: 'proven', ue: 'proven', note: 'runs' } }),
    );
    expect(r.level).toBe('R2');
  });

  it('a blocked cell stays blocked even when UE-proven', () => {
    const r = readinessOf(
      cell('attention', {
        counts: { pass: 1, deferred: 0, fail: 0, pending: 0 },
        realization: { browser: 'proven', ue: 'proven', note: 'runs but judged bad' },
      }),
    );
    expect(r.state).toBe('blocked');
  });
});

describe('the ladder is monotone — the invariant the whole consolidation rests on', () => {
  it('RAMP covers every rung exactly once, in ladder order', () => {
    expect(Object.keys(RAMP)).toEqual([...LADDER]);
  });

  it('fill weight never decreases as the ladder climbs within a colour family', () => {
    // Green is reserved for R4+, so weight is compared within each token family; across
    // the R3→R4 boundary the HUE carries the step up, not the alpha.
    const byToken = new Map<string, number[]>();
    for (const level of LADDER) {
      const { token, fill } = RAMP[level];
      byToken.set(token, [...(byToken.get(token) ?? []), fill]);
    }
    for (const fills of byToken.values()) {
      const sorted = [...fills].sort((a, b) => a - b);
      expect(fills).toEqual(sorted);
    }
  });

  it('green is reserved for the gate-proven rungs only', () => {
    for (const level of LADDER) {
      const isGreen = RAMP[level].token.includes('--lab-ok');
      expect(isGreen).toBe(atOrAbove(level, 'R4'));
    }
  });

  it('rank is strictly increasing and atOrAbove agrees with it', () => {
    for (let i = 1; i < LADDER.length; i += 1) {
      expect(rank(LADDER[i])).toBeGreaterThan(rank(LADDER[i - 1]));
      expect(atOrAbove(LADDER[i], LADDER[i - 1])).toBe(true);
      expect(atOrAbove(LADDER[i - 1], LADDER[i])).toBe(false);
    }
  });

  it('every rung is named and explained (the legend can never render a blank)', () => {
    for (const level of LADDER) {
      expect(READINESS_NAME[level]).toBeTruthy();
      expect(READINESS_MEANING[level].length).toBeGreaterThan(20);
    }
  });
});

describe('readinessLabel', () => {
  it('speaks the rung, its name, the state and the reason', () => {
    const label = readinessLabel(readinessOf(cell('deferred')));
    expect(label).toContain('R4');
    expect(label).toContain('PROVEN');
    expect(label).toContain('waiting');
    expect(label).toContain('declared');
  });
});
