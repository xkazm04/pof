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
import {
  expectedMonsterRecoveryStartsPerCast,
  playerSpellCastDamageOutcomes,
  resolvePlayerSpellHits,
  resolvePlayerSpellPackSecondaryHits,
} from '@/lib/catalog/reference/playerSpellHits';
import { spellSpec } from '@/lib/catalog/reference/spellSpecs';

export type PlayerAttackMode = 'melee' | 'ranged' | 'spell';
export type DuelExchangeModel = 'per-hero-action' | 'cadence';
export type SpellAreaInPacksPolicy = 'off' | 'expected';

export interface DuelSpellAttack {
  spell: string;
  spellLevel: number;
  baseMana: number;
  manaAdj: number;
  minMana: number;
  maxManaBaseInternal?: number;
  /** Runtime ApocalypseBoom sprite length; no reference-table value is copied into source. */
  apocalypseBoomAnimationTicks?: number;
  /** A Nova target on a cardinal ray is crossed by both duplicated balls. */
  novaCardinalRay?: boolean;
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
  /** Opt-in pack-only spell geometry; omitted/off leaves the duel result byte-compatible. */
  spellAreaInPacks?: SpellAreaInPacksPolicy;
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
  /** Data-defined GotHit animation duration used to remove interrupted monster attack time. */
  monsterHitRecoverySeconds?: number;
  /** IsHardHit's four type exceptions; all other monsters use the damage threshold. */
  monsterFamily?: 'sneak' | 'stalker' | 'unseen' | 'illusion-weaver' | 'other';
  /** Golems play the sound but do not enter MonsterMode::HitRecovery. */
  monsterCanHitRecover?: boolean;
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
  const spellAreaInPacks = opts.spellAreaInPacks ?? 'off';
  if (!(['off', 'expected'] as const).includes(spellAreaInPacks)) {
    throw new Error(`unknown spell-area-in-packs policy ${opts.spellAreaInPacks}`);
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
  if (opts.monsterHitRecoverySeconds !== undefined
    && (!Number.isFinite(opts.monsterHitRecoverySeconds) || opts.monsterHitRecoverySeconds < 0)) {
    throw new Error(`monsterHitRecoverySeconds must be a non-negative finite number (got ${opts.monsterHitRecoverySeconds})`);
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
  const spellHits = selectedSpell ? resolvePlayerSpellHits(selectedSpell.spell, {
    spellLevel: selectedSpell.spellLevel,
    characterLevel: build.level,
    targetDistance: engagementDistance,
    novaCardinalRay: selectedSpell.novaCardinalRay,
    apocalypseBoomAnimationTicks: selectedSpell.apocalypseBoomAnimationTicks,
  }) : undefined;
  const secondaryPackSpellHits = selectedSpell && spellAreaInPacks === 'expected'
    ? resolvePlayerSpellPackSecondaryHits(selectedSpell.spell, {
        spellLevel: selectedSpell.spellLevel,
        characterLevel: build.level,
        targetDistance: engagementDistance,
        novaCardinalRay: selectedSpell.novaCardinalRay,
        apocalypseBoomAnimationTicks: selectedSpell.apocalypseBoomAnimationTicks,
      })
    : undefined;
  const playerCastDamage = spellHits
    ? playerSpellCastDamageOutcomes(playerDamage.outcomes, playerHitChance, spellHits.groups)
    : undefined;
  const playerCastDamageWeight = playerCastDamage?.reduce((sum, outcome) => sum + outcome.weight, 0) ?? 0;
  const expectedPlayerDamagePerSwing = playerCastDamage
    ? playerCastDamage.reduce((sum, outcome) => sum + outcome.damage * outcome.weight, 0) / playerCastDamageWeight
    : playerHitChance * playerDamage.mean;
  const secondaryPackCastDamage = secondaryPackSpellHits
    ? playerSpellCastDamageOutcomes(playerDamage.outcomes, playerHitChance, secondaryPackSpellHits.groups)
    : undefined;
  const secondaryPackCastDamageWeight = secondaryPackCastDamage
    ?.reduce((sum, outcome) => sum + outcome.weight, 0) ?? 0;
  const secondaryPackActivationChance = secondaryPackSpellHits?.activation === 'primary-hit'
    ? playerHitChance
    : 1;
  const expectedSecondaryPackDamagePerCast = secondaryPackCastDamage && secondaryPackCastDamageWeight > 0
    ? secondaryPackActivationChance * secondaryPackCastDamage.reduce(
        (sum, outcome) => sum + outcome.damage * outcome.weight,
        0,
      ) / secondaryPackCastDamageWeight
    : 0;
  const monsterHitPoints = monsterHitPointDistribution(monster.hitPoints, monster.difficulty, gameMode);
  const expectedPlayerHitsToKill = expectedHitsToKill(monsterHitPoints, playerDamage.outcomes);
  const expectedPlayerSwingsToKill = playerCastDamage
    ? expectedHitsToKill(monsterHitPoints, playerCastDamage)
    : playerHitChance > 0 ? expectedPlayerHitsToKill / playerHitChance : Infinity;
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
  const playerPools = lifeAndMana(build, coefficients);
  const playerLife = playerPools.maximumLife;
  const expectedStealPerLandedHit = (percent: number | undefined) => {
    if (opts.playerAttack !== 'melee' || percent === undefined || percent <= 0) return 0;
    const weight = playerDamage.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
    if (weight === 0) return 0;
    return playerDamage.outcomes.reduce(
      (sum, outcome) => sum + Math.trunc(percent * Math.max(0, outcome.damage) / 100) * outcome.weight,
      0,
    ) / weight / FIXED_POINT;
  };
  const expectedLifeStolenPerLandedHit = expectedStealPerLandedHit(build.lifeStealPercent);
  const expectedManaStolenPerLandedHit = expectedStealPerLandedHit(build.manaStealPercent);
  const expectedLifeStolenPerKill = Number.isFinite(expectedPlayerHitsToKill)
    ? Math.min(playerLife / FIXED_POINT, expectedPlayerHitsToKill * expectedLifeStolenPerLandedHit)
    : 0;
  const expectedManaStolenPerKill = Number.isFinite(expectedPlayerHitsToKill)
    ? Math.min(playerPools.maximumMana / FIXED_POINT, expectedPlayerHitsToKill * expectedManaStolenPerLandedHit)
    : 0;
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
  const baseMonsterAttackExposureSeconds = expectedPlayerSecondsToKill === null
    ? null
    : opts.monsterAttack === 'melee'
      ? Math.max(0, expectedPlayerSecondsToKill - approachSeconds)
      : expectedPlayerSecondsToKill;
  const spellResistance = spellElement === undefined
    ? undefined
    : monsterResistance(monster, FIXED_POINT, spellElement);
  const startsMonsterRecovery = (damage: number) => opts.monsterCanHitRecover !== false
    && spellResistance?.immune !== true
    && hitRecovery(build, monster, damage, {
      monsterFamily: opts.monsterFamily,
      resistantMissile: spellResistance?.resistant,
    }).monster.startsAnimation;
  const monsterRecoveryStartsPerCast = selectedSpell && spellHits
    ? expectedMonsterRecoveryStartsPerCast(
        playerDamage.outcomes,
        playerHitChance,
        spellHits.groups,
        startsMonsterRecovery,
      )
    : 0;
  const secondaryMonsterRecoveryStartsPerCast = selectedSpell && secondaryPackSpellHits
    ? secondaryPackActivationChance * expectedMonsterRecoveryStartsPerCast(
        playerDamage.outcomes,
        playerHitChance,
        secondaryPackSpellHits.groups,
        startsMonsterRecovery,
      )
    : 0;
  const playerDamageWeight = playerDamage.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
  const hardHitChance = playerDamageWeight === 0 ? 0 : playerDamage.outcomes.reduce(
    (sum, outcome) => sum + (startsMonsterRecovery(outcome.damage) ? outcome.weight : 0),
    0,
  ) / playerDamageWeight;
  const physicalRecoveryEnabled = opts.playerAttack !== 'spell' && (build.knockbackProbability ?? 0) > 0;
  const knockbackProbability = physicalRecoveryEnabled && monster.petrified !== true
    && opts.monsterCanHitRecover !== false
    ? Math.min(1, Math.max(0, build.knockbackProbability ?? 0))
    : 0;
  const qualifyingLandedHitChance = physicalRecoveryEnabled
    ? knockbackProbability + (1 - knockbackProbability) * hardHitChance
    : hardHitChance;
  // MonsterMHit kills instead of calling M_StartHit on the fatal collision. Expected landed hits before that final
  // collision therefore supply the recovery reward; this also keeps a one-hit kill from inventing a retroactive stun.
  const expectedMonsterRecoveryStartsBeforeKill = (selectedSpell || physicalRecoveryEnabled)
    && qualifyingLandedHitChance > 0
    ? Math.max(0, expectedPlayerHitsToKill - 1) * qualifyingLandedHitChance
    : 0;
  // Mirror the W43 interruption load on the defending monster: qualifying hits restart GotHit, so their expected
  // recovery time removes attack opportunity. At load >= 1 the stationary target is hard-hit stun-locked.
  const monsterRecoveryLoad = opts.monsterHitRecoverySeconds === undefined || expectedPlayerSecondsToKill === null
    || expectedPlayerSecondsToKill === 0 || !Number.isFinite(expectedMonsterRecoveryStartsBeforeKill)
    ? 0
    : expectedMonsterRecoveryStartsBeforeKill * opts.monsterHitRecoverySeconds / expectedPlayerSecondsToKill;
  const monsterAttackAvailability = Math.max(0, 1 - monsterRecoveryLoad);
  const monsterAttackExposureSeconds = baseMonsterAttackExposureSeconds === null
    ? null
    : monsterAttackAvailability === 0 ? 0 : baseMonsterAttackExposureSeconds * monsterAttackAvailability;
  const expectedMonsterAttacksBeforeKill = cadenceAvailable
    ? monsterAttackExposureSeconds! / opts.monsterAttackCycleSeconds!
    : monsterAttackAvailability === 0 ? 0 : perHeroActionMonsterAttacksBeforeKill * monsterAttackAvailability;
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
  const packMonsterAttackInterval = cadenceAvailable
    ? opts.monsterAttackCycleSeconds!
    : playerSwingSeconds;
  const packBaseDamageTakenPerSecond = packMonsterAttackInterval == null || packMonsterAttackInterval === 0
    ? 0
    : expectedMonsterDamagePerSwing / FIXED_POINT / packMonsterAttackInterval;
  const packBaseGotHitInterruptionsPerSecond = packMonsterAttackInterval == null || packMonsterAttackInterval === 0
    ? 0
    : gotHitChancePerMonsterAttack / packMonsterAttackInterval;

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
    ...(spellHits ? {
      playerSpellHitChecksPerCast: spellHits.maximumCollisionChecks,
      playerSpellCollisionGroups: spellHits.groups,
      playerSpellHitSource: spellHits.source,
    } : {}),
    ...(selectedSpell && secondaryPackSpellHits && playerSwingSeconds != null ? {
      packSpell: {
        policy: 'expected' as const,
        spell: selectedSpell.spell,
        spellLevel: selectedSpell.spellLevel,
        geometry: secondaryPackSpellHits.geometry,
        geometryAssumption: secondaryPackSpellHits.assumption,
        expectedPrimaryDamagePerCast: expectedPlayerDamagePerSwing,
        expectedSecondaryDamagePerCast: expectedSecondaryPackDamagePerCast,
        primaryCollisionChecksPerCast: spellHits!.maximumCollisionChecks,
        secondaryCollisionChecksPerCast: secondaryPackSpellHits.maximumCollisionChecks,
        expectedPrimaryActionsToKill: expectedPlayerSwingsToKill,
        actionSeconds: playerSwingSeconds,
        expectedPrimaryRecoveryStartsBeforeKill: expectedMonsterRecoveryStartsBeforeKill,
        expectedSecondaryRecoveryStartsPerCast: secondaryMonsterRecoveryStartsPerCast,
        monsterRecoverySeconds: opts.monsterHitRecoverySeconds ?? 0,
        baseDamageTakenPerSecond: packBaseDamageTakenPerSecond,
        baseGotHitInterruptionsPerSecond: packBaseGotHitInterruptionsPerSecond,
        manaPerCast: manaPerCast!,
      },
    } : {}),
    playerSwingSeconds,
    expectedPlayerSecondsToKill,
    monsterHitChance,
    monsterElement,
    monsterProjectilesPerAttack,
    monsterHitChecksPerAttack,
    expectedMonsterDamagePerHit,
    expectedMonsterHitsToKillPlayer,
    expectedMonsterDamagePerSwing,
    ...((build.lifeStealPercent !== undefined || build.manaStealPercent !== undefined) ? {
      steal: {
        lifePercent: build.lifeStealPercent ?? 0,
        manaPercent: build.manaStealPercent ?? 0,
        expectedLifePerLandedHit: expectedLifeStolenPerLandedHit,
        expectedManaPerLandedHit: expectedManaStolenPerLandedHit,
        expectedLifePerKill: expectedLifeStolenPerKill,
        expectedManaPerKill: expectedManaStolenPerKill,
      },
    } : {}),
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
    ...((selectedSpell || physicalRecoveryEnabled) && opts.monsterHitRecoverySeconds !== undefined ? {
      monsterHitRecovery: {
        expectedStartsPerCast: monsterRecoveryStartsPerCast,
        expectedStartsBeforeKill: expectedMonsterRecoveryStartsBeforeKill,
        recoverySeconds: opts.monsterHitRecoverySeconds,
        recoveryLoad: monsterRecoveryLoad,
        attackAvailability: monsterAttackAvailability,
        hardHitStunLock: monsterRecoveryLoad >= 1,
        ...(physicalRecoveryEnabled ? { knockbackProbability } : {}),
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
