import { describe, it, expect } from 'vitest';
import {
  initialTunerState,
  tunerReducer,
  tunedSummary,
  rosterFindings,
  type TunerState,
} from '@/components/modules/core-engine/sub_loot/_shared/bindingTuner';
import { computeExpectedValue, lintLootEconomy, lootTierOf } from '@/lib/loot/economy';
import { DEFAULT_ENEMY_LOOT_BINDINGS } from '@/components/modules/core-engine/sub_loot/_shared/data-binding';

// Tune an enemy's drops to a gold target: the pure reducer behind the Core-tab
// tuner. Goal-seek reuses the closed-form solver, lint runs against same-tier
// peers (the UNTUNED tier), and undo walks the history back.

const byId = (s: TunerState, id: string, from: 'bindings' | 'baseline' = 'bindings') =>
  s[from].find((b) => b.archetypeId === id)!;

const nonOk = (findings: Record<string, { severity: string }[]>) =>
  Object.entries(findings).filter(([, f]) => f.some((x) => x.severity !== 'ok')).map(([id]) => id);

describe('bindingTuner reducer', () => {
  it('goal-seeks Melee Grunt to 30 gold per kill and keeps the baseline untouched', () => {
    const s = tunerReducer(initialTunerState(DEFAULT_ENEMY_LOOT_BINDINGS), { type: 'goalSeek', id: 'MeleeGrunt', targetEV: 30 });
    const tuned = byId(s, 'MeleeGrunt');
    expect(tuned.rarityWeights).toEqual([59, 24, 10, 4, 3]);
    expect(computeExpectedValue(tuned)).toBe(30);
    expect(byId(s, 'MeleeGrunt', 'baseline').rarityWeights).toEqual([60, 25, 10, 4, 1]);
  });

  it('summarises the tune as an EV delta with the changed fields', () => {
    const s = tunerReducer(initialTunerState(DEFAULT_ENEMY_LOOT_BINDINGS), { type: 'goalSeek', id: 'MeleeGrunt', targetEV: 30 });
    expect(tunedSummary(s, 'MeleeGrunt')).toEqual({ evBefore: 24, evAfter: 30, delta: 6, changed: ['rarityWeights'] });
  });

  it('lints against same-tier peers: quiet on the shipped roster, fires on a real outlier', () => {
    const s0 = initialTunerState(DEFAULT_ENEMY_LOOT_BINDINGS);
    expect(DEFAULT_ENEMY_LOOT_BINDINGS).toHaveLength(22);
    expect(nonOk(rosterFindings(s0))).toEqual([]);
    // The old caller shape (whole roster as peers) flags 11 of 22 on the same data.
    const rosterWide = DEFAULT_ENEMY_LOOT_BINDINGS.filter((b) =>
      lintLootEconomy(b, DEFAULT_ENEMY_LOOT_BINDINGS).some((f) => f.severity !== 'ok'));
    expect(rosterWide).toHaveLength(11);

    const s1 = tunerReducer(s0, { type: 'setField', id: 'MeleeGrunt', field: 'bonusGold', value: 200 });
    expect(rosterFindings(s1).MeleeGrunt.map((f) => f.rule)).toContain('ev-outlier-high');
  });

  it('keeps the peer group of the untuned tier when drop chance moves the binding across a tier line', () => {
    const s0 = initialTunerState(DEFAULT_ENEMY_LOOT_BINDINGS);
    expect(lootTierOf(0.3)).toBe('Minion');
    const s1 = tunerReducer(s0, { type: 'setField', id: 'MeleeGrunt', field: 'dropChance', value: 1 });
    expect(lootTierOf(byId(s1, 'MeleeGrunt').dropChance)).toBe('Boss');
    // Linted against Minion peers (EV 45 vs minion median 17 = high), not Boss peers (which would say low).
    expect(rosterFindings(s1).MeleeGrunt.map((f) => f.rule)).toContain('ev-outlier-high');
  });

  it('undo reverts the goal-seek; undo with an empty history returns the same state', () => {
    const s0 = initialTunerState(DEFAULT_ENEMY_LOOT_BINDINGS);
    const s1 = tunerReducer(s0, { type: 'goalSeek', id: 'MeleeGrunt', targetEV: 30 });
    const s2 = tunerReducer(s1, { type: 'undo' });
    expect(byId(s2, 'MeleeGrunt').rarityWeights).toEqual([60, 25, 10, 4, 1]);
    expect(tunerReducer(s0, { type: 'undo' })).toBe(s0);
  });

  it('goal-seek and the summary read the one editable gold table in the state', () => {
    const s0 = tunerReducer(initialTunerState(DEFAULT_ENEMY_LOOT_BINDINGS), { type: 'setGold', rarity: 'Rare', value: 100 });
    expect(s0.rarityGold.Rare).toBe(100);
    const s1 = tunerReducer(s0, { type: 'goalSeek', id: 'MeleeGrunt', targetEV: 30 });
    expect(computeExpectedValue(byId(s1, 'MeleeGrunt'), s1.rarityGold)).toBe(30);
    expect(tunedSummary(s1, 'MeleeGrunt')!.evAfter).toBe(30);
  });
});
