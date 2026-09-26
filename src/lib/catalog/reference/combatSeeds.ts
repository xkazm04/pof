import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import { duel } from '@/lib/catalog/reference/combatDuel';
import {
  FIXED_POINT,
  blockProbability,
  experienceCurveLaw,
  lifeAndMana,
  playerMeleeDamage,
  playerMeleeHitChance,
  type Difficulty,
  type GameMode,
  type MonsterProfile,
} from '@/lib/catalog/reference/combatMath';
import { classCoefficients, monsterProfile, referenceBuild } from '@/lib/catalog/reference/combatInputs';
import type { ExperienceCurveWrapper } from '@/lib/catalog/reference/experienceCurve';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

type CurveSource = ExperienceCurveWrapper | Pick<ReferenceWrapper, 'catalogId' | 'entity'>;

function stamp(source: CurveSource | ReferenceWrapper, columns: string[]): SourcedStamp {
  const provenance = source.entity.provenance;
  return {
    sourceGame: provenance.sourceGame,
    sourceFile: provenance.sourceFile,
    sourceRow: provenance.sourceRow,
    columns,
  };
}

function curveLevels(source: CurveSource): { level: number; experience: number }[] {
  const values = source.entity.data.levels;
  if (!Array.isArray(values)) throw new Error(`${source.entity.id} has no data.levels curve`);
  return values.map((value, index) => {
    const row = value as { level?: unknown; experience?: unknown };
    const level = Number(row.level);
    const experience = Number(row.experience);
    if (!Number.isInteger(level) || !Number.isFinite(experience)) {
      throw new Error(`${source.entity.id} has an invalid curve row at index ${index}`);
    }
    return { level, experience };
  });
}

/** Curve Formula is a table lookup for Diablo, so the exact source levels travel with the seed. */
export function seedProgressionCurveSteps(source: CurveSource): StepSeed[] {
  if (source.catalogId !== 'progression-curves' || source.entity.id !== 'd1-xp-curve') return [];
  const levels = curveLevels(source);
  const law = experienceCurveLaw(levels);
  const sampleValues = Object.fromEntries(levels.map(({ level, experience }) => [`L${level}`, experience]));
  return [{
    catalogId: 'progression-curves',
    entityId: source.entity.id,
    step: 'Curve Formula',
    data: {
      curveFormula: {
        formula: 'threshold(L) = thresholds[min(L - 1, maxLevel)]',
        base: levels.find((row) => row.level === 1)?.experience ?? REFERENCE_GAP,
        exponent: REFERENCE_GAP,
        softCap: REFERENCE_GAP,
        hardCap: law.maxLevel,
        levels,
        thresholds: [...law.thresholds],
        sampleValues,
        note: 'Exact cumulative thresholds from Experience.tsv, evaluated by d1-xp-curve-law; this is a lookup table, not a fitted geometric curve.',
      },
      [SOURCED_FIELD]: stamp(source, ['Level', 'Experience', '(law d1-xp-curve-law)']),
    },
    gaps: [
      'curveFormula.exponent: d1-xp-curve-law defines exact table lookup, not a geometric fit',
      'curveFormula.softCap: neither Experience.tsv nor d1-xp-curve-law declares a soft cap',
      ...(levels.some((row) => row.level === 1) ? [] : ['curveFormula.base: the source has no level-1 row']),
    ],
  }];
}

const neutralMonster = (level: number): MonsterProfile => ({
  level,
  hitPoints: { min: 1, max: 1 },
  armourClass: 0,
  toHit: 0,
  damage: { min: 1, max: 1 },
  monsterClass: 'demon',
  resist: {},
  immune: {},
  difficulty: 'normal',
});

