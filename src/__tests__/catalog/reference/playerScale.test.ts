// D23 (/diablo W07): an ingested monster's stat row is CONVERTED from the reference game's scale to
// PoF's, through a declared conversion anchored on a named player on each side. The numbers here are
// synthetic — the invariants are what is pinned, never a reference value.
import { describe, it, expect } from 'vitest';
import {
  convertMonsterScale,
  diabloReferencePlayer,
  uePlayerAnchor,
  UE_RESISTANCE_CAP,
  type PlayerAnchor,
} from '@/lib/catalog/reference/playerScale';

const FROM: PlayerAnchor = { basis: 'reference hero, level 1, starting weapon', life: 50, hit: 5, mitigation: 0 };
const TO: PlayerAnchor = { basis: 'target hero, attribute-set defaults', life: 200, hit: 40, mitigation: 0.2 };
const MONSTER = { hp: { min: 8, max: 12 }, damage: { min: 2, max: 6 }, resist: { magic: 100, fire: 75, lightning: 0 } };

describe('convertMonsterScale', () => {
  const out = convertMonsterScale(MONSTER, FROM, TO);

  it('preserves how many hits the PLAYER needs to kill the monster', () => {
    // reference: mean HP 10 / hit 5 = 2 hits → target: the same 2 hits of 40.
    expect(out.row.maxHealth / TO.hit).toBeCloseTo(10 / FROM.hit, 10);
    expect(out.invariants.playerHitsToKill.reference).toBeCloseTo(out.invariants.playerHitsToKill.converted, 10);
  });

  it('preserves how many hits the MONSTER needs to kill the player, through the target’s own mitigation', () => {
    // reference: mean 4 of 50 life = 12.5 hits. Target: a hit lands as (base + AP)·(1 − mitigation).
    const landed = (out.row.baseDamage + out.row.attackPower) * (1 - TO.mitigation);
    expect(TO.life / landed).toBeCloseTo(50 / 4, 10);
    expect(out.invariants.monsterHitsToKillPlayer.reference).toBeCloseTo(out.invariants.monsterHitsToKillPlayer.converted, 10);
  });

  it('carries the damage in BaseDamage and zeroes AttackPower (the formula adds it to every hit)', () => {
    expect(out.row.attackPower).toBe(0);
  });

  it('converts resistance percentages to fractions and discloses the engine cap', () => {
    expect(out.row.resist.fire).toBeCloseTo(0.75, 10);
    expect(out.row.resist.lightning).toBe(0);
    expect(out.row.resist.magic).toBe(UE_RESISTANCE_CAP);
    const magic = out.ledger.find((l) => l.field === 'resist.magic');
    expect(magic?.grade).toBe('approximate');
    expect(magic?.reason).toMatch(/cap/i);
  });

  it('grades every converted field on the closed loss scale, with a reason', () => {
    const fields = out.ledger.map((l) => l.field);
    expect(fields).toEqual(expect.arrayContaining(['maxHealth', 'baseDamage', 'toHit', 'resist.fire']));
    for (const l of out.ledger) {
      expect(['full', 'approximate', 'data-only', 'dropped']).toContain(l.grade);
      expect(l.reason.length).toBeGreaterThan(15);
    }
    // A range becomes one number, so HP and damage are approximations, never "full".
    expect(out.ledger.find((l) => l.field === 'maxHealth')?.grade).toBe('approximate');
    expect(out.ledger.find((l) => l.field === 'toHit')?.grade).toBe('dropped');
  });

  it('names both players it assumes (a balance figure without its player is not a claim)', () => {
    expect(out.basis.from).toBe(FROM.basis);
    expect(out.basis.to).toBe(TO.basis);
    expect(out.basis.skill).toMatch(/unestimated/i);
  });

  it('refuses an anchor it cannot divide by rather than inventing a scale', () => {
    expect(() => convertMonsterScale(MONSTER, { ...FROM, hit: 0 }, TO)).toThrow(/hit/);
    expect(() => convertMonsterScale(MONSTER, FROM, { ...TO, mitigation: 1 })).toThrow(/mitigation/);
    expect(() => convertMonsterScale(MONSTER, { ...FROM, life: -1 }, TO)).toThrow(/life/);
  });
});

describe('diabloReferencePlayer', () => {
  // Synthetic class attributes — the shape of DevilutionX's classes/<class>/attributes.tsv.
  const attrs = { baseStr: '40', baseVit: '20', adjLife: '10', lvlLife: '3', chrLife: '2' };

  it('derives level-1 life from the class table (adjLife + lvlLife·clvl + chrLife·vit)', () => {
    const p = diabloReferencePlayer({ className: 'Hero', attributes: attrs, weapon: { name: 'Stick', minDamage: 2, maxDamage: 8 } });
    expect(p.life).toBe(10 + 3 * 1 + 2 * 20);
  });

  it('derives the hit from the starting weapon plus the strength bonus (clvl·str/100, floored)', () => {
    const p = diabloReferencePlayer({ className: 'Hero', attributes: attrs, weapon: { name: 'Stick', minDamage: 2, maxDamage: 8 } });
    expect(p.hit).toBe(5 + Math.floor((1 * 40) / 100));
    expect(p.mitigation).toBe(0);
    expect(p.basis).toMatch(/Hero.*level 1.*Stick/);
  });

  it('refuses a class table missing a term instead of defaulting it', () => {
    const { chrLife: _drop, ...partial } = attrs;
    expect(() => diabloReferencePlayer({ className: 'Hero', attributes: partial, weapon: { name: 'Stick', minDamage: 2, maxDamage: 8 } })).toThrow(/chrLife/);
  });
});

describe('uePlayerAnchor', () => {
  // Synthetic snippets in the shape of UARPGAttributeSet's constructor and GA_MeleeAttack.h.
  const attributeSetCpp = 'InitHealth(80.f);\n\tInitMaxHealth(80.f);\n\tInitArmor(25.f);\n\tInitAttackPower(6.f);\n\tInitCriticalChance(0.1f);\n\tInitCriticalDamage(2.f);';
  const meleeHeader = 'UPROPERTY(EditDefaultsOnly)\n\tfloat BaseDamage = 14.f;';

  it('reads life, the first-hit melee damage (base + AttackPower, expected crit) and armour mitigation', () => {
    const p = uePlayerAnchor({ attributeSetCpp, meleeHeader });
    expect(p.life).toBe(80);
    expect(p.hit).toBeCloseTo((14 + 6) * (1 + 0.1 * 2), 10);
    expect(p.mitigation).toBeCloseTo(25 / 125, 10);
    expect(p.basis).toMatch(/attribute-set defaults/);
  });

  it('refuses when a default it needs is not in the source', () => {
    expect(() => uePlayerAnchor({ attributeSetCpp: 'InitMaxHealth(80.f);', meleeHeader })).toThrow(/no Init(Armor|AttackPower)/);
    expect(() => uePlayerAnchor({ attributeSetCpp, meleeHeader: 'float Other = 1.f;' })).toThrow(/BaseDamage/);
  });
});
