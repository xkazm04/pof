/** Deterministic simultaneous-pack arithmetic derived from the engine placement branches. */
import type { PlayerSpellPackGeometry } from '@/lib/catalog/reference/playerSpellHits';

export const DEFAULT_ADJACENT_SLOTS = 8;
export const CORRIDOR_ADJACENT_SLOTS = 2;
export const ORDINARY_UNIQUE_MINIONS = 8;

/**
 * Named geometry assumptions, not Diablo data values. Pack members occupy distinct uniformly
 * chosen slots in the configured ring. Aimed lines intersect one secondary ring slot; a wall
 * across the approach and a 3x3 impact footprint intersect the two slots neighbouring the aimed
 * member. Flame Wave uses its code-derived side-segment count against the same abstract ring.
 */
export const PACK_SPELL_COMPACT_RING_GEOMETRY = {
  id: 'compact-uniform-slot-ring',
  aimedLineSecondarySlots: 1,
  crossLineSecondarySlots: 2,
  impactBlastSecondarySlots: 2,
} as const;

export interface PackSizeOutcome {
  size: number;
  probability: number;
}

export interface PackDuelExpectation {
  /** Existing duel time for one kill, before player hit-recovery interruptions. */
  secondsToKill: number;
  /** Existing duel damage for one kill, in whole hit points. */
  expectedDamageTaken: number;
  /** Qualifying PM_GOTHIT events in the existing duel exposure. */
  expectedGotHitInterruptions: number;
  /** Duration of one PM_GOTHIT animation. */
  hitRecoverySeconds: number;
  /** Missile-capable routines are not constrained by adjacent melee slots. */
  ranged: boolean;
}

export interface PackExchangeInput extends PackDuelExpectation {
  packSize: number;
  adjacentSlots?: number;
}

export interface PackExchangePhase {
  alive: number;
  engagedAttackers: number;
  seconds: number;
  expectedDamageTaken: number;
  expectedGotHitInterruptions: number;
}

export interface PackExchangeExpectation {
  packSize: number;
  adjacentSlots: number;
  seconds: number;
  expectedDamageTaken: number;
  expectedGotHitInterruptions: number;
  phases: PackExchangePhase[];
}

export interface PackSpellAreaDuel {
  readonly spell: string;
  readonly spellLevel: number;
  readonly geometry: PlayerSpellPackGeometry;
  readonly expectedPrimaryDamagePerCast: number;
  readonly expectedSecondaryDamagePerCast: number;
  readonly primaryCollisionChecksPerCast: number;
  readonly secondaryCollisionChecksPerCast: number;
  readonly expectedPrimaryActionsToKill: number;
  readonly expectedPrimaryRecoveryStartsBeforeKill: number;
  readonly expectedSecondaryRecoveryStartsPerCast: number;
  readonly monsterRecoverySeconds: number;
  readonly baseDamageTakenPerSecond: number;
  readonly baseGotHitInterruptionsPerSecond: number;
  readonly manaPerCast: number;
}

export interface PackSpellAreaExchangeInput extends PackExchangeInput {
  readonly spellArea: PackSpellAreaDuel;
}

export interface PackSpellCoverageExpectation {
  readonly geometryAssumption: typeof PACK_SPELL_COMPACT_RING_GEOMETRY.id;
  readonly ringMembers: number;
  readonly expectedTargetsAffected: number;
  readonly expectedSecondaryTargetsAffected: number;
  readonly secondaryCoverageProbability: number;
}

export interface PackSpellAreaExchangePhase extends PackExchangePhase {
  readonly baseSeconds: number;
  readonly expectedCasts: number;
  readonly expectedTargetsAffectedPerCast: number;
  readonly expectedAttackerAvailability: number;
  readonly expectedAttackersSuppressed: number;
}

