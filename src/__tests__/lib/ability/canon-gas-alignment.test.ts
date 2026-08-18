import { describe, it, expect } from 'vitest';
import {
  armorMitigation, legacyArmorMitigation, scaleAndMitigate, rollAbilityHit,
  calculateDamage, effectiveHpVsHit, rawScaledHit, CRIT_CHANCE_CAP, RESIST_CAP,
} from '@/lib/ability/damage-formula';
import { armourReduction, computeHit } from '@/lib/combat/canon-kernel';
import { runSimulation, referenceIncomingHit, GAS_SIM_DEFAULT_SEED } from '@/components/modules/core-engine/sub_ability/gas-balance/simulation';
import { SCENARIO_PRESETS } from '@/components/modules/core-engine/sub_ability/gas-balance/data';

/**
 * The GAS/ability sim was migrated onto the canon kernel on 2026-08-18. These tests
 * pin the three things the migration is FOR: the canon caps actually bind, the
 * armour curve is the hit-size soft-cap (not the retired `armor/(armor+100)`), and
 * the run is reproducible. Each canon assertion below fails against the legacy model.
 */

describe('GAS damage routes through the canon kernel', () => {
  it('uses the canon armour soft-cap, not the legacy armor/(armor+100) curve', () => {
    // Canon mitigation depends on the HIT SIZE; the legacy curve did not.
    expect(armorMitigation(100, 40)).toBeCloseTo(armourReduction(100, 40), 10);
    expect(armorMitigation(100, 40)).toBeCloseTo(100 / (100 + 5 * 40), 10); // 0.3333
    expect(armorMitigation(100, 200)).toBeCloseTo(100 / (100 + 1000), 10);  // 0.0909
    // The legacy curve is hit-independent — that is exactly the divergence removed.
    expect(legacyArmorMitigation(100)).toBeCloseTo(0.5, 10);
    expect(armorMitigation(100, 40)).not.toBeCloseTo(legacyArmorMitigation(100), 3);
  });

  it('mitigates a scaled hit identically to computeHit()', () => {
    const kernel = computeHit({ buckets: { Physical: { base: rawScaledHit(50, 100) } } }, { armour: 50 });
    expect(scaleAndMitigate(50, 100, 50)).toBeCloseTo(kernel.total, 10);
  });

  it('binds the 95% crit-chance cap (legacy had NO cap)', () => {
    // A 100%-crit attacker still crits only 95% of the time under canon.
    const rng = mkCycle([0.9, 0.96, 0.5, 0.99]);
    const outcomes = [0, 0, 0, 0].map(() => rollAbilityHit(50, 0, { armor: 0 }, 1, 2, rng).isCrit);
    expect(outcomes).toEqual([true, false, true, false]);
    expect(CRIT_CHANCE_CAP).toBe(0.95);

    // Expected-value preview is capped too: 100% crit chance ≠ a full crit.
    const full = calculateDamage(100, 0, 0, 100, 2);
    const alwaysCrit = calculateDamage(100, 0, 0, 95, 2);
    expect(full).toBeCloseTo(alwaysCrit, 10);
    expect(full).toBeLessThan(200); // legacy: 100 * (1 + 1.0*(2-1)) = 200
    expect(full).toBeCloseTo(195, 10);
  });

  it('binds the 75% resist cap (legacy had no resist path at all)', () => {
    expect(RESIST_CAP).toBe(0.75);
    // A 90%-resist target still takes 25% — the cap is the applied ceiling.
    expect(scaleAndMitigate(100, 0, 0, { type: 'Fire', resist: 0.9 })).toBeCloseTo(25, 10);
    expect(scaleAndMitigate(100, 0, 0, { type: 'Fire', resist: 0.75 })).toBeCloseTo(25, 10);
    expect(scaleAndMitigate(100, 0, 0, { type: 'Fire', resist: 0.5 })).toBeCloseTo(50, 10);
  });

  it('derives EHP from the kernel against a reference hit', () => {
    const refHit = 40;
    const mit = armorMitigation(20, refHit);
    expect(effectiveHpVsHit(500, 20, refHit)).toBeCloseTo(500 / (1 - mit), 6);
  });
});

