/** Ordered, engine-derived attack sequencing for Diablo I monsters. */
import { D1_AI_ROUTINES, isD1AiRoutineId, type D1AiRoutineId } from '@/lib/catalog/reference/aiRoutines';
import { actionMarkerTick, animationEndTick } from '@/lib/catalog/reference/animationTiming';
import { monsterDamageByDifficulty, type Difficulty, type IntegerRange, type MonsterProfile } from '@/lib/catalog/reference/combatMath';
import { D1_MONSTER_ATTACK_LEDGER_DATA } from '@/lib/catalog/reference/monsterAttackLedgerData';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

export type MonsterAttackPhase =
  | 'decide'
  | 'wind-up'
  | 'hit-frame'
  | 'to-hit'
  | 'damage'
  | 'special'
  | 'missile'
  | 'recover';

export type MonsterAttackKind = 'melee' | 'special-melee' | 'missile' | 'charge' | 'summon' | 'heal';
export type MonsterAttackAnimation = 'attack' | 'special' | 'immediate';
export type MonsterDamageChannel = 'normal' | 'special' | 'engine' | 'none';

export interface MonsterAttackBranch {
  readonly condition: string;
  readonly outcome: string;
  readonly refs?: readonly string[];
}

export interface MonsterAttackStep {
  readonly phase: MonsterAttackPhase;
  readonly what: string;
  readonly formula?: string;
  readonly branches?: readonly MonsterAttackBranch[];
  readonly refs: readonly string[];
}

export interface MonsterAttackSequenceSpec {
  readonly id: string;
  readonly kind: MonsterAttackKind;
  readonly missile?: string;
  readonly condition: string;
  readonly animation: MonsterAttackAnimation;
  readonly damageChannel: MonsterDamageChannel;
  /** Engine-only extra swing marker, expressed as the zero-based currentFrame literal. */
  readonly engineCurrentFrame?: number;
  readonly modifiers?: { readonly toHit: number; readonly damage: number };
  readonly steps: readonly MonsterAttackStep[];
  readonly refs: readonly string[];
}

export interface MonsterAttackLedgerSpec {
  readonly routine: D1AiRoutineId;
  /** Stable routine-wide order; multi-attack routines concatenate their sequence orders. */
  readonly steps: readonly MonsterAttackStep[];
  readonly sequences: readonly MonsterAttackSequenceSpec[];
  readonly refs: readonly string[];
}

export interface MonsterAnimationTiming {
  readonly animation: Exclude<MonsterAttackAnimation, 'immediate'>;
  readonly framesColumn: 'frames[6]';
  readonly rateColumn: 'rate[6]';
  readonly markerColumn: 'animFrameNum' | 'animFrameNumSpecial' | 'engine currentFrame';
  readonly frameCount: number;
  readonly frameDelay: number;
  readonly marker: number;
  /** Zero-based game-tick offset from the AI decision tick to the first action check. */
  readonly hitTick: number | null;
  /** One-based processing tick, included to remove any tick-zero ambiguity in reports. */
  readonly hitProcessingTick: number | null;
  /** Every tick offset on which a marker-only mode check runs. */
  readonly hitWindowTicks: readonly number[];
  /** Offset at which the last frame is observed and the mode returns to Stand. */
  readonly recoverTick: number;
}

export interface MonsterAttackDifficultyStats {
  readonly toHit: number;
  readonly damage: IntegerRange;
  readonly fixedPointDamage: { readonly min: number; readonly max: number; readonly floor: number };
}

export interface MonsterAttackDifficultyChannels {
  readonly normal: MonsterAttackDifficultyStats;
  readonly special: MonsterAttackDifficultyStats;
}

export interface InstantiatedMonsterAttackSequence extends MonsterAttackSequenceSpec {
  readonly present: boolean;
  readonly timing?: MonsterAnimationTiming;
  readonly byDifficulty?: Readonly<Record<Difficulty, MonsterAttackDifficultyStats>>;
}