export interface PackSpellAreaExchangeExpectation extends PackExchangeExpectation {
  readonly spell: string;
  readonly spellLevel: number;
  readonly expectedCasts: number;
  readonly expectedManaSpent: number;
  readonly expectedTargetsAffectedPerCast: number;
  readonly expectedAttackersSuppressedPerCast: number;
  readonly phases: PackSpellAreaExchangePhase[];
}

function validateProbabilityDistribution(outcomes: readonly PackSizeOutcome[]): void {
  if (outcomes.length === 0) throw new Error('pack-size distribution must not be empty');
  let probability = 0;
  for (const outcome of outcomes) {
    if (!Number.isInteger(outcome.size) || outcome.size < 1) {
      throw new Error(`pack size must be a positive integer (got ${outcome.size})`);
    }
    if (!Number.isFinite(outcome.probability) || outcome.probability < 0) {
      throw new Error(`pack probability must be a non-negative finite number (got ${outcome.probability})`);
    }
    probability += outcome.probability;
  }
  if (Math.abs(probability - 1) > 1e-12) {
    throw new Error(`pack probabilities must sum to one (got ${probability})`);
  }
}

function requireNonNegativeFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number (got ${value})`);
  }
}

function expectedCoveredSecondarySlots(
  geometry: PlayerSpellPackGeometry,
  spellLevel: number,
  adjacentSlots: number,
): number {
  const secondarySlots = Math.max(0, adjacentSlots - 1);
  switch (geometry) {
    case 'seeking-radius':
    case 'radial-ring':
    case 'scanned-area':
      return secondarySlots;
    case 'aimed-line':
      return Math.min(secondarySlots, PACK_SPELL_COMPACT_RING_GEOMETRY.aimedLineSecondarySlots);
    case 'cross-line':
      return Math.min(secondarySlots, PACK_SPELL_COMPACT_RING_GEOMETRY.crossLineSecondarySlots);
    case 'impact-3x3':
      return Math.min(secondarySlots, PACK_SPELL_COMPACT_RING_GEOMETRY.impactBlastSecondarySlots);
    case 'widening-wave':
      return Math.min(secondarySlots, 2 * (Math.trunc(spellLevel / 2) + 2));
  }
}

/** Expected covered members under the named compact uniform-slot-ring assumption. */
export function expectedSpellPackCoverage(
  geometry: PlayerSpellPackGeometry,
  spellLevel: number,
  alive: number,
  adjacentSlots: number = DEFAULT_ADJACENT_SLOTS,
): PackSpellCoverageExpectation {
  if (!Number.isInteger(spellLevel) || spellLevel < 0) {
    throw new Error(`spellLevel must be a non-negative integer (got ${spellLevel})`);
  }
  if (!Number.isInteger(alive) || alive < 1) {
    throw new Error(`alive must be a positive integer (got ${alive})`);
  }
  if (!Number.isInteger(adjacentSlots) || adjacentSlots < 1 || adjacentSlots > DEFAULT_ADJACENT_SLOTS) {
    throw new Error(`adjacentSlots must be an integer from 1 to ${DEFAULT_ADJACENT_SLOTS} (got ${adjacentSlots})`);
  }
  const ringMembers = Math.min(alive, adjacentSlots);
  const possibleSecondarySlots = Math.max(0, adjacentSlots - 1);
  const secondaryCoverageProbability = possibleSecondarySlots === 0
    ? 0
    : expectedCoveredSecondarySlots(geometry, spellLevel, adjacentSlots) / possibleSecondarySlots;
  const expectedSecondaryTargetsAffected = (ringMembers - 1) * secondaryCoverageProbability;
  return {
    geometryAssumption: PACK_SPELL_COMPACT_RING_GEOMETRY.id,
    ringMembers,
    expectedTargetsAffected: 1 + expectedSecondaryTargetsAffected,
    expectedSecondaryTargetsAffected,
    secondaryCoverageProbability,
  };
}

/**
 * PlaceGroup request-size distribution for vanilla dungeon depths. Placement/cap failures are
 * excluded because the deterministic descent has no dungeon seed or occupied-tile geometry.
 */
export function ordinaryPackSizeDistribution(depth: number): readonly PackSizeOutcome[] {
  if (!Number.isInteger(depth) || depth < 1) throw new Error(`depth must be a positive integer (got ${depth})`);
  if (depth === 1) return [{ size: 1, probability: 1 }];
  if (depth === 2) return [
    { size: 1, probability: 1 / 2 },
    { size: 2, probability: 1 / 4 },
    { size: 3, probability: 1 / 4 },
  ];
  return [
    { size: 1, probability: 1 / 2 },
    { size: 3, probability: 1 / 6 },
    { size: 4, probability: 1 / 6 },
    { size: 5, probability: 1 / 6 },
  ];
}

export function expectedPackSize(outcomes: readonly PackSizeOutcome[]): number {
  validateProbabilityDistribution(outcomes);
  return outcomes.reduce((sum, outcome) => sum + outcome.size * outcome.probability, 0);
}

/** A normal unique and its requested eight minions are treated as one nine-member pack. */
export function requestedUniquePackSize(pack: unknown): number {
  return String(pack).toLowerCase() === 'none' ? 1 : 1 + ORDINARY_UNIQUE_MINIONS;
}

/**
 * Integrate one homogeneous pack over the hero's one-at-a-time kill phases. For phase k, melee
 * exposure is min(k, adjacentSlots), while every ranged survivor remains engaged. The duel's
 * damage and qualifying-hit expectation are divided by its kill time; cadence-model duels thereby
 * bound both rates by each monster's own attack cycle, while the legacy model preserves hero-first
 * initiative. If lambda is the combined qualifying-hit rate and h is recovery duration, recovery
 * can itself be interrupted, so T = T0 + lambda*T*h and T = T0/(1-lambda*h). A load >= 1 is a
 * deterministic stun-lock (unbounded time and damage). With one slot, every phase is exactly one
 * interruption-aware sequential duel.
 */
export function packExchange(input: PackExchangeInput): PackExchangeExpectation {
  const adjacentSlots = input.adjacentSlots ?? DEFAULT_ADJACENT_SLOTS;
  if (!Number.isInteger(input.packSize) || input.packSize < 1) {
    throw new Error(`packSize must be a positive integer (got ${input.packSize})`);
  }
  if (!Number.isInteger(adjacentSlots) || adjacentSlots < 1 || adjacentSlots > DEFAULT_ADJACENT_SLOTS) {
    throw new Error(`adjacentSlots must be an integer from 1 to ${DEFAULT_ADJACENT_SLOTS} (got ${adjacentSlots})`);
  }
  for (const [name, value] of [
    ['secondsToKill', input.secondsToKill],
    ['expectedDamageTaken', input.expectedDamageTaken],
    ['expectedGotHitInterruptions', input.expectedGotHitInterruptions],
    ['hitRecoverySeconds', input.hitRecoverySeconds],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative finite number (got ${value})`);
  }

  const phases: PackExchangePhase[] = [];
  for (let alive = input.packSize; alive >= 1; alive--) {
    const engagedAttackers = input.ranged ? alive : Math.min(alive, adjacentSlots);
    const baseInterruptions = input.expectedGotHitInterruptions * engagedAttackers;
    const recoveryLoad = input.secondsToKill === 0
      ? baseInterruptions === 0 ? 0 : Infinity
      : baseInterruptions * input.hitRecoverySeconds / input.secondsToKill;
    const timeMultiplier = recoveryLoad < 1 ? 1 / (1 - recoveryLoad) : Infinity;
    phases.push({
      alive,
      engagedAttackers,
      seconds: input.secondsToKill * timeMultiplier,
      expectedDamageTaken: input.expectedDamageTaken * engagedAttackers * timeMultiplier,
      expectedGotHitInterruptions: baseInterruptions * timeMultiplier,
    });
  }

  return {
    packSize: input.packSize,
    adjacentSlots,
    seconds: phases.reduce((sum, phase) => sum + phase.seconds, 0),
    expectedDamageTaken: phases.reduce((sum, phase) => sum + phase.expectedDamageTaken, 0),
    expectedGotHitInterruptions: phases.reduce((sum, phase) => sum + phase.expectedGotHitInterruptions, 0),
    phases,
  };
}