describe('GAS Monte-Carlo simulation', () => {
  const preset = SCENARIO_PRESETS[0]; // "Trash Pack (3x Skeletons)" — the default scenario
  const scenario = { ...preset, iterations: 400 };

  it('is reproducible: same scenario + seed → identical results', () => {
    const a = runSimulation(scenario, 1234);
    const b = runSimulation(scenario, 1234);
    expect(a.dpsStats.mean).toBe(b.dpsStats.mean);
    expect(a.ttkStats.mean).toBe(b.ttkStats.mean);
    expect(a.critRate).toBe(b.critRate);
    // …and a different seed is a genuinely different stream.
    expect(runSimulation(scenario, 4321).dpsStats.mean).not.toBe(a.dpsStats.mean);
  });

  it('reports the reference hit its mitigation/EHP are measured against', () => {
    const r = runSimulation(scenario, GAS_SIM_DEFAULT_SEED);
    // Skeleton: baseDamage 25, attackPower 30 + str 15*2 = 60 → raw 25 * 1.6 = 40
    expect(referenceIncomingHit(scenario.enemies)).toBeCloseTo(40, 6);
    expect(r.armorRefHit).toBeCloseTo(40, 6);
    expect(r.seed).toBe(GAS_SIM_DEFAULT_SEED);
  });

  it('MEASURED SHIFT — canon vs the retired model on the default stat block', () => {
    const r = runSimulation(scenario, GAS_SIM_DEFAULT_SEED);
    const armor = scenario.player.armor;   // 20
    const hp = scenario.player.maxHealth;  // 500

    // BEFORE (legacy armor/(armor+100)):  mit 16.67%, EHP 600
    const legacyMit = legacyArmorMitigation(armor);
    const legacyEhp = hp / (1 - legacyMit);
    expect(legacyMit).toBeCloseTo(0.1667, 4);
    expect(legacyEhp).toBeCloseTo(600, 0);

    // AFTER (canon soft-cap vs the 40-damage average enemy hit): mit 9.09%, EHP 550
    expect(r.armorMitigation).toBeCloseTo(0.0909, 4);
    expect(r.effectiveHp).toBeCloseTo(550, 0);

    // Mean DPS over the same seeded stream: 164.43 (legacy) -> 178.04 (canon), +8.3%.
    // TTK is unchanged (3.83s) because the kill still lands on the same 0.05s tick.
    expect(r.dpsStats.mean).toBeCloseTo(178.04, 1);
    expect(r.ttkStats.mean).toBeCloseTo(3.829, 2);
    expect(r.critRate).toBeCloseTo(0.1603, 3);
    expect(r.survivalRate).toBe(1);
  });

  it('MEASURED SHIFT — per-hit expected damage, canon vs the retired model', () => {
    const p = scenario.player;          // baseDamage 50, atkPow 70 + str 30*2 = 130
    const skeleton = scenario.enemies[0].stats;

    // Player -> skeleton (armor 10). Legacy applied crit AFTER armour as a flat
    // expected multiplier; canon crits the RAW hit, which armour then mitigates less.
    const canonOut = calculateDamage(p.baseDamage, p.attackPower + p.strength * 2, skeleton.armor,
      p.criticalChance * 100, p.criticalDamage);
    const legacyOut = legacyExpected(p.baseDamage, p.attackPower + p.strength * 2, skeleton.armor,
      p.criticalChance, p.criticalDamage);
    expect(legacyOut).toBeCloseTo(112.42, 1);
    expect(canonOut).toBeCloseTo(121.65, 1);

    // Skeleton -> player (armor 20).
    const canonIn = calculateDamage(skeleton.baseDamage, skeleton.attackPower + skeleton.strength * 2,
      p.armor, skeleton.criticalChance * 100, skeleton.criticalDamage);
    const legacyIn = legacyExpected(skeleton.baseDamage, skeleton.attackPower + skeleton.strength * 2,
      p.armor, skeleton.criticalChance, skeleton.criticalDamage);
    expect(legacyIn).toBeCloseTo(34.17, 1);
    expect(canonIn).toBeCloseTo(37.36, 1);
  });
});

/** The RETIRED pre-canon expected-damage model, reproduced here only to measure the shift. */
function legacyExpected(base: number, power: number, armor: number, critChance: number, critMult: number): number {
  const afterArmor = base * (1 + power / 100) * (1 - legacyArmorMitigation(armor));
  return afterArmor * (1 + critChance * (critMult - 1));
}

/** Deterministic rng stub cycling a fixed list of draws. */
function mkCycle(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}