export interface MonsterAttackLedger extends Omit<MonsterAttackLedgerSpec, 'sequences'> {
  readonly monsterId: string;
  readonly routine: D1AiRoutineId;
  readonly specialMarkerPresent: boolean;
  readonly timing: {
    readonly attack: MonsterAnimationTiming;
    readonly special: MonsterAnimationTiming;
  };
  readonly channelsByDifficulty: Readonly<Record<Difficulty, MonsterAttackDifficultyChannels>>;
  readonly sequences: readonly InstantiatedMonsterAttackSequence[];
}

export interface MonsterAttackLedgerFinding {
  readonly dataset: 'monsterRuntimeLawsData' | 'damageUnitsLawData' | 'behaviourScale' | 'combatDuel';
  readonly field: string;
  readonly status: 'agree' | 'disagree' | 'caller-input';
  readonly ledger: string;
  readonly other: string;
  readonly refs: readonly string[];
}

const DIFFICULTIES: readonly Difficulty[] = ['normal', 'nightmare', 'hell'];
const FIXED_POINT_FLOOR = 64;
const ATTACK_LEDGERS: Partial<Record<D1AiRoutineId, MonsterAttackLedgerSpec>> = D1_MONSTER_ATTACK_LEDGER_DATA;

function numeric(raw: Record<string, string>, column: string, owner: string): number {
  const value = Number(raw[column]);
  if (!Number.isFinite(value)) throw new Error(`${owner} has no numeric ${column}`);
  return value;
}

function csv(raw: Record<string, string>, column: string, owner: string): number[] {
  const values = (raw[column] ?? '').split(',').map((value) => Number(value.trim()));
  if (values.length < 6 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`${owner} has no six-value ${column}`);
  }
  return values;
}

function difficultyToHit(base: number, difficulty: Difficulty): number {
  return base + (difficulty === 'nightmare' ? 85 : difficulty === 'hell' ? 120 : 0);
}

function timing(
  animation: Exclude<MonsterAttackAnimation, 'immediate'>,
  frames: readonly number[],
  rates: readonly number[],
  marker: number,
  firstTickOnly: boolean,
  markerColumn?: MonsterAnimationTiming['markerColumn'],
): MonsterAnimationTiming {
  const index = animation === 'attack' ? 2 : 5;
  const frameCount = frames[index];
  const frameDelay = rates[index];
  if (!Number.isInteger(frameCount) || frameCount < 0) throw new Error(`${animation} frame count must be non-negative`);
  if (!Number.isInteger(frameDelay) || frameDelay < 1) throw new Error(`${animation} frame delay must be positive`);
  const validMarker = frameCount > 0 && Number.isInteger(marker) && marker > 0 && marker <= frameCount;
  const hitTick = validMarker ? actionMarkerTick(marker, frameDelay) : null;
  const hitWindowTicks = hitTick === null
    ? []
    : Array.from({ length: firstTickOnly || marker === frameCount ? 1 : frameDelay }, (_, offset) => hitTick + offset);
  return {
    animation,
    framesColumn: 'frames[6]',
    rateColumn: 'rate[6]',
    markerColumn: markerColumn ?? (animation === 'attack' ? 'animFrameNum' : 'animFrameNumSpecial'),
    frameCount,
    frameDelay,
    marker,
    hitTick,
    hitProcessingTick: hitTick === null ? null : hitTick + 1,
    hitWindowTicks,
    recoverTick: frameCount === 0 ? 0 : animationEndTick(frameCount, frameDelay),
  };
}

function profile(raw: Record<string, string>, difficulty: Difficulty, channel: 'normal' | 'special'): MonsterProfile {
  const owner = raw._monster_id ?? raw.name ?? 'monster row';
  const minColumn = channel === 'normal' ? 'minDamage' : 'minDamageSpecial';
  const maxColumn = channel === 'normal' ? 'maxDamage' : 'maxDamageSpecial';
  return {
    level: numeric(raw, 'level', owner),
    hitPoints: { min: 1, max: 1 },
    armourClass: numeric(raw, 'armorClass', owner),
    toHit: numeric(raw, channel === 'normal' ? 'toHit' : 'toHitSpecial', owner),
    damage: { min: numeric(raw, minColumn, owner), max: numeric(raw, maxColumn, owner) },
    monsterClass: 'animal',
    resist: {},
    immune: {},
    difficulty,
  };
}

