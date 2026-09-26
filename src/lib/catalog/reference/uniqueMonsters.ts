import { applyDecode } from '@/lib/catalog/ingest/decode';
import { UNIQUE_RESISTANCE_DECODE } from '@/lib/catalog/ingest/diablo1Uniques';
import { attackKindsOf, type AiAttackKind } from '@/lib/catalog/reference/aiRoutines';
import { monsterHitPoints, type Difficulty, type GameMode } from '@/lib/catalog/reference/combatMath';
import { deriveMonsterTiming } from '@/lib/catalog/reference/derive';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

export type EffectiveStatSource = 'unique override' | 'base' | 'engine rule';
export interface EffectiveStat<T> { value: T; source: EffectiveStatSource }
export interface EffectiveUniqueStats {
  level: EffectiveStat<number>;
  /** Selected game-mode value, in whole hit points (the combat-profile convention). */
  hitPoints: EffectiveStat<{ min: number; max: number }>;
  toHit: EffectiveStat<number>;
  armorClass: EffectiveStat<number>;
  damage: EffectiveStat<{ min: number; max: number }>;
  resistances: EffectiveStat<string[]>;
  ai: EffectiveStat<string>;
  intelligence: EffectiveStat<number>;
}

export interface UniqueGameOptions {
  gameMode?: GameMode;
  /** Select Hellfire's smaller single-player difficulty bonus (.reference/devilutionX/Source/monster.cpp:3365-3381). */
  hellfire?: boolean;
}

export interface EffectiveUniqueByDifficulty {
  /** Promotion uses the resolver's default vanilla single-player rules. */
  gameMode: 'single';
  byDifficulty: Record<Difficulty, EffectiveUniqueStats>;
}

export interface InheritedUniqueDerived {
  inheritedFrom: {
    entityId: string;
    role: 'base type';
    reason: 'unique monsters use their base type animations';
  };
  laws: string[];
  attackKinds: AiAttackKind[];
  locomotion?: unknown;
  walkTicksPerStep?: unknown;
  tilesPerSecond?: unknown;
  attackCycleTicks?: unknown;
  attackCycleSeconds?: unknown;
  shootCycleTicks?: unknown;
  shootCycleSeconds?: unknown;
  cadencePhase?: unknown;
  cadenceStateGap?: unknown;
  hitDelaySeconds?: unknown;
  gap?: unknown;
}

export interface EffectiveUniqueMonsterIssue {
  entityId: string;
  reason: string;
}

export interface EffectiveUniqueMonstersResult {
  wrappers: ReferenceWrapper[];
  unresolved: EffectiveUniqueMonsterIssue[];
}

function numberFrom(raw: Record<string, string>, key: string, owner: string): number {
  const value = Number(raw[key]);
  if (!Number.isFinite(value)) throw new Error(`${owner} has no numeric ${key}`);
  return value;
}

function assertWrappers(unique: ReferenceWrapper, base: ReferenceWrapper): void {
  if (unique.catalogId !== 'bestiary' || unique.file !== 'monsters/unique_monstdat.tsv') {
    throw new Error(`${unique.entity.id} is not a unique_monstdat bestiary wrapper`);
  }
  if (base.catalogId !== 'bestiary' || base.file !== 'monsters/monstdat.tsv') {
    throw new Error(`${base.entity.id} is not a monstdat bestiary wrapper`);
  }
  if (unique.raw.type !== base.raw._monster_id) {
    throw new Error(`${unique.entity.id} requires base d1-${unique.raw.type}, not ${base.entity.id}`);
  }
}

const difficultyBonus = (difficulty: Difficulty, nightmare: number, hell: number) =>
  difficulty === 'nightmare' ? nightmare : difficulty === 'hell' ? hell : 0;

/**
 * Resolve a named monster over its base type using the engine preparation rules
 * (.reference/devilutionX/Source/monster.cpp:3325-3403).
 * Defaults to vanilla single-player, matching the canon profile; callers can select
 * multiplayer and Hellfire HP rules explicitly.
 */
