/**
 * Ability hit preview — the Spellbook damage sandbox's explainer, built ONLY from
 * `@/lib/ability/damage-formula` (the canon-kernel adapter). It never carries a
 * damage model of its own: `expected` IS `calculateDamage`, and the non-crit/on-crit
 * outcomes are the two kernel hits `calculateDamage` averages.
 *
 * What it adds is the "why": which canon type the ability's element resolves to
 * (and whether that was a silent Physical fallback), how much each hit size is
 * mitigated (armour is soft-capped against the hit, so the crit is mitigated less),
 * and whether the resist or crit-chance caps bit.
 */

import {
  calculateDamage,
  canonDamageType,
  armorMitigation,
  rawScaledHit,
  scaleAndMitigate,
  CRIT_CHANCE_CAP,
  RESIST_CAP,
} from '@/lib/ability/damage-formula';
import type { DamageType } from '@/lib/combat/canon-kernel';

export interface AbilityHitInput {
  base: number;
  power: number;
  /** Target armour rating (Physical only). */
  armor?: number;
  /** Target resist fraction 0–1 (non-Physical only; applied capped at 75%). */
  resist?: number;
  /** Ability-module element (`Fire`, `Ice`, `Shadow`, …). Omitted → Physical. */
  element?: string;
  /** Percent (15 → 15%); canon caps it at 95%. */
  critChancePct: number;
  critMult: number;
}

export interface AbilityHitExplanation {
  raw: number;
  critRaw: number;
  canonType: DamageType;
  /** True when the element has no canon type and was mapped to Physical. */
  typeFallback: boolean;
  /** The element as authored, when it differs from the canon type (`Ice` → Cold, `Shadow` → Physical). */
  mappedFrom: string | null;
  armorApplied: boolean;
  /** Mitigation fraction on the non-crit hit. */
  nonCritMitigation: number;
  /** Mitigation fraction on the crit hit (lower under armour: bigger hit). */
  critMitigation: number;
  /** Resist actually applied (0 on the armour path). */
  resistApplied: number;
  resistCapped: boolean;
  critChanceApplied: number;
  critCapped: boolean;
  nonCrit: number;
  onCrit: number;
  expected: number;
}

export function explainAbilityHit(input: AbilityHitInput): AbilityHitExplanation {
  const { base, power, element, critChancePct, critMult } = input;
  const armor = input.armor ?? 0;
  const resist = input.resist ?? 0;
  const canonType = canonDamageType(element);
  const target = { type: canonType, resist };

  const raw = rawScaledHit(base, power);
  const critRaw = raw * critMult;
  const armorApplied = canonType === 'Physical';
  const resistApplied = armorApplied ? 0 : Math.min(Math.max(resist, 0), RESIST_CAP);
  const nonCritMitigation = armorApplied ? armorMitigation(armor, raw) : resistApplied;
  const critMitigation = armorApplied ? armorMitigation(armor, critRaw) : resistApplied;
  const pct = critChancePct / 100;

  return {
    raw,
    critRaw,
    canonType,
    typeFallback: element !== undefined && armorApplied && element !== 'Physical',
    mappedFrom: element !== undefined && element !== canonType ? element : null,
    armorApplied,
    nonCritMitigation,
    critMitigation,
    resistApplied,
    resistCapped: !armorApplied && resist > RESIST_CAP,
    critChanceApplied: Math.min(Math.max(pct, 0), CRIT_CHANCE_CAP),
    critCapped: pct > CRIT_CHANCE_CAP,
    nonCrit: scaleAndMitigate(base, power, armor, target),
    onCrit: scaleAndMitigate(base * critMult, power, armor, target),
    expected: calculateDamage(base, power, armor, critChancePct, critMult, target),
  };
}

/** The catalog fields a ranking needs (a structural slice of SpellbookAbility). */
export interface RankableAbility {
  id: string;
  name: string;
  element: string;
  damage: number;
  manaCost: number;
  cooldown: number;
}

export interface HitTarget { armor: number; resist: number }
export interface HitAttacker { power: number; critChancePct: number; critMult: number }

export interface AbilityHitRow {
  id: string;
  name: string;
  element: string;
  canonType: DamageType;
  typeFallback: boolean;
  expected: number;
  /** Expected hit per mana point; null (never Infinity) for a free ability. */
  dmgPerMana: number | null;
  /** Expected hit per second of cooldown; null when there is no cooldown. */
  hitPerCooldownSec: number | null;
}

export interface AbilityHitRanking {
  rows: AbilityHitRow[];
  /** Entries left out because they deal no direct damage (buffs, utility, passives). */
  excluded: number;
}

/** Rank every damaging catalog ability by its canon expected hit against one target. */
export function rankAbilitiesVsTarget(
  entries: ReadonlyArray<{ data: RankableAbility }>,
  target: HitTarget,
  attacker: HitAttacker,
): AbilityHitRanking {
  const rows: AbilityHitRow[] = [];
  let excluded = 0;
  for (const { data: a } of entries) {
    if (!(a.damage > 0)) { excluded++; continue; }
    const hit = explainAbilityHit({ base: a.damage, element: a.element, ...target, ...attacker });
    rows.push({
      id: a.id,
      name: a.name,
      element: a.element,
      canonType: hit.canonType,
      typeFallback: hit.typeFallback,
      expected: hit.expected,
      dmgPerMana: a.manaCost > 0 ? hit.expected / a.manaCost : null,
      hitPerCooldownSec: a.cooldown > 0 ? hit.expected / a.cooldown : null,
    });
  }
  rows.sort((x, y) => y.expected - x.expected || x.name.localeCompare(y.name));
  return { rows, excluded };
}
