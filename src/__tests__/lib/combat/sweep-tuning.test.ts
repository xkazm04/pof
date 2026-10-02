import { describe, it, expect } from 'vitest';
import {
  runPredictiveBalance,
  DEFAULT_PREDICTIVE_CONFIG,
  type BalanceReport,
  type CanonCheckStatus,
  type HeatmapCell,
  type PredictiveBalanceConfig,
} from '@/lib/combat/predictive-balance';
import { HARDCODED_ENEMY_SOURCE } from '@/lib/combat/simulation-engine';
import { ENEMY_ARCHETYPE_BY_ID } from '@/lib/combat/definitions';
import {
  COMBAT_TUNING_LEVERS,
  solveCellTuning,
  diffSweeps,
  type CellSolveResult,
} from '@/lib/combat/sweep-tuning';

// Tune from the heatmap: solve ONE cell's lever to a target survival on the
// sweep's own yielding job, refuse honestly (unreachable / non-monotonic), and
// diff two sweeps cell by cell. Literal values measured on the one-kernel sweep
// (character-simulator/A) at DEFAULT_PREDICTIVE_CONFIG (200 iterations).

const D = DEFAULT_PREDICTIVE_CONFIG;
const FIXTURES = { registry: ENEMY_ARCHETYPE_BY_ID, provenance: HARDCODED_ENEMY_SOURCE };
const KNIGHT_LV10 = { level: 10, encounterIndex: 3 };
const GRUNTS_LV10 = { level: 10, encounterIndex: 0 };

function solved(r: Awaited<ReturnType<typeof solveCellTuning>>): CellSolveResult {
  if ('aborted' in r && r.aborted) throw new Error('unexpected abort');
  return r as CellSolveResult;
}

describe('solveCellTuning — one cell, one lever, on the sweep job', () => {
  it('solves Enemy HP at Lv.10 vs 1x Hollow Knight to 80% within the iteration grid, and the full sweep reproduces it', async () => {
    const evals: number[] = [];
    const r = solved(await solveCellTuning(D, FIXTURES, KNIGHT_LV10, 'enemyHealthMul', 0.8, {
      onEval: (k) => { evals.push(k); },
    }));

    expect(r.applicable).toBe(true);
    expect(r.converged).toBe(true);
    expect(Math.abs(r.achieved! - 0.8)).toBeLessThanOrEqual(1 / D.iterations + 1e-9);
    expect(r.solvedValue).toBeCloseTo(3.986, 3);
    // One onEval per engine evaluation, counting up from 1.
    expect(evals).toEqual(Array.from({ length: r.evals }, (_, i) => i + 1));

    const full = runPredictiveBalance({ ...D, tuning: { ...D.tuning, enemyHealthMul: r.solvedValue! } });
    const cell = full.heatmap.find((c) => c.playerLevel === 10 && c.encounterIndex === 3);
    expect(cell?.survivalRate).toBe(r.achieved);
  });

  it('yields between evaluations and aborts with no value when its signal fires', async () => {
    let timerFired = false;
    setTimeout(() => { timerFired = true; }, 0);
    const ac = new AbortController();
    const seen: number[] = [];
    const r = await solveCellTuning(D, FIXTURES, KNIGHT_LV10, 'enemyHealthMul', 0.8, {
      signal: ac.signal,
      onEval: (k) => { seen.push(k); if (k === 2) ac.abort(); },
    });
    expect(r).toEqual({ aborted: true });
    expect(seen).toEqual([1, 2]);
    expect(timerFired).toBe(true);
  });

  it('refuses an unreachable target, naming the achievable range', async () => {
    const r = solved(await solveCellTuning(D, FIXTURES, KNIGHT_LV10, 'playerHealthMul', 0.8));
    expect(r.converged).toBe(false);
    expect(r.applicable).toBe(false);
    expect(r.solvedValue).toBeNull();
    expect(r.reason).toContain('[100%, 100%]');
  });

  it('sweeps before solving: a non-monotonic lever is refused after the 5-point pre-sweep', async () => {
    // Lv.10 vs 3x Forest Grunt, Enemy damage over [0.5, 8]: 100, 99, 62, 22, 28 %.
    const r = solved(await solveCellTuning(D, FIXTURES, GRUNTS_LV10, 'enemyDamageMul', 0.5));
    expect(r.applicable).toBe(false);
    expect(r.converged).toBe(false);
    expect(r.evals).toBe(5);
    expect(r.reason).toContain('not monotonic over [0.5, 8]');
  });

  it('every TuningOverrides multiplier is a lever with a label and a range', () => {
    expect(COMBAT_TUNING_LEVERS.map((l) => l.lever).sort()).toEqual(Object.keys(D.tuning).sort());
    for (const l of COMBAT_TUNING_LEVERS) {
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.range[0]).toBeLessThan(l.range[1]);
    }
  });
});

