/**
 * Defence grading bands of the GAS Balance Health report, re-derived against the
 * CANON armour soft-cap `armour/(armour + 5·hit)`.
 *
 * The retired bands (0.08 / 0.30 / 0.45) were bare mitigation percentages
 * calibrated against `armour/(armour+100)`, a curve that no longer exists. The
 * canon curve has no hit-independent mitigation percentage at all, so the bands
 * are now stated as an armour:hit RATIO and every boundary is pinned here — a
 * future formula change fails loudly instead of silently re-grading builds.
 */
import { describe, it, expect } from 'vitest';
import {
  buildBalanceHealthReport,
  ARMOUR_HIT_RATIO_BANDS,
  mitigationAtRatio,
  armourHitRatio,
  ehpMultiplierAtRatio,
  defenceBand,
  defenceScore,
} from '@/components/modules/core-engine/sub_ability/gas-balance/balanceHealth';
import { SCENARIO_PRESETS } from '@/components/modules/core-engine/sub_ability/gas-balance/data';
import {
  runSimulation,
  GAS_SIM_DEFAULT_SEED,
} from '@/components/modules/core-engine/sub_ability/gas-balance/simulation';
import type {
  SimResults,
  SimScenario,
} from '@/components/modules/core-engine/sub_ability/gas-balance/data';

/** Minimal SimResults whose only interesting axis is the defence measurement. */
function resultsAtRatio(ratio: number, refHit = 40): SimResults {
  const iterations = Array.from({ length: 40 }, () => ({
    ttk: 4, totalDamage: 400, totalHits: 8, critHits: 1,
    overkill: 10, playerSurvived: true, playerHpRemaining: 300,
  }));
  return {
    scenarioId: 'synthetic',
    iterations,
    ttkStats: { mean: 4, median: 4, p10: 4, p90: 4, min: 4, max: 4, stdDev: 1.4 },
    dpsStats: { mean: 100, median: 100, min: 100, max: 100 },
    critRate: 0.15,
    survivalRate: 0.7,
    effectiveHp: 500 * (1 + ratio / 5),
    armorMitigation: mitigationAtRatio(ratio),
    armorRefHit: refHit,
    seed: 1,
    timestamp: 0,
  };
}

const SCENARIO: SimScenario = {
  ...SCENARIO_PRESETS[0],
  iterations: 40,
};

function defenceOf(ratio: number, refHit = 40) {
  const report = buildBalanceHealthReport(resultsAtRatio(ratio, refHit), SCENARIO);
  const finding = report.findings.find(f => f.id === 'defense');
  expect(finding).toBeDefined();
  return finding!;
}

describe('canon armour soft-cap algebra', () => {
  it('mitigation and ratio are exact inverses through the canon coefficient 5', () => {
    for (const r of [0.25, 0.5, 1, 2.5, 5, 10, 20]) {
      expect(armourHitRatio(mitigationAtRatio(r))).toBeCloseTo(r, 9);
    }
    // The three band anchors, spelled out.
    expect(mitigationAtRatio(1)).toBeCloseTo(1 / 6, 9);        // 16.7%
    expect(mitigationAtRatio(2.5)).toBeCloseTo(1 / 3, 9);      // 33.3%
    expect(mitigationAtRatio(10)).toBeCloseTo(2 / 3, 9);       // 66.7%
    expect(ehpMultiplierAtRatio(1)).toBeCloseTo(1.2, 9);       // +20% EHP
    expect(ehpMultiplierAtRatio(2.5)).toBeCloseTo(1.5, 9);     // +50% EHP
    expect(ehpMultiplierAtRatio(10)).toBeCloseTo(3, 9);        // ×3 EHP
  });

  it('degenerate inputs do not produce NaN/Infinity verdicts', () => {
    expect(mitigationAtRatio(0)).toBe(0);
    expect(mitigationAtRatio(-5)).toBe(0);
    expect(armourHitRatio(0)).toBe(0);
    expect(armourHitRatio(-0.2)).toBe(0);
    expect(armourHitRatio(1)).toBe(Infinity);
    expect(defenceBand(0)).toBe('weak');
    expect(defenceBand(1)).toBe('dominant');
  });
});