/**
 * Integrate an expected area spell over homogeneous pack health. Remaining health is expressed in
 * primary-target cast equivalents. The focused member receives one full primary cast; every other
 * member loses its compact-ring coverage probability times the secondary/primary expected-damage
 * ratio. Monster GotHit availability is applied across all covered engaged attackers before the
 * existing recursive hero GotHit load is solved.
 */
export function packSpellAreaExchange(input: PackSpellAreaExchangeInput): PackSpellAreaExchangeExpectation {
  const adjacentSlots = input.adjacentSlots ?? DEFAULT_ADJACENT_SLOTS;
  const legacy = packExchange(input);
  const area = input.spellArea;
  if (!Number.isInteger(area.spellLevel) || area.spellLevel < 0) {
    throw new Error(`spellLevel must be a non-negative integer (got ${area.spellLevel})`);
  }
  for (const [name, value] of [
    ['expectedPrimaryDamagePerCast', area.expectedPrimaryDamagePerCast],
    ['expectedSecondaryDamagePerCast', area.expectedSecondaryDamagePerCast],
    ['primaryCollisionChecksPerCast', area.primaryCollisionChecksPerCast],
    ['secondaryCollisionChecksPerCast', area.secondaryCollisionChecksPerCast],
    ['expectedPrimaryActionsToKill', area.expectedPrimaryActionsToKill],
    ['expectedPrimaryRecoveryStartsBeforeKill', area.expectedPrimaryRecoveryStartsBeforeKill],
    ['expectedSecondaryRecoveryStartsPerCast', area.expectedSecondaryRecoveryStartsPerCast],
    ['monsterRecoverySeconds', area.monsterRecoverySeconds],
    ['baseDamageTakenPerSecond', area.baseDamageTakenPerSecond],
    ['baseGotHitInterruptionsPerSecond', area.baseGotHitInterruptionsPerSecond],
    ['manaPerCast', area.manaPerCast],
  ] as const) requireNonNegativeFinite(name, value);
  if (area.expectedPrimaryActionsToKill === 0 && input.secondsToKill > 0) {
    throw new Error('expectedPrimaryActionsToKill must be positive when secondsToKill is positive');
  }

  const effectiveActionSeconds = area.expectedPrimaryActionsToKill === 0
    ? 0
    : input.secondsToKill / area.expectedPrimaryActionsToKill;
  // A singleton has no area beneficiary. Preserve the existing interruption-aware duel exactly.
  if (input.packSize === 1) {
    const [phase] = legacy.phases;
    return {
      ...legacy,
      spell: area.spell,
      spellLevel: area.spellLevel,
      expectedCasts: area.expectedPrimaryActionsToKill,
      expectedManaSpent: area.expectedPrimaryActionsToKill * area.manaPerCast,
      expectedTargetsAffectedPerCast: 1,
      expectedAttackersSuppressedPerCast: 0,
      phases: [{
        ...phase,
        baseSeconds: input.secondsToKill,
        expectedCasts: area.expectedPrimaryActionsToKill,
        expectedTargetsAffectedPerCast: 1,
        expectedAttackerAvailability: phase.engagedAttackers,
        expectedAttackersSuppressed: 0,
      }],
    };
  }

  const secondaryDamageRatio = area.expectedPrimaryDamagePerCast === 0
    ? 0
    : area.expectedSecondaryDamagePerCast / area.expectedPrimaryDamagePerCast;
  const secondaryRecoveryLoadWhenCovered = effectiveActionSeconds === 0
    ? 0
    : area.expectedSecondaryRecoveryStartsPerCast * area.monsterRecoverySeconds / effectiveActionSeconds;
  const secondaryAvailabilityWhenCovered = Math.max(0, 1 - secondaryRecoveryLoadWhenCovered);
  const phases: PackSpellAreaExchangePhase[] = [];
  let remainingPrimaryActions = area.expectedPrimaryActionsToKill;
  for (let alive = input.packSize; alive >= 1;) {
    const coverage = expectedSpellPackCoverage(area.geometry, area.spellLevel, alive, adjacentSlots);
    const engagedAttackers = input.ranged ? alive : Math.min(alive, adjacentSlots);
    const expectedCoveredEngagedSecondaries = Math.min(
      engagedAttackers - 1,
      coverage.expectedSecondaryTargetsAffected,
    );
    // The supplied baseline per-monster rate already includes the focused target's duel recovery.
    // Only additional covered members receive another availability reduction here.
    const expectedAttackersSuppressed = expectedCoveredEngagedSecondaries
      * (1 - secondaryAvailabilityWhenCovered);
    const expectedAttackerAvailability = Math.max(0, engagedAttackers - expectedAttackersSuppressed);
    const baseSeconds = remainingPrimaryActions * effectiveActionSeconds;
    const interruptionRate = area.baseGotHitInterruptionsPerSecond * expectedAttackerAvailability;
    const heroRecoveryLoad = interruptionRate * input.hitRecoverySeconds;
    const timeMultiplier = heroRecoveryLoad < 1 ? 1 / (1 - heroRecoveryLoad) : Infinity;
    const seconds = baseSeconds * timeMultiplier;
    const expectedDamageTaken = area.baseDamageTakenPerSecond === 0 || expectedAttackerAvailability === 0
      ? 0
      : area.baseDamageTakenPerSecond * expectedAttackerAvailability * seconds;
    const expectedGotHitInterruptions = interruptionRate === 0 ? 0 : interruptionRate * seconds;
    phases.push({
      alive,
      engagedAttackers,
      baseSeconds,
      seconds,
      expectedDamageTaken,
      expectedGotHitInterruptions,
      expectedCasts: remainingPrimaryActions,
      expectedTargetsAffectedPerCast: coverage.expectedTargetsAffected,
      expectedAttackerAvailability,
      expectedAttackersSuppressed,
    });

    const secondaryCoverageProbability = alive === 1
      ? 0
      : coverage.expectedSecondaryTargetsAffected / (alive - 1);
    const secondaryWork = Math.min(1, secondaryCoverageProbability * secondaryDamageRatio);
    if (secondaryWork >= 1) break;
    remainingPrimaryActions *= 1 - secondaryWork;
    alive--;
  }

  const expectedCasts = phases.reduce((sum, phase) => sum + phase.expectedCasts, 0);
  const castWeighted = (value: (phase: PackSpellAreaExchangePhase) => number) => expectedCasts === 0
    ? 0
    : phases.reduce((sum, phase) => sum + phase.expectedCasts * value(phase), 0) / expectedCasts;
  return {
    packSize: input.packSize,
    adjacentSlots,
    spell: area.spell,
    spellLevel: area.spellLevel,
    seconds: phases.reduce((sum, phase) => sum + phase.seconds, 0),
    expectedDamageTaken: phases.reduce((sum, phase) => sum + phase.expectedDamageTaken, 0),
    expectedGotHitInterruptions: phases.reduce(
      (sum, phase) => sum + phase.expectedGotHitInterruptions,
      0,
    ),
    expectedCasts,
    expectedManaSpent: expectedCasts * area.manaPerCast,
    expectedTargetsAffectedPerCast: castWeighted((phase) => phase.expectedTargetsAffectedPerCast),
    expectedAttackersSuppressedPerCast: castWeighted((phase) => phase.expectedAttackersSuppressed),
    phases,
  };
}

