import {
  blockProbability,
  expectedHitsToKill,
  lifeAndMana,
  monsterDamageByDifficulty,
  monsterHitPointDistribution,
  monsterMeleeHitChance,
  monsterRangedHitChance,
  monsterResistance,
  playerMeleeDamage,
  playerMeleeHitChance,
  playerRangedDamage,
  playerRangedHitChance,
  playerResistance,
  playerSpellHitChance,
  FIXED_POINT,
  type ClassCoefficients,
  type Element,
  type GameMode,
  type MonsterProfile,
  type PlayerBuild,
} from '@/lib/catalog/reference/combatMath';
import { damageOutcomes, manaCost } from '@/lib/catalog/reference/spellMath';
import { spellSpec } from '@/lib/catalog/reference/spellSpecs';

export type PlayerAttackMode = 'melee' | 'ranged' | 'spell';

export interface DuelSpellAttack {
  spell: string;
  spellLevel: number;
  baseMana: number;
  manaAdj: number;
  minMana: number;
  maxManaBaseInternal?: number;
}

/**
 * Ranged shots use this fixed separation unless a caller supplies `engagementDistance`.
 * The monster is assumed to close the gap before its ordinary melee counterattack; travel
 * time and shots during that movement are deliberately outside this exchange model.
 */
export const DEFAULT_RANGED_ENGAGEMENT_DISTANCE = 4;

export interface DuelOptions {
  gameMode?: GameMode;
  playerAttack: PlayerAttackMode;
  /** Fixed firing separation for a ranged duel. Defaults to four tiles. */
  engagementDistance?: number;
  /** Backwards-compatible alias for engagementDistance. */
  playerDistance?: number;
  spell?: DuelSpellAttack;
  /** Class cast animation duration from combatMath.castTiming. */
  playerCastSeconds?: number;
  monsterAttack: 'melee' | 'ranged-arrow' | 'ranged-magic';
  monsterDistance?: number;
  dungeonLevel: number;
  playerMode?: 'standing' | 'attacking' | 'other';
  playerGetHit?: number;
  monsterElement?: Element;
}

/**
 * Expected-value duel using only the engine-law functions in `combatMath`.
 * Damage remains in the engine's fixed-point units (64 = one hit point).
 */