describe('defence band boundaries are pinned', () => {
  const { weak, dominant } = ARMOUR_HIT_RATIO_BANDS;

  it('weak boundary: armour rating = one raw hit', () => {
    expect(weak).toBe(1);
    expect(defenceBand(mitigationAtRatio(weak - 0.001))).toBe('weak');
    expect(defenceBand(mitigationAtRatio(weak))).toBe('healthy');
    expect(defenceBand(mitigationAtRatio(weak + 0.001))).toBe('healthy');
  });

  it('dominant boundary: armour alone triples effective health', () => {
    expect(dominant).toBe(10);
    expect(defenceBand(mitigationAtRatio(dominant - 0.001))).toBe('healthy');
    expect(defenceBand(mitigationAtRatio(dominant))).toBe('dominant');
    expect(defenceBand(mitigationAtRatio(dominant + 0.001))).toBe('dominant');
  });

  it('each band produces its own finding severity', () => {
    expect(defenceOf(0.5).severity).toBe('warning');    // weak
    expect(defenceOf(0.5).title).toMatch(/barely/i);
    expect(defenceOf(2.5).severity).toBe('good');       // target
    expect(defenceOf(2.5).title).toMatch(/pulls its weight/i);
    expect(defenceOf(20).severity).toBe('warning');     // dominant
    expect(defenceOf(20).title).toMatch(/dominates/i);
  });

  it('scores the derivation: 100 at target, 50 at the weak edge, 0 at the dominant edge', () => {
    const at = (ratio: number) => defenceScore(mitigationAtRatio(ratio));
    expect(at(ARMOUR_HIT_RATIO_BANDS.target)).toBe(100);
    expect(at(ARMOUR_HIT_RATIO_BANDS.weak)).toBe(50);
    expect(at(ARMOUR_HIT_RATIO_BANDS.dominant)).toBe(0);
    expect(at(0)).toBe(0);                       // no armour at all
    expect(at(0.5)).toBe(27);                    // the default scenario's build
    // …and the score moves monotonically toward the target from either side.
    expect(at(0.25)).toBeLessThan(at(1));
    expect(at(20)).toBeLessThan(at(5));
  });
});

describe('the bands survive the reference hit changing', () => {
  it('same armour:hit ratio grades identically against a 40- and a 240-damage hit', () => {
    for (const ratio of [0.5, 1.5, 12]) {
      const small = defenceOf(ratio, 40);
      const big = defenceOf(ratio, 240);
      expect(big.severity).toBe(small.severity);
      expect(big.title).toBe(small.title);
    }
  });

  it('every rendered number names the reference hit it is quoted against', () => {
    const f = defenceOf(0.5, 240);
    expect(f.narrative).toContain('240-damage reference hit');
    expect(f.anchor?.label).toContain('240');
    expect(f.suggestion).toContain('240');
    // …and the corrective target is the ratio applied to THAT hit: 2.5 × 240 = 600.
    expect(f.suggestion).toContain('600');
  });

  it('with no incoming hit, defence is reported as ungradable and excluded from the score', () => {
    const noHit = { ...resultsAtRatio(0), armorRefHit: 0 };
    const report = buildBalanceHealthReport(noHit, SCENARIO);
    const f = report.findings.find(x => x.id === 'defense')!;
    expect(f.severity).toBe('info');
    expect(f.title).toMatch(/could not be graded/i);
    // Excluded, not scored 0: the same run WITH a hit at zero armour scores lower.
    expect(report.score).toBeGreaterThan(buildBalanceHealthReport(resultsAtRatio(0), SCENARIO).score);
  });
});

describe('MEASURED — the default scenario under the re-derived bands', () => {
  it('armour 20 vs the 40-damage reference hit reads WEAK, and honestly so', () => {
    const r = runSimulation(SCENARIO, GAS_SIM_DEFAULT_SEED);
    expect(r.armorRefHit).toBeCloseTo(40, 6);
    expect(r.armorMitigation).toBeCloseTo(0.0909, 4);
    // ratio 0.5 — half a hit of armour, worth +10% effective health.
    expect(armourHitRatio(r.armorMitigation)).toBeCloseTo(0.5, 6);
    expect(ehpMultiplierAtRatio(armourHitRatio(r.armorMitigation))).toBeCloseTo(1.1, 6);
    expect(defenceBand(r.armorMitigation)).toBe('weak');

    const f = buildBalanceHealthReport(r, SCENARIO).findings.find(x => x.id === 'defense')!;
    expect(f.severity).toBe('warning');
    expect(f.narrative).toContain('40-damage reference hit');
    // The retired bands called 9.09% "good" (it cleared their 8% floor). The
    // re-derived bands say weak — the recalibration is HARSHER here, not kinder.
    expect(0.0909).toBeGreaterThan(0.08);
  });
});