export function effectiveUnique(
  unique: ReferenceWrapper,
  base: ReferenceWrapper,
  difficulty: Difficulty,
  options: UniqueGameOptions = {},
): EffectiveUniqueStats {
  assertWrappers(unique, base);
  if (!(['normal', 'nightmare', 'hell'] as const).includes(difficulty)) throw new Error(`unknown difficulty ${difficulty}`);

  const uniqueLevel = numberFrom(unique.raw, 'level', unique.entity.id);
  const baseLevel = numberFrom(base.raw, 'level', base.entity.id);
  // A nonzero unique level is doubled; zero means base + 5, before +15/+30 difficulty
  // (.reference/devilutionX/Source/monster.h:398-411).
  const level = (uniqueLevel === 0 ? baseLevel + 5 : uniqueLevel * 2)
    + difficultyBonus(difficulty, 15, 30);

  const rawHp = numberFrom(unique.raw, 'maxHp', unique.entity.id);
  const hitPoints = monsterHitPoints({ min: rawHp, max: rawHp }, difficulty, options.gameMode, options);
  // Storage is six-bit fixed point; SP halves (minimum 1 HP), then vanilla Nightmare/Hell
  // add 100/200 HP; Hellfire SP adds 50/100 instead
  // (.reference/devilutionX/Source/monster.cpp:3328-3333,3365-3382).

  const transformDamage = (value: number) => difficulty === 'nightmare'
    ? 2 * (value + 2)
    : difficulty === 'hell' ? 4 * value + 6 : value;
  // Unique damage replaces both normal and special damage before difficulty scaling
  // (.reference/devilutionX/Source/monster.cpp:3334-3339,3372-3386).
  const damage = {
    min: transformDamage(numberFrom(unique.raw, 'minDamage', unique.entity.id)),
    max: transformDamage(numberFrom(unique.raw, 'maxDamage', unique.entity.id)),
  };

  const customToHit = numberFrom(unique.raw, 'customToHit', unique.entity.id);
  const baseToHit = numberFrom(base.raw, 'toHit', base.entity.id);
  // Zero inherits base; the selected value then gains +85/+120
  // (.reference/devilutionX/Source/monster.cpp:5005-5014).
  const toHit = (customToHit === 0 ? baseToHit : customToHit)
    + difficultyBonus(difficulty, 85, 120);

  const customArmorClass = numberFrom(unique.raw, 'customArmorClass', unique.entity.id);
  const baseArmorClass = numberFrom(base.raw, 'armorClass', base.entity.id);
  // InitMonster has already difficulty-scaled base AC. A nonzero custom AC replaces it and
  // receives the same +50/+80 (.reference/devilutionX/Source/monster.cpp:265-277,3392-3399).
  const armorClass = (customArmorClass === 0 ? baseArmorClass : customArmorClass)
    + difficultyBonus(difficulty, 50, 80);

  return {
    level: { value: level, source: uniqueLevel === 0 ? 'engine rule' : 'unique override' },
    hitPoints: { value: hitPoints, source: 'unique override' },
    toHit: { value: toHit, source: customToHit === 0 ? 'base' : 'unique override' },
    armorClass: { value: armorClass, source: customArmorClass === 0 ? 'base' : 'unique override' },
    damage: { value: damage, source: 'unique override' },
    // PrepareUniqueMonst runs after InitMonster and overwrites even Hell's base
    // resistanceHell selection with the unique row's one resistance list.
    resistances: {
      value: applyDecode(unique.raw.resistance ?? '', UNIQUE_RESISTANCE_DECODE),
      source: 'unique override',
    },
    ai: { value: unique.raw.ai, source: 'unique override' },
    intelligence: { value: numberFrom(unique.raw, 'intelligence', unique.entity.id), source: 'unique override' },
  };
}

