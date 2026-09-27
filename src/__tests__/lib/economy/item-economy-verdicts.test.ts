import { describe, it, expect } from 'vitest';
import {
  runItemEconomySim,
  DEFAULT_ITEM_ECON_CONFIG,
  type ItemEconomyResult,
} from '@/lib/economy/item-economy-engine';
import {
  economyVerdicts,
  summarizeRun,
  runToCoverage,
  HORIZON_LADDER,
  VERDICT_FAMILIES,
  type EconomyVerdict,
} from '@/lib/economy/item-economy-verdicts';

/**
 * Acceptance for scan-sweep --challenge card inventory-economy-simulator/B:
 * the Item Economy Simulator reports what it measured, over which agents, and
 * says UNMEASURED where its input is absent instead of passing by default
 * (registry: game-economy-tuning#rarity-inflation-and-affix-saturation-alerts).
 */

const DEFAULT_RESULT = runItemEconomySim(DEFAULT_ITEM_ECON_CONFIG);
const TEN_LEVEL_RESULT = runItemEconomySim({ ...DEFAULT_ITEM_ECON_CONFIG, maxLevel: 10 });

function byFamily(verdicts: EconomyVerdict[], family: EconomyVerdict['family']): EconomyVerdict {
  const v = verdicts.find((x) => x.family === family);
  if (!v) throw new Error(`no ${family} verdict`);
  return v;
}

describe('economyVerdicts — unmeasured is not a pass', () => {
  it('case 1: at the shipped defaults the endgame is unmeasured, not a green 0.0x', () => {
    // Today: result.rarityInflation === 0 and no alert fires for it.
    expect(DEFAULT_RESULT.rarityInflation).toBe(0);
    const verdicts = economyVerdicts(DEFAULT_RESULT);
    for (const family of ['rarity-inflation', 'rarity-obsolescence'] as const) {
      const v = byFamily(verdicts, family);
      expect(v.state).toBe('unmeasured');
      expect(v.value).toBeNull();
      expect(v.basis).toMatch(/endgame Lv22-25: 0 of 500 agents reached/);
    }
  });

  it('case 2: a 10-level cap measures the endgame and rarity inflation passes near 1.0x', () => {
    const v = byFamily(economyVerdicts(TEN_LEVEL_RESULT), 'rarity-inflation');
    expect(v.state).toBe('pass');
    expect(v.value).not.toBeNull();
    expect(v.value!).toBeGreaterThanOrEqual(0.9);
    expect(v.value!).toBeLessThanOrEqual(1.1);
    const early = /early Lv1-5: (\d+) of \d+ agents/.exec(v.basis);
    const endgame = /endgame Lv7-10: (\d+) of \d+ agents/.exec(v.basis);
    expect(early).not.toBeNull();
    expect(endgame).not.toBeNull();
    expect(Number(early![1])).toBeGreaterThan(0);
    expect(Number(endgame![1])).toBeGreaterThan(0);
  });

  it('case 3: every verdict is one of the five families with a state, basis and consequence', () => {
    for (const result of [DEFAULT_RESULT, TEN_LEVEL_RESULT]) {
      const verdicts = economyVerdicts(result);
      expect(verdicts.map((v) => v.family).sort()).toEqual([...VERDICT_FAMILIES].sort());
      for (const v of verdicts) {
        expect(['pass', 'warn', 'critical', 'unmeasured']).toContain(v.state);
        expect(v.basis.trim().length).toBeGreaterThan(0);
        expect(v.consequence.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('case 4: upgrade drought is a per-level rate, so it trips after early upgrades accumulate', () => {
    // Synthetic: every level upgrades healthily (1 per agent) except Lv6, where 100
    // agents made 20 upgrades. avgUpgrades is CUMULATIVE (large by Lv6) — the old
    // check compared that to 0.5 and so could never trip here.
    const synthetic: ItemEconomyResult = {
      ...TEN_LEVEL_RESULT,
      brackets: TEN_LEVEL_RESULT.brackets.map((b) => ({
        ...b,
        agents: 100,
        agentsReached: 100,
        gearReplacementCount: b.level === 6 ? 20 : 100,
        upgradesPerAgent: b.level === 6 ? 0.2 : 1,
        avgUpgrades: 2 * b.level,
      })),
    };
    const v = byFamily(economyVerdicts(synthetic), 'upgrade-drought');
    expect(v.state).toBe('warn');
    expect(v.value).toBeCloseTo(0.2, 5);
    expect(v.level).toBe(6);
    expect(v.threshold).toBe(0.5);
  });
});

describe('summarizeRun', () => {
  it('case 5: an unreached endgame bracket has no End Power (null, rendered as an em dash)', () => {
    const summary = summarizeRun(DEFAULT_RESULT);
    expect(summary.endgamePower).toBeNull();
    expect(summary.rarityInflation).toBeNull();
    expect(summary.peakPower).toBeGreaterThan(0);
    expect(summarizeRun(TEN_LEVEL_RESULT).endgamePower).toBeGreaterThan(0);
  });
});

describe('runToCoverage', () => {
  it('case 6: returns the SMALLEST ladder rung at which no verdict is unmeasured', () => {
    expect(HORIZON_LADDER).toEqual([80, 160, 320, 640, 1280]);
    const covered = runToCoverage(DEFAULT_ITEM_ECON_CONFIG);
    expect(covered).not.toBeNull();
    const { horizon, result, verdicts } = covered!;
    expect(horizon).toBeGreaterThan(80);
    expect(horizon).toBeLessThanOrEqual(1280);
    expect(result.config.maxHours).toBe(horizon);
    expect(result.config.seed).toBe(DEFAULT_ITEM_ECON_CONFIG.seed);
    expect(verdicts.every((v) => v.state !== 'unmeasured')).toBe(true);

    // Minimality: the rung immediately below still leaves an endgame verdict unmeasured.
    const idx = HORIZON_LADDER.indexOf(horizon);
    expect(idx).toBeGreaterThan(0);
    const below = runItemEconomySim({ ...DEFAULT_ITEM_ECON_CONFIG, maxHours: HORIZON_LADDER[idx - 1] });
    expect(economyVerdicts(below).some((v) => v.state === 'unmeasured')).toBe(true);
  }, 30_000);
});