export interface DistributedPackExchangeExpectation {
  expectedPackSize: number;
  secondsPerPack: number;
  expectedDamageTakenPerPack: number;
  expectedGotHitInterruptionsPerPack: number;
}

export interface DistributedPackSpellAreaExchangeExpectation extends DistributedPackExchangeExpectation {
  spell: string;
  spellLevel: number;
  expectedCastsPerPack: number;
  expectedManaSpentPerPack: number;
  expectedTargetsAffectedPerCast: number;
  expectedAttackersSuppressedPerCast: number;
}

/** Average the exact integer-size exchanges; never substitutes a fractional mean pack size. */
export function distributedPackExchange(
  outcomes: readonly PackSizeOutcome[],
  duel: PackDuelExpectation,
  adjacentSlots: number = DEFAULT_ADJACENT_SLOTS,
): DistributedPackExchangeExpectation {
  validateProbabilityDistribution(outcomes);
  const exchanges = outcomes.map((outcome) => ({
    ...outcome,
    exchange: packExchange({ ...duel, packSize: outcome.size, adjacentSlots }),
  }));
  return {
    expectedPackSize: expectedPackSize(outcomes),
    secondsPerPack: exchanges.reduce((sum, item) => sum + item.probability * item.exchange.seconds, 0),
    expectedDamageTakenPerPack: exchanges.reduce(
      (sum, item) => sum + item.probability * item.exchange.expectedDamageTaken,
      0,
    ),
    expectedGotHitInterruptionsPerPack: exchanges.reduce(
      (sum, item) => sum + item.probability * item.exchange.expectedGotHitInterruptions,
      0,
    ),
  };
}


