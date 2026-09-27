/** Monster-owned missile selection, element metadata, and per-exchange damage distributions. */
import { D1_AI_ROUTINES, isD1AiRoutineId, type AiAttackKind, type D1AiRoutineId } from '@/lib/catalog/reference/aiRoutines';
import {
  FIXED_POINT,
  monsterDamageByDifficulty,
  type DamageDistribution,
  type Element,
  type MonsterProfile,
} from '@/lib/catalog/reference/combatMath';
import {
  MONSTER_MISSILE_DAMAGE_SOURCES_DATA,
  MONSTER_MISSILE_SELECTION_POLICIES_DATA,
} from '@/lib/catalog/reference/monsterMissileDamageData';
import { classifyMissileFlags } from '@/lib/catalog/reference/missileSpecs';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

export type MonsterMissileDamageFormula =
  | { readonly kind: 'monster-normal'; readonly multiplier?: number }
  | { readonly kind: 'monster-special' }
  | { readonly kind: 'fixed'; readonly value: number }
  | { readonly kind: 'fixed-range'; readonly min: number; readonly max: number }
  | { readonly kind: 'monster-level'; readonly multiplier: number }
  | { readonly kind: 'none' };

export interface MonsterMissileDamageSource {
  readonly missile: string;
  readonly routines: readonly D1AiRoutineId[];
  readonly formula: MonsterMissileDamageFormula;
  readonly projectilesPerAttack: number;
  readonly collision: 'ordinary' | 'already-shifted' | 'monster-attack';
  readonly modeledHitsPerExchange: number;
  readonly omittedEffects: readonly string[];
  readonly elementGap?: string;
  readonly refs: readonly string[];
}

export type MonsterMissileSelectionPolicy =
  | {
      readonly routines: readonly D1AiRoutineId[];
      readonly kind: 'intelligence-index';
      readonly missiles: readonly string[];
      readonly refs: readonly string[];
      readonly rationale: string;
    }
  | {
      readonly routines: readonly D1AiRoutineId[];
      readonly kind: 'bat-subtype';
      readonly gloomMonsterType: string;
      readonly familiarMonsterType: string;
      readonly gloomMissile: string;
      readonly familiarMissile: string;
      readonly refs: readonly string[];
      readonly rationale: string;
    };

export interface SelectedMonsterMissileAttack {
  readonly routine: D1AiRoutineId;
  readonly missile: string;
  readonly kind: AiAttackKind;
  readonly selection: string;
}

export interface MonsterMissileMetadata {
  readonly element: Element;
  readonly arrow: boolean;
}

export interface ResolvedMonsterMissileDamage {
  readonly source: MonsterMissileDamageSource;
  readonly damage: DamageDistribution;
  readonly projectilesPerAttack: number;
  readonly alreadyShifted: boolean;
}

export const MONSTER_MISSILE_DAMAGE_SOURCES: readonly MonsterMissileDamageSource[] =
  MONSTER_MISSILE_DAMAGE_SOURCES_DATA;

export const MONSTER_MISSILE_SELECTION_POLICIES: readonly MonsterMissileSelectionPolicy[] =
  MONSTER_MISSILE_SELECTION_POLICIES_DATA;

const splitMissiles = (value: string): string[] =>
  value.split(/[|+]/).map((missile) => missile.trim()).filter((missile) => missile !== '' && missile !== 'none');

const attackForMissile = (routine: D1AiRoutineId, missile: string) =>
  D1_AI_ROUTINES[routine].attacks.find((attack) => splitMissiles(attack.missile).includes(missile));

/** Select the actual subtype/intelligence missile, otherwise the routine's primary ranged attack. */
export function selectMonsterMissileAttack(
  routine: D1AiRoutineId | string,
  intelligence: number,
  monsterType?: string,
): SelectedMonsterMissileAttack | undefined {
  if (!isD1AiRoutineId(routine)) return undefined;
  const policy = MONSTER_MISSILE_SELECTION_POLICIES.find((candidate) => candidate.routines.includes(routine));
  let selected: string | undefined;
  let selection = 'primary ranged attack from aiRoutinesData';
  if (policy?.kind === 'intelligence-index') {
    selected = policy.missiles[intelligence];
    selection = policy.rationale;
  } else if (policy?.kind === 'bat-subtype') {
    selected = monsterType === policy.gloomMonsterType
      ? policy.gloomMissile
      : monsterType === policy.familiarMonsterType ? policy.familiarMissile : undefined;
    selection = policy.rationale;
  } else {
    const attacks = D1_AI_ROUTINES[routine].attacks;
    const primary = attacks.find((attack) => attack.kind === 'missile')
      ?? attacks.find((attack) => attack.kind === 'special' && splitMissiles(attack.missile).length > 0)
      ?? attacks.find((attack) => attack.kind === 'summon' && splitMissiles(attack.missile).length > 0);
    selected = primary && splitMissiles(primary.missile)[0];
  }
  if (!selected) return undefined;
  const attack = attackForMissile(routine, selected);
  if (!attack) throw new Error(`${routine} selection chose ${selected}, which is absent from aiRoutinesData`);
  return { routine, missile: selected, kind: attack.kind, selection };
}

export function monsterMissileDamageSource(missile: string, routine: D1AiRoutineId): MonsterMissileDamageSource {
  const source = MONSTER_MISSILE_DAMAGE_SOURCES.find((candidate) =>
    candidate.missile === missile && candidate.routines.includes(routine));
  if (!source) throw new Error(`no pin-verified monster damage source for ${routine}/${missile}`);
  return source;
}