function statsFor(raw: Record<string, string>, difficulty: Difficulty, channel: 'normal' | 'special'): MonsterAttackDifficultyStats {
  const monster = profile(raw, difficulty, channel);
  const result = monsterDamageByDifficulty(monster, { baseBounds: monster.damage });
  return {
    toHit: difficultyToHit(monster.toHit, difficulty),
    damage: result.bounds,
    fixedPointDamage: {
      min: result.damage.min,
      max: result.damage.max,
      floor: FIXED_POINT_FLOOR,
    },
  };
}

function rowOf(wrapperRow: ReferenceWrapper | Record<string, string>): { raw: Record<string, string>; id: string } {
  if ('raw' in wrapperRow && typeof wrapperRow.raw === 'object' && wrapperRow.raw !== null
    && 'entity' in wrapperRow && typeof wrapperRow.entity === 'object' && wrapperRow.entity !== null) {
    const wrapper = wrapperRow as ReferenceWrapper;
    return { raw: wrapper.raw, id: wrapper.entity.id };
  }
  const raw = wrapperRow as Record<string, string>;
  return { raw, id: raw._monster_id ? `d1-${raw._monster_id}` : raw.name ?? 'synthetic-monster' };
}

/** Instantiate code-owned sequencing with one wrapper's runtime row values. */
export function attackLedgerFor(
  wrapperRow: ReferenceWrapper | Record<string, string>,
  routine: string,
): MonsterAttackLedger {
  if (!isD1AiRoutineId(routine)) throw new Error(`AI routine "${routine}" is not in the engine-derived routine table`);
  const spec = ATTACK_LEDGERS[routine];
  if (!spec) throw new Error(`AI routine "${routine}" has no damaging attack ledger`);
  const { raw, id } = rowOf(wrapperRow);
  const frames = csv(raw, 'frames[6]', id);
  const rates = csv(raw, 'rate[6]', id);
  const normalTiming = timing('attack', frames, rates, numeric(raw, 'animFrameNum', id), false);
  const specialTiming = timing('special', frames, rates, numeric(raw, 'animFrameNumSpecial', id), false);
  const specialRangedTiming = timing('special', frames, rates, numeric(raw, 'animFrameNumSpecial', id), true);
  const specialMarkerPresent = specialTiming.hitTick !== null;
  const channelsByDifficulty = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, {
    normal: statsFor(raw, difficulty, 'normal'),
    special: statsFor(raw, difficulty, 'special'),
  }])) as Record<Difficulty, MonsterAttackDifficultyChannels>;
  return {
    ...spec,
    monsterId: id,
    specialMarkerPresent,
    timing: { attack: normalTiming, special: specialTiming },
    channelsByDifficulty,
    sequences: spec.sequences.map((sequence): InstantiatedMonsterAttackSequence => {
      const present = sequence.animation !== 'special' || specialTiming.hitTick !== null;
      const sequenceTiming = sequence.animation === 'attack'
        ? sequence.engineCurrentFrame === undefined
          ? normalTiming
          : timing('attack', frames, rates, sequence.engineCurrentFrame + 1, false, 'engine currentFrame')
        : sequence.animation === 'special'
          ? sequence.kind === 'missile' || sequence.kind === 'summon' ? specialRangedTiming : specialTiming
          : undefined;
      const channel = sequence.damageChannel;
      const byDifficulty = channel === 'normal' || channel === 'special'
        ? Object.fromEntries(DIFFICULTIES.map((difficulty) => {
          const base = channelsByDifficulty[difficulty][channel];
          const modifiers = sequence.modifiers ?? { toHit: 0, damage: 0 };
          return [difficulty, {
            toHit: base.toHit + modifiers.toHit,
            damage: { min: base.damage.min + modifiers.damage, max: base.damage.max + modifiers.damage },
            fixedPointDamage: {
              min: Math.max((base.damage.min + modifiers.damage) * FIXED_POINT_FLOOR, FIXED_POINT_FLOOR),
              max: Math.max((base.damage.max + modifiers.damage) * FIXED_POINT_FLOOR, FIXED_POINT_FLOOR),
              floor: FIXED_POINT_FLOOR,
            },
          }];
        })) as Record<Difficulty, MonsterAttackDifficultyStats>
        : undefined;
      return { ...sequence, present, ...(sequenceTiming ? { timing: sequenceTiming } : {}), ...(byDifficulty ? { byDifficulty } : {}) };
    }),
  };
}

