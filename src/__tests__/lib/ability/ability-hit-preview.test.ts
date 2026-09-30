import { describe, it, expect } from 'vitest';
import { explainAbilityHit, rankAbilitiesVsTarget } from '@/lib/ability/ability-hit-preview';
import { calculateDamage, canonDamageType } from '@/lib/ability/damage-formula';
import { seedSpellbookEntries } from '@/lib/catalog/seed-spellbook';

/**
 * Acceptance for scan-sweep --challenge card ability-spellbook-core/B: the Spellbook
 * damage sandbox answers on the canon kernel (damage-formula.ts), never the retired
 * `armor/(armor+100)` curve it rendered until this card.
 */

const ATTACKER = { power: 100, critChancePct: 15, critMult: 1.5 };

describe('explainAbilityHit — the canon hit, step by step', () => {
  it('case 1: sandbox defaults give the canon 98.37, not the retired 71.67', () => {
    const r = explainAbilityHit({ base: 50, power: 100, armor: 50, critChancePct: 15, critMult: 1.5 });
    expect(r.expected).toBeCloseTo(98.37, 2);
    expect(Math.abs(r.expected - 98.37)).toBeLessThanOrEqual(0.01);
    expect(r.nonCritMitigation).toBeCloseTo(0.0909, 4);
    expect(r.expected).not.toBeCloseTo(71.67, 1);
    expect(r.nonCritMitigation).not.toBeCloseTo(0.3333, 3);
  });

  it('case 2 [guard]: expected equals calculateDamage across an 81-point sweep', () => {
    let n = 0;
    for (const base of [20, 35, 150]) for (const armor of [0, 50, 200])
      for (const crit of [0, 15, 100]) for (const element of ['Physical', 'Fire', 'Ice']) {
        const r = explainAbilityHit({ base, power: 100, armor, critChancePct: crit, critMult: 1.5, element });
        const canon = calculateDamage(base, 100, armor, crit, 1.5, { type: canonDamageType(element) });
        expect(Math.abs(r.expected - canon)).toBeLessThan(1e-9);
        n++;
      }
    expect(n).toBe(81);
  });

  it('case 3: Fire goes through resist (capped at 75%), never armour', () => {
    const r = explainAbilityHit({ base: 35, element: 'Fire', armor: 200, resist: 0, ...ATTACKER });
    expect(r.canonType).toBe('Fire');
    expect(r.armorApplied).toBe(false);
    expect(r.nonCritMitigation).toBe(0);
    expect(r.critMitigation).toBe(0);
    expect(r.expected).toBeCloseTo(75.25, 2);

    const res = explainAbilityHit({ base: 35, element: 'Fire', armor: 200, resist: 0.9, ...ATTACKER });
    expect(res.resistApplied).toBeCloseTo(0.75, 9);
    expect(res.resistCapped).toBe(true);
    expect(res.expected).toBeCloseTo(18.81, 2);
  });

  it('case 4: crit chance 100 is applied at the 95% canon cap and flagged', () => {
    const r = explainAbilityHit({ base: 50, power: 100, armor: 200, critChancePct: 100, critMult: 1.5 });
    expect(r.critChanceApplied).toBeCloseTo(0.95, 9);
    expect(r.critCapped).toBe(true);
    expect(r.expected).toBeCloseTo(116.07, 2);
    const under = explainAbilityHit({ base: 50, power: 100, armor: 200, critChancePct: 15, critMult: 1.5 });
    expect(under.critCapped).toBe(false);
  });

  it('case 5: an element with no canon type says it fell back to Physical', () => {
    const r = explainAbilityHit({ base: 60, element: 'Shadow', armor: 50, ...ATTACKER });
    expect(r.canonType).toBe('Physical');
    expect(r.typeFallback).toBe(true);
    expect(r.mappedFrom).toBe('Shadow');
    const fire = explainAbilityHit({ base: 60, element: 'Fire', armor: 50, ...ATTACKER });
    expect(fire.typeFallback).toBe(false);
    const phys = explainAbilityHit({ base: 60, element: 'Physical', armor: 50, ...ATTACKER });
    expect(phys.typeFallback).toBe(false);
  });
});

describe('rankAbilitiesVsTarget — every damaging catalog ability vs one target', () => {
  it('case 6: 35 ranked rows, 35 excluded, Death Field first, per-mana null at 0 mana', () => {
    const entries = seedSpellbookEntries();
    expect(entries).toHaveLength(70);
    const { rows, excluded } = rankAbilitiesVsTarget(entries, { armor: 50, resist: 0 }, ATTACKER);
    expect(rows).toHaveLength(35);
    expect(excluded).toBe(35);
    expect(rows.every((r) => r.expected > 0)).toBe(true);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].expected).toBeGreaterThanOrEqual(rows[i].expected);
    expect(rows[0].name).toBe('Death Field');
    expect(rows[0].expected).toBeCloseTo(506.19, 2);
    expect(rows[0].dmgPerMana).toBeCloseTo(5.62, 2);
    expect(rows.filter((r) => r.typeFallback)).toHaveLength(11);

    const free = rankAbilitiesVsTarget(
      [{ data: { id: 'z', name: 'Free Bolt', element: 'Fire', damage: 10, manaCost: 0, cooldown: 0 } }],
      { armor: 0, resist: 0 }, ATTACKER,
    );
    expect(free.rows[0].dmgPerMana).toBeNull();
    expect(free.rows[0].hitPerCooldownSec).toBeNull();
    expect(Number.isFinite(free.rows[0].expected)).toBe(true);
  });
});