/** Resolve the missile element and arrow classification from the promoted misdat wrapper (W46). */
export function monsterMissileMetadata(missile: string, wrappers: readonly ReferenceWrapper[]): MonsterMissileMetadata {
  const wrapper = wrappers.find((candidate) => candidate.catalogId === 'vfx'
    && candidate.file === 'missiles/misdat.tsv'
    && String(candidate.raw.id) === missile);
  if (!wrapper) throw new Error(`the supplied wrappers have no missiles/misdat.tsv row for ${missile}`);
  // Persisted wrapper projections can predate W46; the same W46 classifier reprojects raw flags on read.
  const classified = wrapper.entity.data.damageType === undefined
    ? classifyMissileFlags(wrapper.raw.flags ?? '')
    : undefined;
  const rawType = wrapper.entity.data.damageType ?? classified?.damageType;
  const element = typeof rawType === 'string' ? rawType.toLowerCase() : '';
  if (!(['physical', 'magic', 'fire', 'lightning', 'acid'] as const).includes(element as Element)) {
    throw new Error(`${wrapper.entity.id} has no supported data.damageType`);
  }
  return { element: element as Element, arrow: wrapper.entity.data.arrow === true || classified?.arrow === true };
}

function distribution(outcomes: readonly { damage: number; weight: number }[]): DamageDistribution {
  const combined = new Map<number, number>();
  for (const outcome of outcomes) {
    if (outcome.weight <= 0) continue;
    combined.set(outcome.damage, (combined.get(outcome.damage) ?? 0) + outcome.weight);
  }
  const entries = [...combined].map(([damage, weight]) => ({ damage, weight }));
  const expectedDenominator = entries.reduce((sum, outcome) => sum + outcome.weight, 0);
  const expectedNumerator = entries.reduce((sum, outcome) => sum + outcome.damage * outcome.weight, 0);
  if (entries.length === 0) {
    return { min: 0, max: 0, mean: 0, expectedNumerator: 0, expectedDenominator: 1, outcomes: [] };
  }
  return {
    min: Math.min(...entries.map((outcome) => outcome.damage)),
    max: Math.max(...entries.map((outcome) => outcome.damage)),
    mean: expectedNumerator / expectedDenominator,
    expectedNumerator,
    expectedDenominator,
    outcomes: entries,
  };
}

const fixedDamage = (min: number, max: number, playerGetHit: number): DamageDistribution => {
  const outcomes: { damage: number; weight: number }[] = [];
  for (let roll = min; roll <= max; roll++) {
    outcomes.push({ damage: Math.max(roll * FIXED_POINT + playerGetHit * FIXED_POINT, FIXED_POINT), weight: 1 });
  }
  return distribution(outcomes);
};

const stat = (wrapper: ReferenceWrapper, label: string): number => {
  const stats = wrapper.entity.data.stats;
  const entry = Array.isArray(stats)
    ? stats.find((candidate) => candidate != null && typeof candidate === 'object'
      && (candidate as { label?: unknown }).label === label)
    : undefined;
  const value = Number((entry as { value?: unknown } | undefined)?.value);
  if (!Number.isFinite(value)) throw new Error(`${wrapper.entity.id} has no numeric data.stats[${label}]`);
  return value;
};

const adjustedMonsterLevel = (monster: MonsterProfile): number => monster.difficultyAdjusted
  ? monster.level
  : monster.level + (monster.difficulty === 'nightmare' ? 15 : monster.difficulty === 'hell' ? 30 : 0);

/** Build the per-projectile damage distribution before player resistance. */
export function resolveMonsterMissileDamage(
  source: MonsterMissileDamageSource,
  monster: MonsterProfile,
  monsterWrapper: ReferenceWrapper,
  baseWrapper: ReferenceWrapper | undefined,
  playerGetHit = 0,
): ResolvedMonsterMissileDamage {
  const formula = source.formula;
  let damage: DamageDistribution;
  if (formula.kind === 'none') {
    damage = distribution([{ damage: 0, weight: 1 }]);
  } else if (formula.kind === 'fixed') {
    damage = fixedDamage(formula.value, formula.value, playerGetHit);
  } else if (formula.kind === 'fixed-range') {
    damage = fixedDamage(formula.min, formula.max, playerGetHit);
  } else if (formula.kind === 'monster-level') {
    const value = adjustedMonsterLevel(monster) * formula.multiplier;
    damage = fixedDamage(value, value, playerGetHit);
  } else {
    const unique = monsterWrapper.file === 'monsters/unique_monstdat.tsv';
    const baseBounds = formula.kind === 'monster-special' && !unique
      ? {
          min: stat(baseWrapper ?? monsterWrapper, 'Special Damage Min'),
          max: stat(baseWrapper ?? monsterWrapper, 'Special Damage Max'),
        }
      : monster.damage;
    const ordinary = monsterDamageByDifficulty(monster, {
      baseBounds,
      attack: formula.kind === 'monster-special' ? 'melee' : 'projectile',
    }).damage;
    const multiplier = formula.kind === 'monster-normal' ? formula.multiplier ?? 1 : 1;
    damage = multiplier === 1 && playerGetHit === 0
      ? ordinary
      : distribution(ordinary.outcomes.map((outcome) => ({
          damage: Math.max(outcome.damage * multiplier + playerGetHit * FIXED_POINT, FIXED_POINT),
          weight: outcome.weight,
        })));
  }
  return {
    source,
    damage,
    projectilesPerAttack: source.projectilesPerAttack,
    alreadyShifted: source.collision === 'already-shifted',
  };
}
