/** Deterministic simultaneous-pack arithmetic derived from the engine placement branches. */

export const DEFAULT_ADJACENT_SLOTS = 8;
export const CORRIDOR_ADJACENT_SLOTS = 2;
export const ORDINARY_UNIQUE_MINIONS = 8;

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

export interface DistributedPackExchangeExpectation {
  expectedPackSize: number;
  secondsPerPack: number;
  expectedDamageTakenPerPack: number;
  expectedGotHitInterruptionsPerPack: number;
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
