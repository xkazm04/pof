/** Deterministic simultaneous-pack arithmetic derived from the engine placement branches. */
import type { PlayerSpellPackGeometry } from '@/lib/catalog/reference/playerSpellHits';

export const DEFAULT_ADJACENT_SLOTS = 8;
export const CORRIDOR_ADJACENT_SLOTS = 2;
export const ORDINARY_UNIQUE_MINIONS = 8;

export type RangedPackApproachPolicy = 'off' | 'expected';
export type RangedPackApproachGeometry = 'shared-engagement-ring';
export type RangedPackKitePolicy = 'off' | 'step-back-after-action';
export type GroupAiPolicy = 'off' | 'expected';
export type GroupAiActivationRelation = 'ordinary' | 'unique-leashed' | 'unique-independent';
export type GroupAiSummonerRoutine = 'SkeletonKing' | 'HorkDemon';

/** Explicit pack geometry parameter; it is a model assumption, not a table value. */
export const DEFAULT_RANGED_PACK_APPROACH_GEOMETRY: RangedPackApproachGeometry = 'shared-engagement-ring';

/**
 * Named visibility-wave geometry. Only heroVisionRadius and gameLogicTicksPerSecond are engine
 * values: player.cpp:2338 initializes _pLightRad to 10, player.cpp:2531 passes it to vision,
 * monster.cpp:4278-4317 wakes each visible monster, options.cpp:843 defaults to 20 logic ticks/s,
 * and diablo.cpp:1525-1539 processes monsters once per logic tick. PlaceGroup itself performs an
 * unbounded random walk for ordinary groups (monster.cpp:308-375), so the spread and advance speed
 * below are explicit model assumptions rather than Diablo values.
 */
export const GROUP_AI_VISIBILITY_WAVE_GEOMETRY = {
  id: 'uniform-place-group-visibility-band',
  heroVisionRadius: 10,
  assumedPlacementSpreadRadius: 4,
  assumedAdvanceTilesPerSecond: 4,
  fallenFearRadius: 4,
  gameLogicTicksPerSecond: 20,
  assumedEligibleSummonDecisionSeconds: 1,
  assumedSummonCapacity: 2,
} as const;

export interface PackGroupAiEffects {
  readonly concurrency?: boolean;
  readonly summoning?: boolean;
  readonly fallenFear?: boolean;
}

export interface PackGroupAiInput {
  readonly policy: GroupAiPolicy;
  readonly activationRelation?: GroupAiActivationRelation;
  readonly routine?: string;
  readonly monsterLevel?: number;
  readonly intelligence?: number;
  readonly distanceToEnemy?: number;
  readonly gameMode?: 'single' | 'multi';
  readonly expansion?: 'diablo' | 'hellfire';
  readonly remainingMonsterCapacity?: number;
  /** Time already spent in the W86 closing phase before contact. */
  readonly elapsedSeconds?: number;
  /** Test/audit switches; production expected mode enables all three effects. */
  readonly effects?: PackGroupAiEffects;
}

export interface ExpectedSummonRosterInput {
  readonly routine: string | undefined;
  readonly intelligence: number;
  readonly distanceToEnemy: number;
  readonly engagementSeconds: number;
  readonly gameMode?: 'single' | 'multi';
  readonly expansion?: 'diablo' | 'hellfire';
  readonly remainingMonsterCapacity?: number;
}

export interface ExpectedSummonRoster {
  readonly routine: GroupAiSummonerRoutine | null;
  readonly probabilityPerEligibleDecision: number;
  readonly expectedEligibleDecisions: number;
  readonly remainingMonsterCapacity: number;
  readonly expectedExtraMembers: number;
  readonly expectedSecondsBetweenArrivals: number | null;
}

export interface PackGroupAiExpectation {
  readonly policy: 'expected';
  readonly geometryAssumption: typeof GROUP_AI_VISIBILITY_WAVE_GEOMETRY.id;
  readonly activationRelation: GroupAiActivationRelation;
  readonly activationScheduleSeconds: readonly number[];
  readonly expectedActivationWaveSeconds: number;
  readonly expectedExtraMembers: number;
  readonly expectedRosterSize: number;
  readonly fallenFearAttackerSecondsRemoved: number;
  readonly effects: Required<PackGroupAiEffects>;
}

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
  /** Omitted/off preserves the legacy simultaneous fixed-roster arithmetic exactly. */
  groupAi?: PackGroupAiInput;
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
  waitingForActivationSeconds?: number;
  attackerSeconds?: number;
  fallenFearAttackerSecondsRemoved?: number;
}