const UNIQUE_FILE = 'monsters/unique_monstdat.tsv';
const BASE_FILE = 'monsters/monstdat.tsv';

function inheritedDerived(unique: ReferenceWrapper, base: ReferenceWrapper): InheritedUniqueDerived {
  // PrepareUniqueMonst keeps the base animation set but replaces both AI and intelligence
  // (.reference/devilutionX/Source/monster.cpp:3325-3342), so cadence must be re-run rather than copied from the base.
  const derived = deriveMonsterTiming(base.entity.data, unique.raw.ai, numberFrom(unique.raw, 'intelligence', unique.entity.id));
  const timingKeys = [
    'locomotion',
    'walkTicksPerStep',
    'tilesPerSecond',
    'attackCycleTicks',
    'attackCycleSeconds',
    'shootCycleTicks',
    'shootCycleSeconds',
    'cadencePhase',
    'cadenceStateGap',
    'hitDelaySeconds',
    'gap',
  ] as const;
  const inheritedTiming = Object.fromEntries(
    timingKeys.filter((key) => Object.hasOwn(derived, key)).map((key) => [key, derived[key]]),
  );
  const sourceLaws = Array.isArray(derived.laws)
    ? derived.laws.filter((law): law is string => typeof law === 'string')
    : [];

  return {
    ...inheritedTiming,
    inheritedFrom: {
      entityId: base.entity.id,
      role: 'base type',
      reason: 'unique monsters use their base type animations',
    },
    laws: [...new Set(['d1-timing-law', ...sourceLaws])],
    attackKinds: attackKindsOf(unique.raw.ai),
  };
}

/**
 * Enrich selected named monsters immediately before promotion. PrepareUniqueMonst starts
 * from the linked base type, while named monsters continue to use that type's animation
 * timing. Missing bases are reported but deliberately remain promotable (the known Hellfire
 * orphan rows must not disappear from the catalog).
 */
export function effectiveUniqueMonstersForPromotion(
  selected: readonly ReferenceWrapper[],
  available: readonly ReferenceWrapper[],
): EffectiveUniqueMonstersResult {
  const byId = new Map(available.map((wrapper) => [wrapper.entity.id, wrapper]));
  const baseRows = available.filter((wrapper) => wrapper.catalogId === 'bestiary' && wrapper.file === BASE_FILE);
  const wrappers: ReferenceWrapper[] = [];
  const unresolved: EffectiveUniqueMonsterIssue[] = [];

  for (const wrapper of selected) {
    if (wrapper.catalogId !== 'bestiary' || wrapper.file !== UNIQUE_FILE || !wrapper.entity.id.startsWith('d1-uniq-')) {
      wrappers.push(wrapper);
      continue;
    }

    const linkedId = wrapper.entity.links?.find(
      (link) => link.role === 'base' && link.catalogId === 'bestiary',
    )?.entityId;
    const base = linkedId
      ? byId.get(linkedId)
      : baseRows.find((candidate) => candidate.raw._monster_id === wrapper.raw.type);
    if (!base) {
      unresolved.push({
        entityId: wrapper.entity.id,
        reason: linkedId
          ? `base-type link ${linkedId} does not resolve to an available wrapper`
          : `base type ${wrapper.raw.type} has no monstdat wrapper`,
      });
      wrappers.push(wrapper);
      continue;
    }

    const effective: EffectiveUniqueByDifficulty = {
      gameMode: 'single',
      byDifficulty: {
        normal: effectiveUnique(wrapper, base, 'normal'),
        nightmare: effectiveUnique(wrapper, base, 'nightmare'),
        hell: effectiveUnique(wrapper, base, 'hell'),
      },
    };
    wrappers.push({
      ...wrapper,
      entity: {
        ...wrapper.entity,
        data: {
          ...wrapper.entity.data,
          effective,
          derived: inheritedDerived(wrapper, base),
        },
      },
    });
  }

  return { wrappers, unresolved };
}