export function duel(build: PlayerBuild, coefficients: ClassCoefficients, monster: MonsterProfile, opts: DuelOptions) {
  const gameMode = opts.gameMode ?? monster.gameMode ?? 'single';
  const engagementDistance = opts.engagementDistance ?? opts.playerDistance ?? DEFAULT_RANGED_ENGAGEMENT_DISTANCE;
  if (!Number.isFinite(engagementDistance) || engagementDistance < 0) {
    throw new Error(`engagementDistance must be a non-negative finite number (got ${engagementDistance})`);
  }
  const selectedSpell = opts.playerAttack === 'spell' ? opts.spell : undefined;
  if (opts.playerAttack === 'spell' && !selectedSpell) throw new Error('spell attack mode requires spell inputs');
  const selectedSpellSpec = selectedSpell ? spellSpec(selectedSpell.spell) : undefined;
  if (selectedSpell && (!selectedSpellSpec || selectedSpellSpec.damage.kind === 'none' || selectedSpellSpec.element === 'none')) {
    throw new Error(`${selectedSpell.spell} is not a damaging vanilla spell`);
  }
  const spellElement = selectedSpellSpec?.element as Element | undefined;
  const playerHitChance = opts.playerAttack === 'melee'
    ? playerMeleeHitChance(build, coefficients, monster)
    : opts.playerAttack === 'ranged'
      ? playerRangedHitChance(build, coefficients, monster, engagementDistance)
      : playerSpellHitChance(build, coefficients, monster, 0, spellElement);
  const playerDamage = opts.playerAttack === 'melee'
    ? playerMeleeDamage(build, coefficients, monster)
    : opts.playerAttack === 'ranged'
      ? playerRangedDamage(build, monster)
      : (() => {
          const outcomes = damageOutcomes(selectedSpell!.spell, {
            spellLevel: selectedSpell!.spellLevel,
            characterLevel: build.level,
            magic: build.magic,
          }).map((outcome) => ({
            damage: monsterResistance(monster, Math.trunc(outcome.damage * FIXED_POINT), spellElement!).damage,
            weight: outcome.weight,
          }));
          const expectedDenominator = outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
          const expectedNumerator = outcomes.reduce((sum, outcome) => sum + outcome.damage * outcome.weight, 0);
          return {
            min: Math.min(...outcomes.map((outcome) => outcome.damage)),
            max: Math.max(...outcomes.map((outcome) => outcome.damage)),
            mean: expectedNumerator / expectedDenominator,
            expectedNumerator,
            expectedDenominator,
            outcomes,
          };
        })();
  const expectedPlayerDamagePerSwing = playerHitChance * playerDamage.mean;
  const monsterHitPoints = monsterHitPointDistribution(monster.hitPoints, monster.difficulty, gameMode);
  const expectedPlayerHitsToKill = expectedHitsToKill(monsterHitPoints, playerDamage.outcomes);
  const expectedPlayerSwingsToKill = playerHitChance > 0 ? expectedPlayerHitsToKill / playerHitChance : Infinity;
  const playerSwingSeconds = opts.playerAttack === 'spell'
    ? opts.playerCastSeconds ?? null
    : build.swingSeconds ?? null;
  const expectedPlayerSecondsToKill = playerSwingSeconds === null
    ? null
    : expectedPlayerSwingsToKill * playerSwingSeconds;
  const manaPerCast = selectedSpell
    ? manaCost(selectedSpell.spell, {
        spellLevel: selectedSpell.spellLevel,
        baseMana: selectedSpell.baseMana,
        manaAdj: selectedSpell.manaAdj,
        minMana: selectedSpell.minMana,
        characterLevel: build.level,
        maxManaBaseInternal: selectedSpell.maxManaBaseInternal ?? lifeAndMana(build, coefficients).baseMana,
      }, build.class)
    : undefined;

  const monsterHitChance = opts.monsterAttack === 'melee'
    ? monsterMeleeHitChance(build, monster, opts.dungeonLevel)
    : monsterRangedHitChance(build, monster, {
      distance: opts.monsterDistance ?? 0,
      dungeonLevel: opts.dungeonLevel,
      projectile: opts.monsterAttack === 'ranged-arrow' ? 'arrow' : 'magic',
    });
  const monsterDamage = monsterDamageByDifficulty(monster, {
    playerGetHit: opts.playerGetHit,
    attack: opts.monsterAttack === 'melee' ? 'melee' : 'projectile',
  }).damage;
  const monsterElement = opts.monsterElement ?? (opts.monsterAttack === 'ranged-magic' ? 'magic' : 'physical');
  const resistance = playerResistance(build, 0, monsterElement).resistance;
  const block = blockProbability(build, coefficients, monster, monsterHitChance, {
    kind: opts.monsterAttack === 'melee' ? 'melee' : 'missile',
    playerMode: opts.playerMode,
    resistance,
  });
  const resistedDamageMean = monsterDamage.outcomes.reduce(
    (sum, outcome) => sum + playerResistance(build, outcome.damage, monsterElement).damage * outcome.weight,
    0,
  ) / monsterDamage.expectedDenominator;
  const expectedMonsterDamagePerHit = resistedDamageMean * (1 - block.conditionalBlockChance);
  const expectedMonsterDamagePerSwing = resistedDamageMean * block.damagingHitChance;
  const playerLife = lifeAndMana(build, coefficients).maximumLife;
  const monsterDamageAfterDefence = [
    ...monsterDamage.outcomes.map((outcome) => ({
      damage: playerResistance(build, outcome.damage, monsterElement).damage,
      weight: outcome.weight * (1 - block.conditionalBlockChance),
    })),
    { damage: 0, weight: monsterDamage.expectedDenominator * block.conditionalBlockChance },
  ];
  const expectedMonsterHitsToKillPlayer = expectedHitsToKill(
    [{ hitPoints: playerLife, weight: 1 }],
    monsterDamageAfterDefence,
  );

  return {
    gameMode,
    playerHitChance,
    expectedPlayerDamagePerSwing,
    expectedPlayerHitsToKill,
    expectedPlayerSwingsToKill,
    playerSwingSeconds,
    expectedPlayerSecondsToKill,
    monsterHitChance,
    expectedMonsterDamagePerHit,
    expectedMonsterHitsToKillPlayer,
    expectedMonsterDamagePerSwing,
    expectedMonsterSwingsToKillPlayer: monsterHitChance > 0 ? expectedMonsterHitsToKillPlayer / monsterHitChance : Infinity,
    ...(opts.playerAttack === 'ranged' ? { attackMode: 'ranged' as const, engagementDistance } : {}),
    ...(selectedSpell && manaPerCast !== undefined ? {
      attackMode: 'spell' as const,
      spell: selectedSpell.spell,
      spellLevel: selectedSpell.spellLevel,
      playerCastSeconds: playerSwingSeconds,
      manaPerCast,
      expectedManaSpentPerKill: expectedPlayerSwingsToKill * manaPerCast,
    } : {}),
  };
}
