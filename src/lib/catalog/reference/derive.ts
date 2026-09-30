/**
 * DERIVED reference values (/diablo D29, W09): what PoF computes from an ingested row's MAPPED fields plus the
 * engine-derived laws of its canon profile, written into the projection as `data.derived` in the REFERENCE's own
 * units (ticks, tiles, seconds). `locomotion` is the animation-only upper bound and exists for every monster with walk
 * data; the established top-level walk speed remains the effective approach speed after routine decision cadence.
 * Before this, W08's speed and cadence lived only in a UE script: the Stat Block said "not in the reference", AI
 * Behavior had nowhere to put it, and the columns they come from stayed mapped as gaps.
 *
 * A derivation is code, so its VERSION is part of the mapping version (`wrapTable`): the code revision plus the text of
 * every law and structured routine entry it reads — edit either and the rows re-project, instead of being skipped as
 * "unchanged" (the W00 decoder trap). A missing input, or a routine with no cadence model yet, leaves its affected
 * fields as a declared gap — never a guessed number.
 */
import { contentHash } from '@/lib/catalog/reference/hash';
import { AI_LAW_IDS, aiRoutineLaw, attackKindsOf, behaviourLawTexts, expectedTicks, timingLaw, walkTicksPerStep } from '@/lib/catalog/reference/behaviourScale';
import { actionMarkerTick } from '@/lib/catalog/reference/animationTiming';
import { AFFIX_POWERS, affixTargetsOf } from '@/lib/catalog/ingest/diablo1Affixes';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import { monsterHitPoints, type Difficulty, type IntegerRange } from '@/lib/catalog/reference/combatMath';
import { resistanceByElement } from '@/lib/catalog/reference/resistanceLaw';

export interface DeriveSpec {
  /** Changes whenever the derivation's code or the laws it reads change. */
  version: () => string;
  derive: (entity: { id: string; tags?: string[]; data: Record<string, unknown> }, raw?: Record<string, string>) => Record<string, unknown>;
}

const CODE_REVISION = 'monster-timing+difficulty@4';

const DIFFICULTY_LAW_IDS = [
  'd1-difficulty-law',
  'd1-combat-monster-hp-law',
  'd1-combat-monster-armour-law',
  'd1-combat-monster-damage-law',
  'd1-combat-monster-melee-to-hit-law',
  'd1-xp-award-law',
] as const;

const numericStat = (data: Record<string, unknown>, label: string): number | null => {
  const stats = data.stats;
  if (!Array.isArray(stats)) return null;
  const entry = stats.find((candidate) => candidate != null && typeof candidate === 'object'
    && (candidate as { label?: unknown }).label === label) as { value?: unknown } | undefined;
  const value = Number(entry?.value);
  return Number.isFinite(value) ? value : null;
};

function difficultyStats(data: Record<string, unknown>, raw: Record<string, string> = {}): Record<string, unknown> {
  const base = {
    level: numericStat(data, 'Level'),
    hpMin: numericStat(data, 'HP Min'),
    hpMax: numericStat(data, 'HP Max'),
    armourClass: numericStat(data, 'Armor Class'),
    damageMin: numericStat(data, 'Damage Min'),
    damageMax: numericStat(data, 'Damage Max'),
    toHit: numericStat(data, 'To Hit'),
    xp: numericStat(data, 'XP'),
  };
  const missing = Object.entries(base).filter(([, value]) => value == null).map(([key]) => key);
  if (missing.length) return { difficultyGap: `no per-difficulty stats: missing ${missing.join(', ')}` };

  const hp = { min: base.hpMin!, max: base.hpMax! };
  const damage = { min: base.damageMin!, max: base.damageMax! };
  const normalResistance = resistanceByElement(raw.resistance ?? '');
  const mappedHellResistance = Array.isArray(data.resistanceHell)
    ? data.resistanceHell.filter((flag): flag is string => typeof flag === 'string').join(',')
    : '';
  const hellResistance = resistanceByElement(raw.resistanceHell ?? mappedHellResistance);
  const deriveOne = (difficulty: Difficulty) => {
    const nightmare = difficulty === 'nightmare';
    const hell = difficulty === 'hell';
    const damageTransform = (value: number) => nightmare ? 2 * (value + 2) : hell ? 4 * value + 6 : value;
    return {
      level: base.level! + (nightmare ? 15 : hell ? 30 : 0),
      // PoF's flat Stat Block cannot hold difficulty variants; expose the vanilla single-player columns here.
      hitPoints: monsterHitPoints(hp as IntegerRange, difficulty),
      armourClass: base.armourClass! + (nightmare ? 50 : hell ? 80 : 0),
      damage: { min: damageTransform(damage.min), max: damageTransform(damage.max) },
      toHit: base.toHit! + (nightmare ? 85 : hell ? 120 : 0),
      resistances: hell ? hellResistance : normalResistance,
      xp: nightmare ? 2 * (base.xp! + 1000) : hell ? 4 * (base.xp! + 1000) : base.xp!,
    };
  };
  return {
    byDifficulty: {
      normal: deriveOne('normal'),
      nightmare: deriveOne('nightmare'),
      hell: deriveOne('hell'),
    },
  };
}