/** Attach instantiated ledgers during bestiary promotion; source wrappers remain immutable. */
export function withMonsterAttackLedgers(
  wrappers: readonly ReferenceWrapper[],
  availableWrappers: readonly ReferenceWrapper[] = wrappers,
): ReferenceWrapper[] {
  const baseByType = new Map(availableWrappers
    .filter((wrapper) => wrapper.file === 'monsters/monstdat.tsv')
    .map((wrapper) => [wrapper.raw._monster_id, wrapper]));
  return wrappers.map((wrapper) => {
    if (wrapper.catalogId !== 'bestiary') return wrapper;
    let attackWrapper = wrapper;
    if (wrapper.file === 'monsters/unique_monstdat.tsv') {
      const base = baseByType.get(wrapper.raw.type);
      if (!base) return wrapper;
      const customToHit = numeric(wrapper.raw, 'customToHit', wrapper.entity.id);
      const customArmorClass = numeric(wrapper.raw, 'customArmorClass', wrapper.entity.id);
      const uniqueLevel = numeric(wrapper.raw, 'level', wrapper.entity.id);
      const uniqueMinDamage = numeric(wrapper.raw, 'minDamage', wrapper.entity.id);
      const uniqueMaxDamage = numeric(wrapper.raw, 'maxDamage', wrapper.entity.id);
      attackWrapper = {
        ...wrapper,
        raw: {
          ...base.raw,
          ai: wrapper.raw.ai,
          intelligence: wrapper.raw.intelligence,
          level: String(uniqueLevel === 0 ? numeric(base.raw, 'level', base.entity.id) + 5 : 2 * uniqueLevel),
          toHit: String(customToHit === 0 ? numeric(base.raw, 'toHit', base.entity.id) : customToHit),
          toHitSpecial: String(customToHit === 0 ? numeric(base.raw, 'toHitSpecial', base.entity.id) : customToHit),
          minDamage: String(uniqueMinDamage),
          maxDamage: String(uniqueMaxDamage),
          minDamageSpecial: String(uniqueMinDamage),
          maxDamageSpecial: String(uniqueMaxDamage),
          armorClass: String(customArmorClass === 0 ? numeric(base.raw, 'armorClass', base.entity.id) : customArmorClass),
        },
      };
    } else if (wrapper.file !== 'monsters/monstdat.tsv') {
      return wrapper;
    }
    const routine = attackWrapper.raw.ai ?? wrapper.entity.tags?.[0];
    if (!routine || !isD1AiRoutineId(routine) || !ATTACK_LEDGERS[routine]) return wrapper;
    return {
      ...wrapper,
      entity: {
        ...wrapper.entity,
        data: { ...wrapper.entity.data, attackLedger: attackLedgerFor(attackWrapper, routine) },
      },
    };
  });
}