/** Level-1 vanilla class Stat Block, with base attributes and no spent stat points or items. */
export function seedCharacterCombatSteps(classWrapper: ReferenceWrapper): StepSeed[] {
  if (classWrapper.catalogId !== 'characters' || !/^d1-class-(warrior|rogue|sorcerer)$/.test(classWrapper.entity.id)) return [];
  const level = 1;
  const coefficients = classCoefficients(classWrapper);
  const build = referenceBuild(classWrapper, level);
  const target = neutralMonster(level);
  const pools = lifeAndMana(build, coefficients);
  const damage = playerMeleeDamage(build, coefficients, target);
  const hitChance = playerMeleeHitChance(build, coefficients, target);
  const block = blockProbability(build, coefficients, target, 1, { kind: 'melee' });
  return [{
    catalogId: 'characters',
    entityId: classWrapper.entity.id,
    step: 'Stat Block',
    data: {
      stats: {
        strength: build.strength,
        magic: build.magic,
        dexterity: build.dexterity,
        vitality: build.vitality,
        health: pools.maximumLife / FIXED_POINT,
        mana: pools.maximumMana / FIXED_POINT,
        damage: { minimum: damage.min / FIXED_POINT, maximum: damage.max / FIXED_POINT },
        armor: Math.trunc(build.dexterity / 5),
        moveSpeed: REFERENCE_GAP,
        toHit: hitChance * 100,
        block: block.conditionalBlockChance * 100,
        level,
        basis: 'base class attributes; no stat points spent; no items equipped; one-point bare-handed damage',
      },
      [SOURCED_FIELD]: stamp(classWrapper, [
        'baseStr', 'baseMag', 'baseDex', 'baseVit', 'blockBonus', 'adjLife', 'adjMana', 'lvlLife', 'lvlMana',
        'chrLife', 'chrMana', 'baseMeleeToHit',
        '(laws d1-combat-life-mana-law, d1-combat-melee-to-hit-law, d1-combat-player-melee-damage-law, d1-combat-monster-melee-to-hit-law, d1-combat-block-law)',
      ]),
    },
    gaps: ['stats.moveSpeed: neither the class attributes table nor a combat law states movement speed'],
  }];
}

/** Encounter Balance for one monster against a same-level, base-stat, unarmed Warrior. */
export function seedBestiaryCombatSteps(
  bestiaryWrapper: ReferenceWrapper,
  warriorWrapper: ReferenceWrapper,
  difficulty: Difficulty = 'normal',
  gameMode: GameMode = 'single',
): StepSeed[] {
  if (bestiaryWrapper.catalogId !== 'bestiary' || bestiaryWrapper.file !== 'monsters/monstdat.tsv') return [];
  if (warriorWrapper.entity.id !== 'd1-class-warrior') throw new Error('bestiary combat seeds require d1-class-warrior');
  const monster = monsterProfile(bestiaryWrapper, difficulty, gameMode);
  const coefficients = classCoefficients(warriorWrapper);
  const build = referenceBuild(warriorWrapper, monster.level);
  const result = duel(build, coefficients, monster, {
    gameMode,
    playerAttack: 'melee',
    monsterAttack: 'melee',
    dungeonLevel: Math.min(16, Math.max(1, monster.level)),
  });
  return [{
    catalogId: 'bestiary',
    entityId: bestiaryWrapper.entity.id,
    step: 'Encounter Balance',
    data: {
      balance: {
        threat: REFERENCE_GAP,
        ...result,
        units: {
          expectedPlayerDamagePerSwing: 'fixed-point (64 = one hit point)',
          expectedMonsterDamagePerHit: 'fixed-point (64 = one hit point)',
          expectedMonsterDamagePerSwing: 'fixed-point (64 = one hit point)',
        },
        basis: `${difficulty}; ${gameMode}-player; level-${monster.level} reference Warrior; base attributes; no stat points spent; no items`,
      },
      threat: REFERENCE_GAP,
      [SOURCED_FIELD]: stamp(bestiaryWrapper, [
        'level', 'hitPointsMinimum', 'hitPointsMaximum', 'armorClass', 'toHit', 'minDamage', 'maxDamage',
        'monsterClass', 'resistance',
        `(gameMode ${gameMode})`,
        '(combat laws via duel; class inputs from d1-class-warrior)',
      ]),
    },
    gaps: ['threat: duel() has no counterpart for PoF\'s tier-normalized threat score'],
  }];
}

// Short aliases keep call sites readable while retaining explicit exports for discoverability.
export const seedCharacterSteps = seedCharacterCombatSteps;
export const seedBestiaryEncounterSteps = seedBestiaryCombatSteps;
