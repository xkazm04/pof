/**
 * Tested fixes: every "Try" in the GAS Balance Health Report is a solved,
 * seeded lever. `balanceFixes.ts` runs a 5-point pre-sweep, refuses a
 * non-monotonic curve or an unreachable target with the sweep's own numbers,
 * then bisects with the shared `solveFor` on the seeded sim. `applyFix` keeps the
 * scenario inside `STAT_BOUNDS`, and `rankFixes` orders "What to try first" by the
 * measured grade change.
 */
import { describe, it, expect } from 'vitest';
import {
  solveFix, solveLever, applyFix, rankFixes,
} from '@/components/modules/core-engine/sub_ability/gas-balance/balanceFixes';
import { runSimulation } from '@/components/modules/core-engine/sub_ability/gas-balance/simulation';
import {
  SCENARIO_PRESETS, STAT_BOUNDS, encodeScenario, decodeScenario,
} from '@/components/modules/core-engine/sub_ability/gas-balance/data';
import { SURVIVAL_TARGET, difficultyBand } from '@/lib/balance/encounter-bands';

const preset = (id: string) => {
  const p = SCENARIO_PRESETS.find(s => s.id === id);
  if (!p) throw new Error(`no preset ${id}`);
  return p;
};
const BOSS = preset('boss-fight');
const TRASH = preset('trash-pack');

describe('solveFix — boss survival, player health', () => {
  const fix = solveFix(BOSS, 'survival', 'playerHealth');

  it('converges on a multiplier in [5.0, 6.5] aimed at the shared survival target', () => {
    expect(fix.converged).toBe(true);
    expect(fix.applicable).toBe(true);
    expect(fix.target).toBe(SURVIVAL_TARGET);
    expect(fix.multiplier).toBeGreaterThanOrEqual(5.0);
    expect(fix.multiplier).toBeLessThanOrEqual(6.5);
  });

  it('the applied scenario re-simulated at 2000 iterations lands in [0.60, 0.70] survival', () => {
    expect(fix.spec).not.toBeNull();
    const applied = applyFix(BOSS, fix.spec!);
    const r = runSimulation({ ...applied, iterations: 2000 });
    expect(r.survivalRate).toBeGreaterThanOrEqual(0.6);
    expect(r.survivalRate).toBeLessThanOrEqual(0.7);
  });

  it('carries a measured before/after (metric, score, grade)', () => {
    expect(fix.before.metric).toBe(0);
    expect(fix.after).not.toBeNull();
    // Lands in the fair band (the finding reads healthy), near the 65% target.
    expect(difficultyBand(fix.after!.metric)).toBe('fair');
    expect(Math.abs(fix.after!.metric - SURVIVAL_TARGET)).toBeLessThanOrEqual(0.05);
    expect(fix.scoreDelta).toBe(fix.after!.score - fix.before.score);
  });
});

describe('solveFix — boss survival, enemy damage', () => {
  it('converges on a multiplier in [0.20, 0.30]', () => {
    const fix = solveFix(BOSS, 'survival', 'enemyDamage');
    expect(fix.converged).toBe(true);
    expect(fix.multiplier).toBeGreaterThanOrEqual(0.2);
    expect(fix.multiplier).toBeLessThanOrEqual(0.3);
  });
});

describe('solveFix — refuses an unreachable target inside the range', () => {
  it('player health x1–x1.6 cannot reach the target: no Apply, and the reason names the achievable range', () => {
    const fix = solveFix(BOSS, 'survival', 'playerHealth', { range: [1, 1.6] });
    expect(fix.applicable).toBe(false);
    expect(fix.converged).toBe(false);
    expect(fix.spec).toBeNull();
    expect(fix.reason).toMatch(/achievable/i);
    expect(fix.reason).toMatch(/0%.*0%/);
    expect(fix.reason).toContain('65%');
  });
});

describe('solveLever — sweep before solve', () => {
  it('refuses a non-monotonic curve from the 5-point pre-sweep, before any bisection', () => {
    let calls = 0;
    const res = solveLever(v => { calls++; return Math.sin(v); }, 0.5, [0, 6]);
    expect(res.applicable).toBe(false);
    expect(res.converged).toBe(false);
    expect(res.reason).toContain('non-monotonic');
    expect(res.sweep).toHaveLength(5);
    expect(calls).toBe(5);
  });

  it('solves a monotonic curve with the shared bisection', () => {
    const res = solveLever(v => v * v, 9, [0, 10], { tolerance: 1e-3 });
    expect(res.applicable).toBe(true);
    expect(res.converged).toBe(true);
    expect(res.value).toBeCloseTo(3, 2);
  });
});

describe('applyFix — scales one lever inside STAT_BOUNDS', () => {
  it('trash-pack enemy health x2.5: 150 → 375, player untouched, new id, still a valid scenario', () => {
    const out = applyFix(TRASH, { lever: 'enemyHealth', multiplier: 2.5 });
    for (const e of out.enemies) expect(e.stats.maxHealth).toBe(375);
    expect(out.player).toEqual(TRASH.player);
    expect(out.id).not.toBe(TRASH.id);
    expect(decodeScenario(encodeScenario(out)).ok).toBe(true);
    // Source untouched.
    expect(TRASH.enemies[0].stats.maxHealth).toBe(150);
  });

  it('clamps to STAT_BOUNDS instead of leaving the importable envelope', () => {
    const out = applyFix(BOSS, { lever: 'playerHealth', multiplier: 1e9 });
    expect(out.player.maxHealth).toBe(STAT_BOUNDS.maxHealth.max);
    expect(decodeScenario(encodeScenario(out)).ok).toBe(true);
  });
});

describe('determinism', () => {
  it('the same solve twice returns the identical multiplier and achieved metric (seeded)', () => {
    const a = solveFix(BOSS, 'survival', 'playerHealth');
    const b = solveFix(BOSS, 'survival', 'playerHealth');
    expect(b.multiplier).toBe(a.multiplier);
    expect(b.after?.metric).toBe(a.after?.metric);
  });
});

describe('rankFixes', () => {
  it('orders by measured grade delta first, refused fixes last', () => {
    const ranked = rankFixes([
      { id: 'a', scoreDelta: 2 },
      { id: 'r', applicable: false },
      { id: 'b', scoreDelta: 15 },
    ]);
    expect(ranked.map(f => f.id)).toEqual(['b', 'a', 'r']);
  });
});