// ── diffSweeps ───────────────────────────────────────────────────────────────

const cell = (level: number, encounterIndex: number, survivalRate: number, avgTTK: number): HeatmapCell => ({
  playerLevel: level, enemyLabel: `E${encounterIndex}`, encounterIndex,
  survivalRate, avgTTK, avgDPS: 10, avgEHP: 100, biggestHit: 10,
});
const check = (lawId: string, status: CanonCheckStatus['status']): CanonCheckStatus => ({
  lawId, law: lawId, status, allowed: '-',
});
const report = (over: Partial<BalanceReport>): BalanceReport => ({
  summary: '', heatmap: [], survivalCurves: {}, dpsBreakdowns: {}, sensitivity: [], alerts: [],
  enemySource: HARDCODED_ENEMY_SOURCE, canonChecks: [], durationMs: 0,
  levels: [1, 4], encounters: [{ index: 0, label: 'E0', archetypeId: 'a' }, { index: 1, label: 'E1', archetypeId: 'b' }],
  midLevel: 1,
  ...over,
});

describe('diffSweeps', () => {
  it('reports per-cell deltas, alert churn and canon status flips', () => {
    const base = report({
      heatmap: [cell(1, 0, 1, 2), cell(4, 0, 1, 3), cell(1, 1, 0.9, 5)],
      alerts: [
        { severity: 'warning', message: 'easy A' },
        { severity: 'warning', message: 'kept' },
      ],
      canonChecks: [check('arpg-defenses', 'pass'), check('arpg-resists', 'not-evaluated')],
    });
    const next = report({
      heatmap: [cell(1, 0, 0.8, 4), cell(4, 0, 1, 3), cell(4, 1, 0.5, 9)],
      alerts: [
        { severity: 'warning', message: 'kept' },
        { severity: 'critical', message: 'hard B' },
      ],
      canonChecks: [check('arpg-defenses', 'violation'), check('arpg-resists', 'not-evaluated')],
    });

    const diff = diffSweeps(base, next);
    // Only cells present in both runs: (1,0) and (4,0).
    expect(diff.cells).toHaveLength(2);
    const c10 = diff.cells.find((c) => c.level === 1 && c.encounterIndex === 0)!;
    expect(c10.survivalDelta).toBeCloseTo(-0.2, 10);
    expect(c10.ttkDelta).toBeCloseTo(2, 10);
    const c40 = diff.cells.find((c) => c.level === 4 && c.encounterIndex === 0)!;
    expect(c40.survivalDelta).toBe(0);
    expect(c40.ttkDelta).toBe(0);

    expect(diff.alertsAdded.map((a) => a.message)).toEqual(['hard B']);
    expect(diff.alertsRemoved.map((a) => a.message)).toEqual(['easy A']);
    expect(diff.canonFlips).toEqual([
      expect.objectContaining({ lawId: 'arpg-defenses', from: 'pass', to: 'violation' }),
    ]);
  });

  it('an unchanged run reports no diff (all deltas 0)', () => {
    const small: PredictiveBalanceConfig = {
      ...D, levelRange: [4, 10], iterations: 40, sensitivityAttributes: [],
    };
    const a = runPredictiveBalance(small);
    const b = runPredictiveBalance(small);
    const diff = diffSweeps(a, b);
    expect(diff.cells).toHaveLength(a.heatmap.length);
    for (const c of diff.cells) {
      expect(c.survivalDelta).toBe(0);
      expect(c.ttkDelta).toBe(0);
    }
    expect(diff.alertsAdded).toEqual([]);
    expect(diff.alertsRemoved).toEqual([]);
    expect(diff.canonFlips).toEqual([]);
  });
});