export interface PackExchangeExpectation {
  packSize: number;
  adjacentSlots: number;
  seconds: number;
  expectedDamageTaken: number;
  expectedGotHitInterruptions: number;
  phases: PackExchangePhase[];
  groupAi?: PackGroupAiExpectation;
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

export interface RangedPackApproachInput {
  readonly packSize: number;
  readonly adjacentSlots?: number;
  readonly contactDuel: PackDuelExpectation;
  /** Optional W85 area exchange applies only after contact; approach actions remain focused. */
  readonly contactSpellArea?: PackSpellAreaDuel;
  readonly contactPlayerActionsToKill: number;
  readonly engagementDistance: number;
  /** Null means the homogeneous pack holds range and attacks from t=0 rather than approaching. */
  readonly approachTilesPerSecond: number | null;
  readonly playerActionSeconds: number;
  /** Expected full-target work for one focused action at the supplied current separation. */
  readonly expectedActionsToKillAtDistance: (distance: number) => number;
  readonly manaPerAction?: number;
  readonly geometry?: RangedPackApproachGeometry;
  readonly kite?: RangedPackKitePolicy;
  /** Required by step-back-after-action; the complete step is charged before the next action. */
  readonly kiteStepSeconds?: number;
  /** Explicit geometry assumption for one completed retreat step. Defaults to one tile. */
  readonly kiteStepTiles?: number;
}

export interface RangedPackApproachPhase {
  readonly geometry: RangedPackApproachGeometry;
  readonly engagementDistance: number;
  readonly seconds: number;
  readonly playerActions: number;
  readonly membersKilled: number;
  readonly survivingMembers: number;
  readonly shotDistances: number[];
  readonly kite: RangedPackKitePolicy;
  readonly retreatSteps: number;
  readonly retreatSeconds: number;
  readonly kiteStepTiles: number;
  readonly kiteStepSeconds: number;
}

export interface RangedPackApproachExpectation extends PackExchangeExpectation {
  readonly approach: RangedPackApproachPhase;
  readonly contact: PackExchangeExpectation | PackSpellAreaExchangeExpectation | null;
  readonly expectedPlayerActions: number;
  readonly expectedManaSpent: number;
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

const ALL_GROUP_AI_EFFECTS: Required<PackGroupAiEffects> = {
  concurrency: true,
  summoning: true,
  fallenFear: true,
};

function enabledGroupAiEffects(input: PackGroupAiInput): Required<PackGroupAiEffects> {
  return {
    concurrency: input.effects?.concurrency ?? true,
    summoning: input.effects?.summoning ?? true,
    fallenFear: input.effects?.fallenFear ?? true,
  };
}

/**
 * Expected order statistics for the named uniform visibility band. Ordinary and Independent
 * members wake separately at monster.cpp:4278-4317. FollowTheLeader shares activation for intact
 * Leashed packs at monster.cpp:1674-1686, so their entire schedule is zero.
 */
export function expectedGroupActivationSchedule(
  packSize: number,
  relation: GroupAiActivationRelation = 'ordinary',
  elapsedSeconds: number = 0,
): number[] {
  if (!Number.isInteger(packSize) || packSize < 1) {
    throw new Error(`packSize must be a positive integer (got ${packSize})`);
  }
  requireNonNegativeFinite('elapsedSeconds', elapsedSeconds);
  if (relation === 'unique-leashed' || packSize === 1) return Array(packSize).fill(0);
  const geometry = GROUP_AI_VISIBILITY_WAVE_GEOMETRY;
  const visibilityBandTiles = 2 * geometry.assumedPlacementSpreadRadius;
  const waveSeconds = visibilityBandTiles / geometry.assumedAdvanceTilesPerSecond;
  return Array.from({ length: packSize }, (_, index) => Math.max(
    0,
    index / (packSize - 1) * waveSeconds - elapsedSeconds,
  ));
}

/**
 * Expected independent arrivals from the two engine summoner predicates. Probabilities are per
 * eligible Stand decision: Skeleton King uses max(6, 4*intelligence+35)% at distance >=3 and 6%
 * nearer (monster.cpp:2374-2429); Hork Demon uses (2*intelligence+43)% at distance >=3
 * (monster.cpp:3009-3064). The engine limit is remaining global monster capacity
 * (ActiveMonsterCount < MaxMonsters), represented by the explicit remaining-capacity parameter.
 */
export function expectedSummonRoster(input: ExpectedSummonRosterInput): ExpectedSummonRoster {
  for (const [name, value] of [
    ['intelligence', input.intelligence],
    ['distanceToEnemy', input.distanceToEnemy],
    ['engagementSeconds', input.engagementSeconds],
  ] as const) requireNonNegativeFinite(name, value);
  const remainingMonsterCapacity = input.remainingMonsterCapacity
    ?? GROUP_AI_VISIBILITY_WAVE_GEOMETRY.assumedSummonCapacity;
  requireNonNegativeFinite('remainingMonsterCapacity', remainingMonsterCapacity);

  const routine = input.routine === 'SkeletonKing' || input.routine === 'HorkDemon'
    ? input.routine
    : null;
  let probabilityPerEligibleDecision = 0;
  if (routine === 'SkeletonKing' && (input.gameMode ?? 'single') === 'single') {
    const threshold = input.distanceToEnemy >= 3
      ? Math.max(6, 4 * input.intelligence + 35)
      : 6;
    probabilityPerEligibleDecision = Math.min(1, threshold / 100);
  } else if (routine === 'HorkDemon' && input.expansion === 'hellfire'
    && input.distanceToEnemy >= 3) {
    probabilityPerEligibleDecision = Math.min(1, (2 * input.intelligence + 43) / 100);
  }
  const expectedEligibleDecisions = input.engagementSeconds
    / GROUP_AI_VISIBILITY_WAVE_GEOMETRY.assumedEligibleSummonDecisionSeconds;
  const expectedExtraMembers = Math.min(
    remainingMonsterCapacity,
    expectedEligibleDecisions * probabilityPerEligibleDecision,
  );
  return {
    routine,
    probabilityPerEligibleDecision,
    expectedEligibleDecisions,
    remainingMonsterCapacity,
    expectedExtraMembers,
    expectedSecondsBetweenArrivals: probabilityPerEligibleDecision === 0
      ? null
      : GROUP_AI_VISIBILITY_WAVE_GEOMETRY.assumedEligibleSummonDecisionSeconds
        / probabilityPerEligibleDecision,
  };
}

interface WeightedPackMember {
  activationSeconds: number;
  remaining: number;
}

function expectedGroupAiPackExchange(
  input: PackExchangeInput,
  adjacentSlots: number,
): PackExchangeExpectation {
  const groupAi = input.groupAi!;
  const effects = enabledGroupAiEffects(groupAi);
  const relation = groupAi.activationRelation ?? 'ordinary';
  const activationScheduleSeconds = effects.concurrency
    ? expectedGroupActivationSchedule(input.packSize, relation, groupAi.elapsedSeconds ?? 0)
    : Array(input.packSize).fill(0) as number[];
  const baseEngagementSeconds = input.packSize * input.secondsToKill;
  const summons = effects.summoning ? expectedSummonRoster({
    routine: groupAi.routine,
    intelligence: groupAi.intelligence ?? 0,
    distanceToEnemy: groupAi.distanceToEnemy ?? 4,
    engagementSeconds: baseEngagementSeconds,
    gameMode: groupAi.gameMode,
    expansion: groupAi.expansion,
    remainingMonsterCapacity: groupAi.remainingMonsterCapacity,
  }) : {
    routine: null,
    probabilityPerEligibleDecision: 0,
    expectedEligibleDecisions: 0,
    remainingMonsterCapacity: groupAi.remainingMonsterCapacity
      ?? GROUP_AI_VISIBILITY_WAVE_GEOMETRY.assumedSummonCapacity,
    expectedExtraMembers: 0,
    expectedSecondsBetweenArrivals: null,
  } satisfies ExpectedSummonRoster;
  const members: WeightedPackMember[] = activationScheduleSeconds.map((activationSeconds) => ({
    activationSeconds,
    remaining: 1,
  }));
  const summonEntries = Math.ceil(summons.expectedExtraMembers - Number.EPSILON * 16);
  let summonWeight = summons.expectedExtraMembers;
  for (let index = 0; index < summonEntries; index++) {
    const remaining = Math.min(1, summonWeight);
    members.push({
      activationSeconds: baseEngagementSeconds * (index + 1) / (summonEntries + 1),
      remaining,
    });
    summonWeight -= remaining;
  }
  members.sort((left, right) => left.activationSeconds - right.activationSeconds);

  const activeWeight = (atSeconds: number): number => members.reduce(
    (sum, member) => sum + (member.activationSeconds <= atSeconds ? member.remaining : 0),
    0,
  );
  const engagedAt = (atSeconds: number): number => {
    const active = activeWeight(atSeconds);
    return input.ranged ? active : Math.min(active, adjacentSlots);
  };
  const attackerSecondsBetween = (start: number, duration: number): number => {
    if (duration <= 0) return 0;
    const end = start + duration;
    const boundaries = [
      start,
      ...members
        .filter((member) => member.remaining > 0
          && member.activationSeconds > start && member.activationSeconds < end)
        .map((member) => member.activationSeconds),
      end,
    ].sort((left, right) => left - right);
    let attackerSeconds = 0;
    for (let index = 0; index < boundaries.length - 1; index++) {
      attackerSeconds += engagedAt(boundaries[index]) * (boundaries[index + 1] - boundaries[index]);
    }
    return attackerSeconds;
  };

  const fallenFearSeconds = effects.fallenFear && groupAi.routine === 'Fallen'
    ? Math.max(8 - (groupAi.monsterLevel ?? 0), 2)
      / GROUP_AI_VISIBILITY_WAVE_GEOMETRY.gameLogicTicksPerSecond
    : 0;
  const phases: PackExchangePhase[] = [];
  let elapsedSeconds = 0;
  let pendingFearSeconds = 0;
  let totalFearAttackerSecondsRemoved = 0;
  let alive = members.reduce((sum, member) => sum + member.remaining, 0);
  while (alive > Number.EPSILON * 16) {
    let waitingForActivationSeconds = 0;
    if (activeWeight(elapsedSeconds) <= Number.EPSILON * 16) {
      const nextActivation = members
        .filter((member) => member.remaining > Number.EPSILON * 16)
        .reduce((next, member) => Math.min(next, member.activationSeconds), Infinity);
      waitingForActivationSeconds = Math.max(0, nextActivation - elapsedSeconds);
      elapsedSeconds += waitingForActivationSeconds;
    }
    const currentlyActive = activeWeight(elapsedSeconds);
    const killWeight = Math.min(1, currentlyActive);
    const baseSeconds = input.secondsToKill * killWeight;
    const rawAttackerSeconds = attackerSecondsBetween(elapsedSeconds, baseSeconds);
    const fearAttackerSecondsRemoved = attackerSecondsBetween(
      elapsedSeconds,
      Math.min(baseSeconds, pendingFearSeconds),
    );
    const attackerSeconds = Math.max(0, rawAttackerSeconds - fearAttackerSecondsRemoved);
    totalFearAttackerSecondsRemoved += fearAttackerSecondsRemoved;
    const averageEngagedAttackers = baseSeconds === 0 ? engagedAt(elapsedSeconds) : attackerSeconds / baseSeconds;
    const interruptionRate = input.secondsToKill === 0
      ? input.expectedGotHitInterruptions === 0 ? 0 : Infinity
      : input.expectedGotHitInterruptions / input.secondsToKill * averageEngagedAttackers;
    const recoveryLoad = interruptionRate * input.hitRecoverySeconds;
    const timeMultiplier = recoveryLoad < 1 ? 1 / (1 - recoveryLoad) : Infinity;
    const expectedDamageTaken = input.secondsToKill === 0
      ? input.expectedDamageTaken === 0 ? 0 : Infinity
      : input.expectedDamageTaken / input.secondsToKill * attackerSeconds * timeMultiplier;
    const expectedGotHitInterruptions = interruptionRate === 0
      ? 0
      : interruptionRate * baseSeconds * timeMultiplier;
    const seconds = waitingForActivationSeconds + baseSeconds * timeMultiplier;
    phases.push({
      alive,
      engagedAttackers: averageEngagedAttackers,
      seconds,
      expectedDamageTaken,
      expectedGotHitInterruptions,
      waitingForActivationSeconds,
      attackerSeconds,
      fallenFearAttackerSecondsRemoved: fearAttackerSecondsRemoved,
    });
    if (!Number.isFinite(seconds)) break;

    let remainingKillWeight = killWeight;
    for (const member of members) {
      if (remainingKillWeight <= Number.EPSILON * 16) break;
      if (member.activationSeconds > elapsedSeconds || member.remaining <= 0) continue;
      const removed = Math.min(member.remaining, remainingKillWeight);
      member.remaining -= removed;
      remainingKillWeight -= removed;
    }
    alive = Math.max(0, alive - killWeight);
    elapsedSeconds += baseSeconds * timeMultiplier;
    pendingFearSeconds = fallenFearSeconds * killWeight;
  }

  return {
    packSize: input.packSize,
    adjacentSlots,
    seconds: phases.reduce((sum, phase) => sum + phase.seconds, 0),
    expectedDamageTaken: phases.reduce((sum, phase) => sum + phase.expectedDamageTaken, 0),
    expectedGotHitInterruptions: phases.reduce(
      (sum, phase) => sum + phase.expectedGotHitInterruptions,
      0,
    ),
    phases,
    groupAi: {
      policy: 'expected',
      geometryAssumption: GROUP_AI_VISIBILITY_WAVE_GEOMETRY.id,
      activationRelation: relation,
      activationScheduleSeconds,
      expectedActivationWaveSeconds: activationScheduleSeconds[activationScheduleSeconds.length - 1] ?? 0,
      expectedExtraMembers: summons.expectedExtraMembers,
      expectedRosterSize: input.packSize + summons.expectedExtraMembers,
      fallenFearAttackerSecondsRemoved: totalFearAttackerSecondsRemoved,
      effects,
    },
  };
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
  if (input.groupAi?.policy === 'expected') {
    return expectedGroupAiPackExchange(input, adjacentSlots);
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
  if (input.groupAi?.policy === 'expected') {
    const withoutGroupAi = { ...input, groupAi: { policy: 'off' as const } };
    const fixedRosterArea = packSpellAreaExchange(withoutGroupAi);
    const fixedRosterSingleTarget = packExchange(withoutGroupAi);
    const groupedSingleTarget = packExchange(input);
    const finiteRatio = (numerator: number, denominator: number): number => {
      if (denominator === 0) return numerator === 0 ? 1 : Infinity;
      if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
        return numerator === denominator ? 1 : Infinity;
      }
      return numerator / denominator;
    };
    const timeRatio = finiteRatio(groupedSingleTarget.seconds, fixedRosterSingleTarget.seconds);
    const damageRatio = finiteRatio(
      groupedSingleTarget.expectedDamageTaken,
      fixedRosterSingleTarget.expectedDamageTaken,
    );
    const interruptionRatio = finiteRatio(
      groupedSingleTarget.expectedGotHitInterruptions,
      fixedRosterSingleTarget.expectedGotHitInterruptions,
    );
    const rosterRatio = groupedSingleTarget.groupAi!.expectedRosterSize / input.packSize;
    const expectedCasts = fixedRosterArea.expectedCasts * rosterRatio;
    const phases = fixedRosterArea.phases.map((phase) => ({
      ...phase,
      seconds: phase.seconds * timeRatio,
      expectedDamageTaken: phase.expectedDamageTaken * damageRatio,
      expectedGotHitInterruptions: phase.expectedGotHitInterruptions * interruptionRatio,
      expectedCasts: phase.expectedCasts * rosterRatio,
    }));
    return {
      ...fixedRosterArea,
      seconds: fixedRosterArea.seconds * timeRatio,
      expectedDamageTaken: fixedRosterArea.expectedDamageTaken * damageRatio,
      expectedGotHitInterruptions:
        fixedRosterArea.expectedGotHitInterruptions * interruptionRatio,
      expectedCasts,
      expectedManaSpent: expectedCasts * input.spellArea.manaPerCast,
      phases,
      groupAi: groupedSingleTarget.groupAi,
    };
  }
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

/**
 * Resolve the opt-in pre-contact exchange for one homogeneous placement branch. All members begin
 * on the named engagement ring. A complete hero action advances one focused target by the inverse
 * of its distance-specific expected actions-to-kill; a kill does not spill damage into the next
 * member. Homogeneous melee members share speed and therefore reach contact together if they
 * survive. A homogeneous ranged pack has no closing interval: its existing ranged contact exchange
 * begins at t=0, so those members attack from range for the whole engagement.
 */
export function rangedPackApproachExchange(input: RangedPackApproachInput): RangedPackApproachExpectation {
  const adjacentSlots = input.adjacentSlots ?? DEFAULT_ADJACENT_SLOTS;
  const geometry = input.geometry ?? DEFAULT_RANGED_PACK_APPROACH_GEOMETRY;
  const kite = input.kite ?? 'off';
  const kiteStepTiles = input.kiteStepTiles ?? 1;
  const kiteStepSeconds = input.kiteStepSeconds ?? 0;
  if (!Number.isInteger(input.packSize) || input.packSize < 1) {
    throw new Error(`packSize must be a positive integer (got ${input.packSize})`);
  }
  if (!Number.isInteger(adjacentSlots) || adjacentSlots < 1 || adjacentSlots > DEFAULT_ADJACENT_SLOTS) {
    throw new Error(`adjacentSlots must be an integer from 1 to ${DEFAULT_ADJACENT_SLOTS} (got ${adjacentSlots})`);
  }
  if (geometry !== DEFAULT_RANGED_PACK_APPROACH_GEOMETRY) {
    throw new Error(`unknown ranged pack approach geometry ${geometry}`);
  }
  if (!(['off', 'step-back-after-action'] as const).includes(kite)) {
    throw new Error(`unknown ranged pack kite policy ${kite}`);
  }
  requireNonNegativeFinite('engagementDistance', input.engagementDistance);
  if (!(input.playerActionSeconds > 0) || !Number.isFinite(input.playerActionSeconds)) {
    throw new Error(`playerActionSeconds must be a positive finite number (got ${input.playerActionSeconds})`);
  }
  requireNonNegativeFinite('contactPlayerActionsToKill', input.contactPlayerActionsToKill);
  requireNonNegativeFinite('manaPerAction', input.manaPerAction ?? 0);
  if (input.approachTilesPerSecond !== null
    && (!(input.approachTilesPerSecond > 0) || !Number.isFinite(input.approachTilesPerSecond))) {
    throw new Error(`approachTilesPerSecond must be null or a positive finite number (got ${input.approachTilesPerSecond})`);
  }
  if (!(kiteStepTiles > 0) || !Number.isFinite(kiteStepTiles)) {
    throw new Error(`kiteStepTiles must be a positive finite number (got ${kiteStepTiles})`);
  }
  if (kite === 'step-back-after-action' && (!(kiteStepSeconds > 0) || !Number.isFinite(kiteStepSeconds))) {
    throw new Error(`kiteStepSeconds must be positive and finite for ${kite} (got ${input.kiteStepSeconds})`);
  }

  let survivingMembers = input.packSize;
  let distance = input.engagementDistance;
  let seconds = 0;
  let playerActions = 0;
  let targetWork = 0;
  let retreatSteps = 0;
  let retreatSeconds = 0;
  const shotDistances: number[] = [];
  let neverContacts = false;
  const speed = input.approachTilesPerSecond;
  const groupAi = input.contactDuel.groupAi;
  const groupAiEffects = groupAi?.policy === 'expected'
    ? enabledGroupAiEffects(groupAi)
    : ALL_GROUP_AI_EFFECTS;
  const activationSchedule = groupAi?.policy === 'expected' && groupAiEffects.concurrency
    ? expectedGroupActivationSchedule(
        input.packSize,
        groupAi.activationRelation,
        groupAi.elapsedSeconds ?? 0,
      )
    : Array(input.packSize).fill(0) as number[];

  if (speed !== null && distance > 1) {
    while (survivingMembers > 0 && distance > 1) {
      const membersKilled = input.packSize - survivingMembers;
      const activatedMembers = activationSchedule.filter((activation) => activation <= seconds).length;
      if (activatedMembers <= membersKilled) {
        const nextActivation = activationSchedule[membersKilled];
        const waitSeconds = Math.max(0, nextActivation - seconds);
        const contactSeconds = (distance - 1) / speed;
        if (contactSeconds < waitSeconds) {
          seconds += contactSeconds;
          distance = 1;
          break;
        }
        seconds += waitSeconds;
        distance = Math.max(1, distance - speed * waitSeconds);
        if (distance <= 1) break;
      }
      const distanceAfterAction = distance - speed * input.playerActionSeconds;
      // Match the duel convention: an action completing exactly at adjacency is still free.
      if (distanceAfterAction < 1 - Number.EPSILON) {
        seconds += (distance - 1) / speed;
        distance = 1;
        break;
      }

      seconds += input.playerActionSeconds;
      distance = Math.max(1, distanceAfterAction);
      playerActions++;
      shotDistances.push(distance);
      const actionsToKill = input.expectedActionsToKillAtDistance(distance);
      if (!(actionsToKill > 0) && actionsToKill !== Infinity) {
        throw new Error(`expectedActionsToKillAtDistance must return a positive number or Infinity (got ${actionsToKill})`);
      }
      if (Number.isFinite(actionsToKill)) targetWork += 1 / actionsToKill;
      if (targetWork + Number.EPSILON * 16 >= 1) {
        survivingMembers--;
        targetWork = 0;
      }
      if (survivingMembers === 0 || distance <= 1) break;

      if (kite === 'step-back-after-action') {
        const previousDistance = distance;
        seconds += kiteStepSeconds;
        retreatSeconds += kiteStepSeconds;
        retreatSteps++;
        distance = Math.max(1, distance + kiteStepTiles - speed * kiteStepSeconds);
        if (actionsToKill === Infinity && distance >= previousDistance) {
          neverContacts = true;
          seconds = Infinity;
          break;
        }
      }
    }
  }

  const approach: RangedPackApproachPhase = {
    geometry,
    engagementDistance: input.engagementDistance,
    seconds,
    playerActions,
    membersKilled: input.packSize - survivingMembers,
    survivingMembers,
    shotDistances,
    kite,
    retreatSteps,
    retreatSeconds,
    kiteStepTiles,
    kiteStepSeconds,
  };
  const contactDuel = groupAi?.policy === 'expected'
    ? {
        ...input.contactDuel,
        groupAi: {
          ...groupAi,
          elapsedSeconds: (groupAi.elapsedSeconds ?? 0) + seconds,
        },
      }
    : input.contactDuel;
  const contact = survivingMembers === 0 || neverContacts
    ? null
    : input.contactSpellArea
      ? packSpellAreaExchange({
          ...contactDuel,
          packSize: survivingMembers,
          adjacentSlots,
          spellArea: input.contactSpellArea,
        })
      : packExchange({ ...contactDuel, packSize: survivingMembers, adjacentSlots });
  const contactPlayerActions = contact == null
    ? 0
    : 'expectedCasts' in contact
      ? contact.expectedCasts
      : input.contactPlayerActionsToKill * survivingMembers;
  const expectedPlayerActions = playerActions + contactPlayerActions;
  const approachGroupAi: PackGroupAiExpectation | undefined = groupAi?.policy === 'expected'
    ? contact?.groupAi ?? {
        policy: 'expected',
        geometryAssumption: GROUP_AI_VISIBILITY_WAVE_GEOMETRY.id,
        activationRelation: groupAi.activationRelation ?? 'ordinary',
        activationScheduleSeconds: activationSchedule,
        expectedActivationWaveSeconds: activationSchedule[activationSchedule.length - 1] ?? 0,
        expectedExtraMembers: 0,
        expectedRosterSize: input.packSize,
        fallenFearAttackerSecondsRemoved: 0,
        effects: groupAiEffects,
      }
    : undefined;
  return {
    packSize: input.packSize,
    adjacentSlots,
    seconds: seconds + (contact?.seconds ?? 0),
    expectedDamageTaken: contact?.expectedDamageTaken ?? 0,
    expectedGotHitInterruptions: contact?.expectedGotHitInterruptions ?? 0,
    phases: contact?.phases ?? [],
    approach,
    contact,
    expectedPlayerActions,
    expectedManaSpent: expectedPlayerActions * (input.manaPerAction ?? 0),
    ...(approachGroupAi ? { groupAi: approachGroupAi } : {}),
  };
}

export interface DistributedPackExchangeExpectation {
  expectedPackSize: number;
  secondsPerPack: number;
  expectedDamageTakenPerPack: number;
  expectedGotHitInterruptionsPerPack: number;
  groupAi?: {
    readonly policy: 'expected';
    readonly geometryAssumption: typeof GROUP_AI_VISIBILITY_WAVE_GEOMETRY.id;
    readonly expectedActivationWaveSecondsPerPack: number;
    readonly expectedExtraMembersPerPack: number;
    readonly expectedRosterSize: number;
    readonly fallenFearAttackerSecondsRemovedPerPack: number;
  };
}

export interface DistributedPackSpellAreaExchangeExpectation extends DistributedPackExchangeExpectation {
  spell: string;
  spellLevel: number;
  expectedCastsPerPack: number;
  expectedManaSpentPerPack: number;
  expectedTargetsAffectedPerCast: number;
  expectedAttackersSuppressedPerCast: number;
}

export interface DistributedRangedPackApproachExpectation extends DistributedPackExchangeExpectation {
  readonly approachSecondsPerPack: number;
  readonly contactSecondsPerPack: number;
  readonly expectedMembersKilledBeforeContact: number;
  readonly expectedSurvivingMembersAtContact: number;
  readonly expectedApproachActionsPerPack: number;
  readonly expectedPlayerActionsPerPack: number;
  readonly expectedManaSpentPerPack: number;
  readonly expectedRetreatStepsPerPack: number;
  readonly expectedRetreatSecondsPerPack: number;
  readonly spell?: string;
  readonly spellLevel?: number;
  readonly expectedCastsPerPack?: number;
  readonly expectedTargetsAffectedPerCast?: number;
  readonly expectedAttackersSuppressedPerCast?: number;
}

function distributedGroupAiSummary(
  exchanges: readonly {
    readonly probability: number;
    readonly exchange: PackExchangeExpectation;
  }[],
): NonNullable<DistributedPackExchangeExpectation['groupAi']> | undefined {
  if (exchanges.some((item) => item.exchange.groupAi === undefined)) return undefined;
  return {
    policy: 'expected',
    geometryAssumption: GROUP_AI_VISIBILITY_WAVE_GEOMETRY.id,
    expectedActivationWaveSecondsPerPack: exchanges.reduce(
      (sum, item) => sum + item.probability * item.exchange.groupAi!.expectedActivationWaveSeconds,
      0,
    ),
    expectedExtraMembersPerPack: exchanges.reduce(
      (sum, item) => sum + item.probability * item.exchange.groupAi!.expectedExtraMembers,
      0,
    ),
    expectedRosterSize: exchanges.reduce(
      (sum, item) => sum + item.probability * item.exchange.groupAi!.expectedRosterSize,
      0,
    ),
    fallenFearAttackerSecondsRemovedPerPack: exchanges.reduce(
      (sum, item) => sum + item.probability
        * item.exchange.groupAi!.fallenFearAttackerSecondsRemoved,
      0,
    ),
  };
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
  const groupAi = distributedGroupAiSummary(exchanges);
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
    ...(groupAi ? { groupAi } : {}),
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
  const groupAi = distributedGroupAiSummary(exchanges);
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
    ...(groupAi ? { groupAi } : {}),
  };
}

/** Average exact integer placement branches for the opt-in ranged/spell approach policy. */
export function distributedRangedPackApproachExchange(
  outcomes: readonly PackSizeOutcome[],
  input: Omit<RangedPackApproachInput, 'packSize'>,
): DistributedRangedPackApproachExpectation {
  validateProbabilityDistribution(outcomes);
  const exchanges = outcomes.map((outcome) => ({
    ...outcome,
    exchange: rangedPackApproachExchange({ ...input, packSize: outcome.size }),
  }));
  const weighted = (value: (exchange: RangedPackApproachExpectation) => number) => exchanges.reduce(
    (sum, item) => sum + item.probability * value(item.exchange),
    0,
  );
  const expectedContactCasts = input.contactSpellArea == null
    ? 0
    : weighted((exchange) => exchange.contact != null && 'expectedCasts' in exchange.contact
      ? exchange.contact.expectedCasts
      : 0);
  const contactCastWeighted = (value: (contact: PackSpellAreaExchangeExpectation) => number) =>
    expectedContactCasts === 0
      ? 0
      : exchanges.reduce((sum, item) => {
          const contact = item.exchange.contact;
          return contact != null && 'expectedCasts' in contact
            ? sum + item.probability * contact.expectedCasts * value(contact)
            : sum;
        }, 0) / expectedContactCasts;
  const groupAi = distributedGroupAiSummary(exchanges);
  return {
    expectedPackSize: expectedPackSize(outcomes),
    secondsPerPack: weighted((exchange) => exchange.seconds),
    expectedDamageTakenPerPack: weighted((exchange) => exchange.expectedDamageTaken),
    expectedGotHitInterruptionsPerPack: weighted((exchange) => exchange.expectedGotHitInterruptions),
    approachSecondsPerPack: weighted((exchange) => exchange.approach.seconds),
    contactSecondsPerPack: weighted((exchange) => exchange.contact?.seconds ?? 0),
    expectedMembersKilledBeforeContact: weighted((exchange) => exchange.approach.membersKilled),
    expectedSurvivingMembersAtContact: weighted((exchange) => exchange.approach.survivingMembers),
    expectedApproachActionsPerPack: weighted((exchange) => exchange.approach.playerActions),
    expectedPlayerActionsPerPack: weighted((exchange) => exchange.expectedPlayerActions),
    expectedManaSpentPerPack: weighted((exchange) => exchange.expectedManaSpent),
    expectedRetreatStepsPerPack: weighted((exchange) => exchange.approach.retreatSteps),
    expectedRetreatSecondsPerPack: weighted((exchange) => exchange.approach.retreatSeconds),
    ...(groupAi ? { groupAi } : {}),
    ...(input.contactSpellArea ? {
      spell: input.contactSpellArea.spell,
      spellLevel: input.contactSpellArea.spellLevel,
      expectedCastsPerPack: expectedContactCasts,
      expectedTargetsAffectedPerCast: contactCastWeighted(
        (contact) => contact.expectedTargetsAffectedPerCast,
      ),
      expectedAttackersSuppressedPerCast: contactCastWeighted(
        (contact) => contact.expectedAttackersSuppressedPerCast,
      ),
    } : {}),
  };
}