export const MONSTER_ATTACK_LEDGER_FINDINGS: readonly MonsterAttackLedgerFinding[] = [
  {
    dataset: 'monsterRuntimeLawsData', field: 'targeting', status: 'agree',
    ledger: 'decision distance/line tests use refreshed enemyPosition while routine steering may use position.last',
    other: 'd1-monster-targeting-law states the same live-target versus last-visible split',
    refs: ['.reference/devilutionX/Source/monster.cpp:679-747', '.reference/devilutionX/Source/monster.cpp:4257-4311'],
  },
  {
    dataset: 'monsterRuntimeLawsData', field: 'animationTiming', status: 'agree',
    ledger: 'marker is one-based; first check offset is (marker - 1) * rate before the end-of-tick advance',
    other: 'd1-monster-animation-timing-law states one-based marker and pre-advance mode checks',
    refs: ['.reference/devilutionX/Source/monster.cpp:653-656', '.reference/devilutionX/Source/monster.cpp:1271-1373', '.reference/devilutionX/Source/monster.cpp:4321-4333'],
  },
  {
    dataset: 'monsterRuntimeLawsData', field: 'specialMarker', status: 'agree',
    ledger: 'SpecialMeleeAttack is absent when animFrameNumSpecial is zero',
    other: 'd1-special-attack-floor-law has the same non-zero marker precondition',
    refs: ['.reference/devilutionX/Source/monster.cpp:1362-1373'],
  },
  {
    dataset: 'monsterRuntimeLawsData', field: 'specialDamageFloor', status: 'agree',
    ledger: 'a present zero-stat special still receives the dungeon to-hit floor and fixed-point damage floor',
    other: 'd1-special-attack-floor-law states the same 15/20/25/30 percent level floor and 64-unit damage floor',
    refs: ['.reference/devilutionX/Source/monster.cpp:1160-1225', '.reference/devilutionX/Source/monster.cpp:1362-1373'],
  },
  {
    dataset: 'damageUnitsLawData', field: 'missileDamageUnits', status: 'agree',
    ledger: 'moving generic projectiles use whole-HP input with isDamageShifted=false; Lightning, Flash, Inferno, and AcidPuddle use persistent shifted checks',
    other: 'd1-missile-damage-units-law records the same collision-call split',
    refs: ['.reference/devilutionX/Source/missiles.cpp:643-672', '.reference/devilutionX/Source/missiles.cpp:2976-3025', '.reference/devilutionX/Source/missiles.cpp:3048-3060', '.reference/devilutionX/Source/missiles.cpp:3378-3390', '.reference/devilutionX/Source/missiles.cpp:3425-3477', '.reference/devilutionX/Source/missiles.cpp:3940-3961'],
  },
  {
    dataset: 'behaviourScale', field: 'hitDelaySeconds', status: 'agree',
    ledger: '(animFrameNum - 1) * rate[6][Attack] / ticksPerSecond from decision tick to first hit check',
    other: 'deriveMonsterTiming and convertBehaviour use the shared one-based action-marker tick helper',
    refs: ['src/lib/catalog/reference/derive.ts:145', 'src/lib/catalog/reference/behaviourScale.ts:389', '.reference/devilutionX/Source/monster.cpp:1271-1277'],
  },
  {
    dataset: 'behaviourScale', field: 'attackAnimationTicks', status: 'agree',
    ledger: 'the last frame is observed at offset (frames[6][Attack] - 1) * rate[6][Attack], then Stand may decide again in the same ProcessMonsters loop',
    other: 'expectedTicks uses the shared last-frame tick helper for every started attack animation',
    refs: ['src/lib/catalog/reference/behaviourScale.ts:274-275', '.reference/devilutionX/Source/monster.cpp:1290-1292', '.reference/devilutionX/Source/monster.cpp:4321-4333'],
  },
  {
    dataset: 'combatDuel', field: 'monsterCadence', status: 'caller-input',
    ledger: 'exact row timing and attack/missile sequences are available per promoted monster',
    other: 'duel accepts monsterAttackCycleSeconds, projectile count, persistent hit checks, and damage events from its caller; it does not derive them from the wrapper',
    refs: ['src/lib/catalog/reference/combatDuel.ts:62-106', 'src/lib/catalog/reference/combatDuel.ts:143-150'],
  },
];

export const D1_MONSTER_ATTACK_LEDGERS = ATTACK_LEDGERS;

export function monsterAttackLedgerSpec(routine: string): MonsterAttackLedgerSpec | undefined {
  return isD1AiRoutineId(routine) ? ATTACK_LEDGERS[routine] : undefined;
}

export function attackLedgerCoverage(): { attacking: readonly D1AiRoutineId[]; missing: readonly D1AiRoutineId[] } {
  const attacking = (Object.keys(D1_AI_ROUTINES) as D1AiRoutineId[]).filter((routine) =>
    D1_AI_ROUTINES[routine].attacks.some((attack) => !['none', 'heal'].includes(attack.kind)));
  return { attacking, missing: attacking.filter((routine) => !ATTACK_LEDGERS[routine]) };
}