const csv = (v: unknown): number[] | null => {
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = v.split(',').map((x) => Number(x.trim()));
  return n.every(Number.isFinite) ? n : null;
};

/** Timing-only projection, also used when a named monster overrides its base type's AI/intelligence but keeps its animations. */
export function deriveMonsterTiming(data: Record<string, unknown>, ai: string, intelligenceOverride?: number): Record<string, unknown> {
  const frames = csv(data.animFrames);
  const rates = csv(data.animRates);
  const locomotionMissing = [
    !frames || frames.length < 2 ? 'animFrames' : '',
    !rates || rates.length < 2 ? 'animRates' : '',
  ].filter(Boolean);
  if (locomotionMissing.length) return { gap: `no derived locomotion: missing ${locomotionMissing.join(', ')}` };

  const t = timingLaw();
  const walkTicks = walkTicksPerStep({ walkFrames: frames![1], walkRate: rates![1] }, t.walkExtraTicks);
  const locomotion = {
    laws: ['d1-timing-law'],
    walkTicksPerStep: walkTicks,
    tilesPerSecondWhileWalking: t.ticksPerSecond / walkTicks,
  };
  let attackKinds: ReturnType<typeof attackKindsOf>;
  try {
    attackKinds = attackKindsOf(ai);
  } catch (err) {
    return {
      locomotion,
      gap: `${(err as Error).message}; only the while-walking upper bound is known — effective tilesPerSecond needs the routine's cadence model`,
    };
  }

  const base = {
    laws: ['d1-timing-law', AI_LAW_IDS[ai]],
    attackKinds,
    locomotion,
  };
  const action = Number(data.attackActionFrame);
  const intelligence = intelligenceOverride ?? Number(data.intelligence);
  const cadenceMissing = [
    frames!.length < 3 ? 'animFrames' : '',
    rates!.length < 3 ? 'animRates' : '',
    !Number.isFinite(action) ? 'attackActionFrame' : '',
    !Number.isFinite(intelligence) ? 'intelligence' : '',
  ].filter(Boolean);
  if (cadenceMissing.length) {
    return {
      ...base,
      gap: `no derived cadence: missing ${cadenceMissing.join(', ')}; only the while-walking upper bound is known — effective tilesPerSecond needs the routine's cadence model`,
    };
  }

  const hitDelaySeconds = actionMarkerTick(action, rates![2]) / t.ticksPerSecond;
  try {
    const routineLaw = aiRoutineLaw(ai);
    const ticks = expectedTicks({
      walkFrames: frames![1], walkRate: rates![1],
      attackFrames: frames![2], attackRate: rates![2],
      specialAttackFrames: frames![5], specialAttackRate: rates![5],
      actionFrame: action, ai, intelligence,
    }, t.walkExtraTicks);
    return {
      ...base,
      walkTicksPerStep: ticks.step,
      tilesPerSecond: t.ticksPerSecond / ticks.step,
      attackCycleTicks: ticks.attack,
      attackCycleSeconds: ticks.attack / t.ticksPerSecond,
      ...(ticks.shoot === undefined ? {} : {
        shootCycleTicks: ticks.shoot,
        shootCycleSeconds: ticks.shoot / t.ticksPerSecond,
      }),
      ...(routineLaw.phaseGap === undefined ? {} : {
        cadencePhase: routineLaw.phase,
        cadenceStateGap: routineLaw.phaseGap,
      }),
      hitDelaySeconds,
    };
  } catch (err) {
    // The gap applies only to routine cadence. Locomotion, attack kinds and animation hit timing remain valid.
    return {
      ...base,
      hitDelaySeconds,
      gap: `${(err as Error).message}; only the while-walking upper bound is known — effective tilesPerSecond needs the routine's cadence model`,
    };
  }
}

export const MONSTER_DERIVE: DeriveSpec = {
  version: () => contentHash({
    code: CODE_REVISION,
    laws: behaviourLawTexts(),
    difficultyLaws: DIFFICULTY_LAW_IDS.map((id) => DIABLO1_CANON.find((law) => law.id === id)?.body ?? `missing:${id}`),
  }),
  derive: (e, raw) => {
    const difficulty = difficultyStats(e.data, raw);
    return {
      ...difficulty,
      ...deriveMonsterTiming(e.data, e.tags?.[0] ?? ''),
    };
  },
};

/**
 * An affix tier's derived facts (/diablo W11, D1): its SIDE — the table it comes from (prefix or suffix), which is not a
 * column — and what its power modifies in PoF, from the power vocabulary (`diablo1Affixes.AFFIX_POWERS`). An unknown power
 * is a declared gap naming it (an upstream addition must surface, never map silently).
 */
export function affixDerive(side: 'prefix' | 'suffix'): DeriveSpec {
  return {
    version: () => contentHash({ code: 'affix-tier@1', side, powers: AFFIX_POWERS }),
    derive: (e) => {
      const power = typeof e.data.power === 'string' ? e.data.power : '';
      const t = affixTargetsOf(power);
      if (!t) return { side, gap: `power "${power}" is not in the affix power vocabulary (diablo1Affixes.AFFIX_POWERS)` };
      return { side, targets: t.targets, sign: t.sign, grade: t.grade, reason: t.reason };
    },
  };
}
