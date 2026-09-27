import {
  blockProbability,
  expectedHitsToKill,
  hitRecovery,
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
  type DamageDistribution,
  type Element,
  type GameMode,
  type MonsterProfile,
  type PlayerBuild,
} from '@/lib/catalog/reference/combatMath';
import { damageOutcomes, manaCost } from '@/lib/catalog/reference/spellMath';
import { spellSpec } from '@/lib/catalog/reference/spellSpecs';

export type PlayerAttackMode = 'melee' | 'ranged' | 'spell';
export type DuelExchangeModel = 'per-hero-action' | 'cadence';

export interface DuelSpellAttack {
  spell: string;
  spellLevel: number;
  baseMana: number;
  manaAdj: number;
  minMana: number;
  maxManaBaseInternal?: number;
}

export interface DuelMonsterDamageEvent {
  readonly damage: DamageDistribution;
  readonly expectedHitChecks: number;
  readonly alreadyShifted?: boolean;
  /** PlayerMHit distance stored on this missile; persistent children start at zero. */
  readonly missileDistance?: number;
}

/** Ranged heroes start at this explicit model distance unless a caller supplies another. */
export const DEFAULT_RANGED_ENGAGEMENT_DISTANCE = 4;

export interface DuelOptions {
  gameMode?: GameMode;
  playerAttack: PlayerAttackMode;
  /** Cadence is the default; omit its timing to fall back to the legacy per-hero-action exchange. */
  exchangeModel?: DuelExchangeModel;
  /** Fixed firing separation for a ranged duel. Defaults to four tiles. */
  engagementDistance?: number;
  /** Backwards-compatible alias for engagementDistance. */
  playerDistance?: number;
  /** Effective monster locomotion; omit only when no approach model is requested. */
  monsterApproachTilesPerSecond?: number;
  /** Expected interval between attacks in the monster's current adjacent/at-range routine phase. */
  monsterAttackCycleSeconds?: number;
  spell?: DuelSpellAttack;
  /** Class cast animation duration from combatMath.castTiming. */
  playerCastSeconds?: number;
  monsterAttack: 'melee' | 'ranged-arrow' | 'ranged-magic';
  monsterDistance?: number;
  dungeonLevel: number;
  playerMode?: 'standing' | 'attacking' | 'other';
  playerGetHit?: number;
  /** Enables PM_GOTHIT reporting using the caller's class-animation recovery duration. */
  playerHitRecoverySeconds?: number;
  monsterElement?: Element;
  /** Per-projectile source override for monster missiles and charge impacts. */
  monsterDamage?: DamageDistribution;
  /** Independently resolved projectiles emitted by one monster attack animation. */
  monsterProjectilesPerAttack?: number;
  /**
   * Expected collision checks made by those projectiles. Persistent-missile counts assume the hero stays on the
   * covered tile for the full lifetime; every check gets an independent PlayerMHit to-hit roll.
   */
  monsterHitChecksPerAttack?: number;
  /** PlayerMHit's shifted collision path disables vanilla blocking. */
  monsterDamageAlreadyShifted?: boolean;
  /** Separate per-hit damage/collision laws for compound attacks such as Acid plus its puddle child. */
  monsterDamageEvents?: readonly DuelMonsterDamageEvent[];
}

/**
 * Expected-value duel using only the engine-law functions in `combatMath`.
 * Damage remains in the engine's fixed-point units (64 = one hit point).
 */