/** Average exact integer pack branches for the expected spell-area policy. */
export function distributedPackSpellAreaExchange(
  outcomes: readonly PackSizeOutcome[],
  duel: PackDuelExpectation & { spellArea: PackSpellAreaDuel },
  adjacentSlots: number = DEFAULT_ADJACENT_SLOTS,
): DistributedPackSpellAreaExchangeExpectation {
  validateProbabilityDistribution(outcomes);
  const exchanges = outcomes.map((outcome) => ({
    ...outcome,
    exchange: packSpellAreaExchange({ ...duel, packSize: outcome.size, adjacentSlots }),
  }));
  const expectedCastsPerPack = exchanges.reduce(
    (sum, item) => sum + item.probability * item.exchange.expectedCasts,
    0,
  );
  const castWeighted = (value: (exchange: PackSpellAreaExchangeExpectation) => number) =>
    expectedCastsPerPack === 0
      ? 0
      : exchanges.reduce(
          (sum, item) => sum + item.probability * item.exchange.expectedCasts * value(item.exchange),
          0,
        ) / expectedCastsPerPack;
  return {
    spell: duel.spellArea.spell,
    spellLevel: duel.spellArea.spellLevel,
    expectedPackSize: expectedPackSize(outcomes),
    secondsPerPack: exchanges.reduce((sum, item) => sum + item.probability * item.exchange.seconds, 0),
    expectedDamageTakenPerPack: exchanges.reduce(
      (sum, item) => sum + item.probability * item.exchange.expectedDamageTaken,
      0,
    ),
    expectedGotHitInterruptionsPerPack: exchanges.reduce(
      (sum, item) => sum + item.probability * item.exchange.expectedGotHitInterruptions,
      0,
    ),
    expectedCastsPerPack,
    expectedManaSpentPerPack: exchanges.reduce(
      (sum, item) => sum + item.probability * item.exchange.expectedManaSpent,
      0,
    ),
    expectedTargetsAffectedPerCast: castWeighted((exchange) => exchange.expectedTargetsAffectedPerCast),
    expectedAttackersSuppressedPerCast: castWeighted(
      (exchange) => exchange.expectedAttackersSuppressedPerCast,
    ),
  };
}