export function duel(build: PlayerBuild, coefficients: ClassCoefficients, monster: MonsterProfile, opts: DuelOptions) {
  const gameMode = opts.gameMode ?? monster.gameMode ?? 'single';
  const requestedExchangeModel = opts.exchangeModel ?? 'cadence';
  if (!(['per-hero-action', 'cadence'] as const).includes(requestedExchangeModel)) {
    throw new Error(`unknown duel exchange model ${opts.exchangeModel}`);
  }
  const engagementDistance = opts.engagementDistance ?? opts.playerDistance ?? DEFAULT_RANGED_ENGAGEMENT_DISTANCE;
  if (!Number.isFinite(engagementDistance) || engagementDistance < 0) {
    throw new Error(`engagementDistance must be a non-negative finite number (got ${engagementDistance})`);
  }
  if (opts.monsterApproachTilesPerSecond !== undefined
    && (!Number.isFinite(opts.monsterApproachTilesPerSecond) || opts.monsterApproachTilesPerSecond <= 0)) {
    throw new Error(`monsterApproachTilesPerSecond must be a positive finite number (got ${opts.monsterApproachTilesPerSecond})`);
  }
  if (opts.monsterAttackCycleSeconds !== undefined
    && (!Number.isFinite(opts.monsterAttackCycleSeconds) || opts.monsterAttackCycleSeconds <= 0)) {
    throw new Error(`monsterAttackCycleSeconds must be a positive finite number (got ${opts.monsterAttackCycleSeconds})`);
  }
  if (opts.playerHitRecoverySeconds !== undefined
    && (!Number.isFinite(opts.playerHitRecoverySeconds) || opts.playerHitRecoverySeconds < 0)) {
    throw new Error(`playerHitRecoverySeconds must be a non-negative finite number (got ${opts.playerHitRecoverySeconds})`);
  }
  const monsterProjectilesPerAttack = opts.monsterProjectilesPerAttack ?? 1;
  if (!Number.isInteger(monsterProjectilesPerAttack) || monsterProjectilesPerAttack < 1) {
    throw new Error(`monsterProjectilesPerAttack must be a positive integer (got ${monsterProjectilesPerAttack})`);
  }
  const monsterHitChecksPerAttack = opts.monsterDamageEvents?.reduce(
    (sum, event) => sum + event.expectedHitChecks,
    0,
  ) ?? opts.monsterHitChecksPerAttack ?? monsterProjectilesPerAttack;
  if (!Number.isFinite(monsterHitChecksPerAttack) || monsterHitChecksPerAttack < 0) {
    throw new Error(`monsterHitChecksPerAttack must be a non-negative finite number (got ${monsterHitChecksPerAttack})`);
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
      : playerSpellHitChance(build, coefficients, monster, 0, spellElement) /* d1-spell-cast-law: a spell missile's distance counter never advances — effective distance 0 at any range (W20; cx-b50 had passed the engagement distance) */;
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
  const approachDistance = opts.playerAttack !== 'melee' && opts.monsterAttack === 'melee'
    && opts.monsterApproachTilesPerSecond !== undefined
    ? Math.max(0, engagementDistance - 1)
    : 0;
  const approachSeconds = opts.monsterApproachTilesPerSecond === undefined
    ? 0
    : approachDistance / opts.monsterApproachTilesPerSecond;
  const freePlayerActionCapacity = playerSwingSeconds === null || playerSwingSeconds === 0
    ? 0
    : Math.floor(approachSeconds / playerSwingSeconds);
  const expectedFreePlayerActions = Math.min(expectedPlayerSwingsToKill, freePlayerActionCapacity);
  const expectedPlayerSecondsToKill = playerSwingSeconds === null
    ? null
    : expectedPlayerSwingsToKill <= freePlayerActionCapacity
      ? expectedPlayerSwingsToKill * playerSwingSeconds
      : approachSeconds + (expectedPlayerSwingsToKill - freePlayerActionCapacity) * playerSwingSeconds;
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

  const monsterHitChanceAt = (missileDistance?: number) => opts.monsterAttack === 'melee'
    ? monsterMeleeHitChance(build, monster, opts.dungeonLevel)
    : monsterRangedHitChance(build, monster, {
      distance: missileDistance ?? opts.monsterDistance ?? engagementDistance,
      dungeonLevel: opts.dungeonLevel,
      projectile: opts.monsterAttack === 'ranged-arrow' ? 'arrow' : 'magic',
    });
  const monsterDamage = opts.monsterDamage ?? monsterDamageByDifficulty(monster, {
    playerGetHit: opts.playerGetHit,
    attack: opts.monsterAttack === 'melee' ? 'melee' : 'projectile',
  }).damage;
  const monsterElement = opts.monsterElement ?? (opts.monsterAttack === 'ranged-magic' ? 'magic' : 'physical');
  const resistance = playerResistance(build, 0, monsterElement).resistance;
  const damageEvents = opts.monsterDamageEvents ?? [{
    damage: monsterDamage,
    expectedHitChecks: monsterHitChecksPerAttack,
    alreadyShifted: opts.monsterDamageAlreadyShifted,
  }];
  if (damageEvents.length === 0) throw new Error('monsterDamageEvents must not be empty');
  for (const event of damageEvents) {
    if (!Number.isFinite(event.expectedHitChecks) || event.expectedHitChecks < 0) {
      throw new Error(`monster damage event expectedHitChecks must be non-negative and finite (got ${event.expectedHitChecks})`);
    }
  }
  const resolvedDamageEvents = damageEvents.map((event) => {
    const hitChance = monsterHitChanceAt(event.missileDistance);
    const block = blockProbability(build, coefficients, monster, hitChance, {
      kind: opts.monsterAttack === 'melee' ? 'melee' : 'missile',
      playerMode: opts.playerMode,
      resistance,
      alreadyShifted: event.alreadyShifted,
    });
    const resistedDamageMean = event.damage.outcomes.reduce(
      (sum, outcome) => sum + playerResistance(build, outcome.damage, monsterElement).damage * outcome.weight,
      0,
    ) / event.damage.expectedDenominator;
    return { ...event, hitChance, block, resistedDamageMean };
  });
  const primaryEvent = resolvedDamageEvents[0];
  const monsterHitChance = primaryEvent.hitChance;
  const block = primaryEvent.block;
  const expectedMonsterDamagePerHit = primaryEvent.resistedDamageMean * (1 - block.conditionalBlockChance);
  // Persistent missiles repeat PlayerMHit rather than dealing automatic damage: E[attack damage] is the expected
  // collision-check count × per-check damaging-hit chance × resisted per-hit damage.
  const expectedMonsterDamagePerSwing = resolvedDamageEvents.reduce(
    (sum, event) => sum + event.resistedDamageMean * event.block.damagingHitChance * event.expectedHitChecks,
    0,
  );
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
  const perHeroActionMonsterAttacksBeforeKill = Math.max(
    0,
    expectedPlayerSwingsToKill
      - (opts.monsterAttack === 'melee' ? freePlayerActionCapacity : 0)
      - 1,
  );
  const cadenceAvailable = requestedExchangeModel === 'cadence'
    && opts.monsterAttackCycleSeconds !== undefined
    && expectedPlayerSecondsToKill !== null;
  const exchangeModel: DuelExchangeModel = cadenceAvailable ? 'cadence' : 'per-hero-action';
  // The hero starts its first action at t=0. A cadence-model monster accrues attacks only while able to attack:
  // ranged attackers are in range immediately, while melee approach time remains attack-free. The stationary
  // expected rate starts at engagement, so the mean first arrival is one full cycle later; a fractional final
  // cycle is retained as expected exposure instead of being rounded to a discrete attack.
  const monsterAttackExposureSeconds = expectedPlayerSecondsToKill === null
    ? null
    : opts.monsterAttack === 'melee'
      ? Math.max(0, expectedPlayerSecondsToKill - approachSeconds)
      : expectedPlayerSecondsToKill;
  const expectedMonsterAttacksBeforeKill = cadenceAvailable
    ? monsterAttackExposureSeconds! / opts.monsterAttackCycleSeconds!
    : perHeroActionMonsterAttacksBeforeKill;
  const noGotHitChancePerMonsterAttack = resolvedDamageEvents.reduce((product, event) => {
    const qualifyingDamageChance = event.damage.outcomes.reduce((sum, outcome) => {
      const damage = playerResistance(build, outcome.damage, monsterElement).damage;
      return sum + (hitRecovery(build, monster, damage).player.starts ? outcome.weight : 0);
    }, 0) / event.damage.expectedDenominator;
    const gotHitChancePerCheck = event.block.damagingHitChance * qualifyingDamageChance;
    return product * (1 - gotHitChancePerCheck) ** event.expectedHitChecks;
  }, 1);
  const gotHitChancePerMonsterAttack = 1 - noGotHitChancePerMonsterAttack;
  const expectedGotHitInterruptionsBeforeKill = gotHitChancePerMonsterAttack === 0
    ? 0
    : expectedMonsterAttacksBeforeKill * gotHitChancePerMonsterAttack;
  const gotHitInterruptionsPerSecond = expectedGotHitInterruptionsBeforeKill === 0
    ? 0
    : expectedPlayerSecondsToKill === null || expectedPlayerSecondsToKill === 0
      ? Infinity
      : expectedGotHitInterruptionsBeforeKill / expectedPlayerSecondsToKill;

  return {
    gameMode,
    ...(exchangeModel === 'cadence' ? {
      exchangeModel,
      monsterAttackCycleSeconds: opts.monsterAttackCycleSeconds!,
      monsterAttackExposureSeconds: monsterAttackExposureSeconds!,
    } : {}),
    playerHitChance,
    expectedPlayerDamagePerSwing,
    expectedPlayerHitsToKill,
    expectedPlayerSwingsToKill,
    playerSwingSeconds,
    expectedPlayerSecondsToKill,
    monsterHitChance,
    monsterElement,
    monsterProjectilesPerAttack,
    monsterHitChecksPerAttack,
    expectedMonsterDamagePerHit,
    expectedMonsterHitsToKillPlayer,
    expectedMonsterDamagePerSwing,
    monsterConditionalBlockChance: block.conditionalBlockChance,
    expectedMonsterAttacksBeforeKill,
    expectedMonsterSwingsToKillPlayer: monsterHitChance > 0
      && monsterHitChecksPerAttack > 0
      ? expectedMonsterHitsToKillPlayer / (monsterHitChance * monsterHitChecksPerAttack)
      : Infinity,
    ...(opts.playerHitRecoverySeconds !== undefined ? {
      gotHit: {
        chancePerMonsterAttack: gotHitChancePerMonsterAttack,
        expectedInterruptionsBeforeKill: expectedGotHitInterruptionsBeforeKill,
        interruptionsPerSecond: gotHitInterruptionsPerSecond,
        recoverySeconds: opts.playerHitRecoverySeconds,
      },
    } : {}),
    ...(approachDistance > 0 ? {
      approach: {
        engagementDistance,
        distanceToAdjacency: approachDistance,
        tilesPerSecond: opts.monsterApproachTilesPerSecond!,
        seconds: approachSeconds,
        freePlayerActionCapacity,
        expectedFreePlayerActions,
      },
    } : {}),
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
