/**
 * A monster's locomotion and attack/decision cadence, converted to PoF (/diablo W08).
 *
 * Diablo I keeps a monster's feel in two places: its animation data (`frames[6]`/`rate[6]`, `animFrameNum` in
 * monstdat) determines its speed WHILE WALKING, while its AI ROUTINE determines how often it decides to step or
 * attack and how long it hesitates. Both are read here — the data from the monster, the routine and the engine's
 * timing from engine-derived laws plus the structured routine table. The routine's randomness is reduced to its
 * expectation for effective continuous speed; the separate animation-only locomotion projection remains its upper
 * bound while walking.
 *
 * Conversion: time is carried in real seconds (both games run in real time). Distance has no shared unit, so the
 * monster/player SPEED RATIO is preserved against a named player anchor on each side (the D23 idea): a monster that
 * steps as often as the reference hero walks as fast as PoF's player.
 */
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import { attackKindsOf, D1_AI_ROUTINES, isD1AiRoutineId, type AiRoutineRoll, type D1AiRoutineId } from '@/lib/catalog/reference/aiRoutines';
import { stableStringify } from '@/lib/catalog/reference/hash';
import type { ConversionLoss } from '@/lib/catalog/reference/playerScale';

const lawBody = (id: string): string => {
  const body = DIABLO1_CANON.find((r) => r.id === id)?.body;
  if (!body) throw new Error(`canon rule ${id} is missing — no law to read`);
  return body;
};
const need = (id: string, re: RegExp): RegExpExecArray => {
  const m = re.exec(lawBody(id));
  if (!m) throw new Error(`canon rule ${id} no longer states ${re} — refusing to guess`);
  return m;
};

/** Engine timing: ticks per second and the extra ticks a walk animation takes beyond its frames. */
export function timingLaw(): { ticksPerSecond: number; walkExtraTicks: number } {
  return {
    ticksPerSecond: Number(need('d1-timing-law', /advances (\d+) ticks per second/)[1]),
    walkExtraTicks: Number(need('d1-timing-law', /walk animation's frames plus (\d+) tick/)[1]),
  };
}

/** A linear percentage in intelligence, `(a x intelligence + b)%`, and a pause `(c - d x intelligence) plus 0-N ticks`. */
type Pct = { a: number; b: number };
type Pause = { c: number; d: number; spread: number };
type CadenceModel =
  | { kind: 'shared-per-tick'; act: Pct }
  | { kind: 'forced-pause'; attack: Pct; attackPause: Pause; step: Pct; stepPause: Pause }
  | { kind: 'skeleton-ranged'; retreat: Pct; shoot: Pct }
  | { kind: 'settled-per-tick'; attack: Pct; specialBand?: Pct; step: Pct; stepAfterMove: Pct; settleTicks: number }
  | { kind: 'repeating-pause'; attack: Pct; step: Pct; stepAfterMove: Pct; stepPause: Pause }
  | { kind: 'always' }
  | { kind: 'shared-ranged'; retreat: Pct; shootPause?: Pause; specialAnimation: boolean }
  | { kind: 'ranged-avoidance'; adjacentMelee: Pct; adjacentPause: Pause; closeShot: Pct; farShot: Pct };

export interface AiRoutineLaw {
  routine: D1AiRoutineId;
  model: CadenceModel;
  /** Whether the modelled combat phase closes distance rather than only holding/retreating. */
  approaches: boolean;
  /** The state/distance slice for which one stationary expectation exists. */
  phase: string;
  /** Exact close-range boundary for routines that hold distance. */
  keepAwayTiles?: number;
  /** A state in which this routine intentionally has no cadence. */
  phaseGap?: string;
  source: string;
}

const linearChance = (ai: string, roll: AiRoutineRoll): Pct => {
  if (!('linear' in roll.chance)) throw new Error(`AI routine "${ai}" has no linear chance for ${roll.when}`);
  return { a: roll.chance.linear.perIntelligence, b: roll.chance.linear.base };
};

const pauseOf = (ai: string, roll: AiRoutineRoll): Pause => {
  if (!roll.pause) throw new Error(`AI routine "${ai}" has no structured pause for ${roll.when}`);
  return { c: roll.pause.base, d: roll.pause.perIntelligence, spread: roll.pause.randomMax };
};

const rollAt = (ai: string, rolls: readonly AiRoutineRoll[], index: number): AiRoutineRoll => {
  const roll = rolls[index];
  if (!roll) throw new Error(`AI routine "${ai}" is missing structured roll ${index}`);
  return roll;
};

const keepAwayOf = (ai: D1AiRoutineId): number => {
  const value = D1_AI_ROUTINES[ai].distances.find((entry) => entry.name === 'retreat band')?.threshold;
  if (value === undefined) throw new Error(`AI routine "${ai}" has no structured retreat threshold`);
  return value;
};

const CADENCE_GAPS: Partial<Record<D1AiRoutineId, string>> = {
  Scavenger: 'health, corpse availability and a ten-decision healing goal switch it between enemy approach, corpse approach and eating; the table has no distribution over those states',
  Fallen: 'nearby deaths and war cries create externally-timed Retreat and Attack goals, so its inherited Skeleton cadence has no history-independent weight',
  SkeletonKing: 'circling and single-player summoning depend on distance, game mode, line of sight, a free tile and monster capacity',
  Gargoyle: 'statue, wounded-retreat and random-chunk healing states depend on health and prior activation, so GoatMelee is not a single weighted cadence',
  FireMan: 'the pinned dispatch entry is null and implements no decisions',
  Zhar: 'before hostility it only talks; afterward Counselor fade, circle and retreat goals still require position and goal history',
  Snotspill: 'before hostility it only talks; afterward it inherits Fallen goals whose death and war-cry history has no stationary weight',
  Counselor: 'a failed cast may fade into a distance-bounded circle goal, while wounded adjacency starts a four-decision retreat; position and health histories are required',
  Mega: 'distance switches to Skeleton behavior while close circling stores a forced-cast marker; the table does not supply a distribution over those histories',
  Lazarus: 'before hostility it only talks; afterward it inherits Counselor fade/circle/retreat history and additionally suppresses every requested delay',
  Lachdanan: 'the routine only advances dialogue and then scripted death; it never approaches or attacks',
};

export function aiRoutineCadenceStatus(ai: string): { modelled: boolean; reason?: string } {
  if (!isD1AiRoutineId(ai)) return { modelled: false, reason: `AI routine "${ai}" is not in the engine-derived routine table` };
  const reason = CADENCE_GAPS[ai];
  return reason ? { modelled: false, reason } : { modelled: true };
}

/** The canon rule ids each modelled routine is read from (a derived value names its basis). */
export const AI_LAW_IDS: Record<string, string> = Object.fromEntries(
  Object.entries(D1_AI_ROUTINES).map(([ai, routine]) => [ai, routine.lawId]),
);

/** The rule texts the behaviour model reads — hashed into the ingest version so a law edit re-projects. */
export function behaviourLawTexts(): string[] {
  const ids = ['d1-timing-law', ...new Set(Object.values(AI_LAW_IDS))];
  return [
    ...ids.map((id) => DIABLO1_CANON.find((r) => r.id === id)?.body ?? `missing:${id}`),
    stableStringify(D1_AI_ROUTINES),
  ];
}

export function aiRoutineLaw(ai: string): AiRoutineLaw {
  if (!isD1AiRoutineId(ai)) throw new Error(`AI routine "${ai}" is not in the engine-derived routine table`);
  const gap = CADENCE_GAPS[ai];
  if (gap) throw new Error(`AI routine "${ai}" is not modelled for cadence: ${gap}`);

  const own = D1_AI_ROUTINES[ai];
  const skeleton = D1_AI_ROUTINES.SkeletonMelee;
  const goat = D1_AI_ROUTINES.GoatMelee;
  switch (ai) {
  // .reference/devilutionX/Source/monster.cpp:2069-2097 (ZombieAi).
  case 'Zombie':
    return { routine: ai, model: { kind: 'shared-per-tick', act: linearChance(ai, rollAt(ai, own.rolls, 0)) }, approaches: true, phase: 'visible combat', source: 'monster.cpp:2069-2097' };
  // .reference/devilutionX/Source/monster.cpp:2099-2122 (OverlordAi).
  case 'Fat':
    return { routine: ai, model: { kind: 'settled-per-tick', step: linearChance(ai, rollAt(ai, own.rolls, 0)), stepAfterMove: linearChance(ai, rollAt(ai, own.rolls, 1)), attack: linearChance(ai, rollAt(ai, own.rolls, 2)), specialBand: linearChance(ai, rollAt(ai, own.rolls, 3)), settleTicks: 21 }, approaches: true, phase: 'ordinary range and adjacency', source: 'monster.cpp:2099-2122' };
  // .reference/devilutionX/Source/monster.cpp:2124-2147 (SkeletonAi).
  case 'SkeletonMelee': {
    const step = rollAt(ai, own.rolls, 0);
    const attack = rollAt(ai, own.rolls, 1);
    return { routine: ai, model: { kind: 'forced-pause', step: linearChance(ai, step), stepPause: pauseOf(ai, step), attack: linearChance(ai, attack), attackPause: pauseOf(ai, attack) }, approaches: true, phase: 'combat', source: 'monster.cpp:2124-2147' };
  }
  // .reference/devilutionX/Source/monster.cpp:2149-2178 (SkeletonBowAi).
  case 'SkeletonRanged':
    return { routine: ai, model: { kind: 'skeleton-ranged', retreat: linearChance(ai, rollAt(ai, own.rolls, 0)), shoot: linearChance(ai, rollAt(ai, own.rolls, 2)) }, approaches: false, phase: 'settled clear-line adjacent combat with a legal retreat tile; a retreat leaves this fixed distance slice, while a blocked retreat can still fire in the same invocation', keepAwayTiles: keepAwayOf(ai), source: 'monster.cpp:2149-2178' };
  // .reference/devilutionX/Source/monster.cpp:2202-2254 (ScavengerAi): gap recorded above.
  case 'Scavenger':
    throw new Error('unreachable cadence gap');
  // .reference/devilutionX/Source/monster.cpp:2256-2312 (RhinoAi), restricted to 2-4 tiles where charge/circle cannot run.
  case 'Rhino':
    return { routine: ai, model: { kind: 'repeating-pause', stepAfterMove: linearChance(ai, rollAt(ai, own.rolls, 2)), step: linearChance(ai, rollAt(ai, own.rolls, 3)), stepPause: pauseOf(ai, rollAt(ai, own.rolls, 3)), attack: linearChance(ai, rollAt(ai, own.rolls, 4)) }, approaches: true, phase: 'normal goal at 2-4 tiles; adjacent melee', source: 'monster.cpp:2256-2312' };
  // .reference/devilutionX/Source/monster.cpp:1893-1938 (AiAvoidance), restricted to the non-circling normal goal.
  case 'GoatMelee':
    return { routine: ai, model: { kind: 'settled-per-tick', step: linearChance(ai, rollAt(ai, own.rolls, 1)), stepAfterMove: linearChance(ai, rollAt(ai, own.rolls, 2)), attack: linearChance(ai, rollAt(ai, own.rolls, 3)), settleTicks: 21 }, approaches: true, phase: 'healthy normal goal below the circle band; adjacent normal melee', source: 'monster.cpp:1893-1938' };
  // .reference/devilutionX/Source/monster.cpp:1976-2011 (AiRanged).
  case 'GoatRanged':
    return { routine: ai, model: { kind: 'shared-ranged', retreat: linearChance(ai, rollAt(ai, own.rolls, 1)), shootPause: pauseOf(ai, rollAt(ai, own.rolls, 0)), specialAnimation: false }, approaches: false, phase: 'full-alert clear-line shooting with a legal retreat tile; a blocked retreat can still fire in the same invocation; partial-alert approach is animation-limited', keepAwayTiles: keepAwayOf(ai), source: 'monster.cpp:1976-2011' };
  // .reference/devilutionX/Source/monster.cpp:2314-2372 (FallenAi): gap recorded above.
  case 'Fallen':
    throw new Error('unreachable cadence gap');
  case 'Magma': // .reference/devilutionX/Source/monster.cpp:2013-2067 (AiRangedAvoidance).
  case 'Storm': // .reference/devilutionX/Source/monster.cpp:2013-2067 (AiRangedAvoidance).
  case 'Acid': // .reference/devilutionX/Source/monster.cpp:2013-2067 (AiRangedAvoidance).
  case 'Diablo': // .reference/devilutionX/Source/monster.cpp:2013-2067 (AiRangedAvoidance).
    return { routine: ai, model: { kind: 'ranged-avoidance', farShot: linearChance(ai, rollAt(ai, own.rolls, 2)), closeShot: linearChance(ai, rollAt(ai, own.rolls, 3)), adjacentMelee: linearChance(ai, rollAt(ai, own.rolls, 4)), adjacentPause: pauseOf(ai, rollAt(ai, own.rolls, 4)) }, approaches: true, phase: 'normal goal: approach at 2 tiles, shoot at 3+ tiles, adjacent melee; excludes circling', source: 'monster.cpp:2013-2067' };
  // .reference/devilutionX/Source/monster.cpp:2374-2430 (LeoricAi): gap recorded above.
  case 'SkeletonKing':
    throw new Error('unreachable cadence gap');
  // .reference/devilutionX/Source/monster.cpp:2432-2478 (BatAi), restricted to ordinary approach rather than charge/retreat.
  case 'Bat':
    return { routine: ai, model: { kind: 'settled-per-tick', step: linearChance(ai, rollAt(ai, own.rolls, 1)), stepAfterMove: linearChance(ai, rollAt(ai, own.rolls, 2)), attack: linearChance(ai, rollAt(ai, own.rolls, 3)), settleTicks: 21 }, approaches: true, phase: 'normal goal at 2-4 tiles before melee; excludes post-hit retreat and Gloom charge', source: 'monster.cpp:2432-2478' };
  // .reference/devilutionX/Source/monster.cpp:2480-2507 (GargoyleAi): gap recorded above.
  case 'Gargoyle':
    throw new Error('unreachable cadence gap');
  // .reference/devilutionX/Source/monster.cpp:2509-2524 (ButcherAi).
  case 'Butcher':
    return { routine: ai, model: { kind: 'always' }, approaches: true, phase: 'alert combat', source: 'monster.cpp:2509-2524' };
  // .reference/devilutionX/Source/monster.cpp:1976-2011 (AiRanged).
  case 'Succubus':
    return { routine: ai, model: { kind: 'shared-ranged', retreat: linearChance(ai, rollAt(ai, own.rolls, 1)), shootPause: pauseOf(ai, rollAt(ai, own.rolls, 0)), specialAnimation: false }, approaches: false, phase: 'full-alert clear-line shooting with a legal retreat tile; a blocked retreat can still fire in the same invocation; partial-alert approach is animation-limited', keepAwayTiles: keepAwayOf(ai), source: 'monster.cpp:1976-2011' };
  // .reference/devilutionX/Source/monster.cpp:2526-2576 (SneakAi), restricted to the visible Normal goal.
  case 'Sneak':
    return { routine: ai, model: { kind: 'settled-per-tick', step: linearChance(ai, rollAt(ai, own.rolls, 0)), stepAfterMove: linearChance(ai, rollAt(ai, own.rolls, 1)), attack: linearChance(ai, rollAt(ai, own.rolls, 2)), settleTicks: 21 }, approaches: true, phase: 'visible normal goal inside the fade-out boundary; excludes hit-triggered retreat', source: 'monster.cpp:2526-2576' };
  // .reference/devilutionX/Source/monster.cpp:3108 (null AiProc entry): gap recorded above.
  case 'FireMan':
    throw new Error('unreachable cadence gap');
  // .reference/devilutionX/Source/monster.cpp:2578-2628 delegates its hostile phase to AiAvoidance at 1893-1938.
  case 'Gharbad':
    return { routine: ai, model: { kind: 'settled-per-tick', step: linearChance('GoatMelee', rollAt('GoatMelee', goat.rolls, 1)), stepAfterMove: linearChance('GoatMelee', rollAt('GoatMelee', goat.rolls, 2)), attack: linearChance('GoatMelee', rollAt('GoatMelee', goat.rolls, 3)), settleTicks: 21 }, approaches: true, phase: 'hostile healthy Normal goal', phaseGap: 'while quest dialogue keeps the goal Talking or Inquiring, Gharbad has no movement or attack cadence', source: 'monster.cpp:2578-2628,1893-1938' };
  // .reference/devilutionX/Source/monster.cpp:1976-2011 (AiRanged), AcidUnique selects the Special animation at 1996-1999.
  case 'AcidUnique':
    return { routine: ai, model: { kind: 'shared-ranged', retreat: linearChance(ai, rollAt(ai, own.rolls, 1)), specialAnimation: true }, approaches: false, phase: 'full-alert clear-line shooting with a legal retreat tile; a blocked retreat can still fire in the same invocation; SpecialRangedAttack bypasses the normal-shot delay gate; partial-alert approach is animation-limited', keepAwayTiles: keepAwayOf(ai), source: 'monster.cpp:1976-2011' };
  // .reference/devilutionX/Source/monster.cpp:4157-4217 (GolumAi).
  case 'Golem':
    return { routine: ai, model: { kind: 'always' }, approaches: true, phase: 'targeted combat with an available path/tile', source: 'monster.cpp:4157-4217' };
  // .reference/devilutionX/Source/monster.cpp:2786-2816 (ZharAi) delegates to CounselorAi: gap recorded above.
  case 'Zhar':
    throw new Error('unreachable cadence gap');
  // .reference/devilutionX/Source/monster.cpp:2630-2667 (SnotSpilAi) delegates to FallenAi: gap recorded above.
  case 'Snotspill':
    throw new Error('unreachable cadence gap');
  // .reference/devilutionX/Source/monster.cpp:2669-2722 (SnakeAi), away from its one-off distance-2 charge.
  case 'Snake': {
    const step = rollAt(ai, own.rolls, 0);
    const attack = rollAt(ai, own.rolls, 1);
    return { routine: ai, model: { kind: 'forced-pause', step: linearChance(ai, step), stepPause: pauseOf(ai, step), attack: linearChance(ai, attack), attackPause: pauseOf(ai, attack) }, approaches: true, phase: 'range beyond the distance-2 charge; adjacent melee', source: 'monster.cpp:2669-2722' };
  }
  // .reference/devilutionX/Source/monster.cpp:2724-2784 (CounselorAi): gap recorded above.
  case 'Counselor':
    throw new Error('unreachable cadence gap');
  // .reference/devilutionX/Source/monster.cpp:2818-2877 (MegaAi): gap recorded above.
  case 'Mega':
    throw new Error('unreachable cadence gap');
  // .reference/devilutionX/Source/monster.cpp:2879-2926 delegates to CounselorAi and AiDelay at 755-767: gap recorded above.
  case 'Lazarus':
    throw new Error('unreachable cadence gap');
  // .reference/devilutionX/Source/monster.cpp:2928-2951 delegates its hostile phase to AiRanged at 1976-2011.
  case 'LazarusSuccubus':
    return { routine: ai, model: { kind: 'shared-ranged', retreat: linearChance(ai, rollAt(ai, own.rolls, 1)), shootPause: pauseOf(ai, rollAt(ai, own.rolls, 0)), specialAnimation: false }, approaches: false, phase: 'hostile Normal goal with a clear shot and legal retreat tile; a blocked retreat can still fire in the same invocation; partial-alert approach is animation-limited', keepAwayTiles: keepAwayOf(ai), phaseGap: 'before the Betrayer quest releases the minion to the Normal goal, it has no combat cadence', source: 'monster.cpp:2928-2951,1976-2011' };
  // .reference/devilutionX/Source/monster.cpp:2953-2982 (LachdananAi): gap recorded above.
  case 'Lachdanan':
    throw new Error('unreachable cadence gap');
  // .reference/devilutionX/Source/monster.cpp:2984-3007 delegates its hostile phase to SkeletonAi at 2124-2147.
  case 'Warlord': {
    const step = rollAt('SkeletonMelee', skeleton.rolls, 0);
    const attack = rollAt('SkeletonMelee', skeleton.rolls, 1);
    return { routine: ai, model: { kind: 'forced-pause', step: linearChance('SkeletonMelee', step), stepPause: pauseOf('SkeletonMelee', step), attack: linearChance('SkeletonMelee', attack), attackPause: pauseOf('SkeletonMelee', attack) }, approaches: true, phase: 'hostile Normal goal', phaseGap: 'while the confrontation speech keeps the Warlord outside the Normal goal, it has no movement or attack cadence', source: 'monster.cpp:2984-3007,2124-2147' };
  }
  // .reference/devilutionX/Source/monster.cpp:3009-3064 (HorkDemonAi), restricted to distance 2 where spawn/circle cannot run.
  case 'HorkDemon':
    return { routine: ai, model: { kind: 'repeating-pause', stepAfterMove: linearChance(ai, rollAt(ai, own.rolls, 2)), step: linearChance(ai, rollAt(ai, own.rolls, 3)), stepPause: pauseOf(ai, rollAt(ai, own.rolls, 3)), attack: linearChance(ai, rollAt(ai, own.rolls, 4)) }, approaches: true, phase: 'normal goal at 2 tiles; adjacent melee', source: 'monster.cpp:3009-3064' };
  }
}

export interface BehaviourInput {
  walkFrames: number;
  walkRate?: number;
  attackFrames: number;
  attackRate?: number;
  /** Special-attack/ranged animation; omitted synthetic inputs fall back to the normal attack animation. */
  specialAttackFrames?: number;
  specialAttackRate?: number;
  /** The attack's action frame (monstdat `animFrameNum`). */
  actionFrame: number;
  ai: string;
  intelligence: number;
}

export type LocomotionInput = Pick<BehaviourInput, 'walkFrames' | 'walkRate'>;

/** One tile's animation time, independent of the AI routine that decides when to start walking. */
export function walkTicksPerStep(m: LocomotionInput, walkExtra: number): number {
  return m.walkFrames * (m.walkRate ?? 1) + walkExtra;
}

const prob = (p: Pct, int: number) => Math.min(1, Math.max(0, (p.a * int + p.b) / 100));
const meanPause = (q: Pause, int: number) => Math.max(0, q.c - q.d * int) + q.spread / 2;
const failuresBeforeSuccess = (chance: number, label: string, intelligence: number): number => {
  if (chance <= 0) throw new Error(`a ${label} with intelligence ${intelligence} never starts the projected action — no cadence exists`);
  return (1 - chance) / chance;
};

export interface ExpectedTicks {
  step: number;
  /** Adjacent attack; ranged-only routines expose a distinct at-range cadence through `shoot` when needed. */
  attack: number;
  /** Present for newly-modelled ranged routines whose at-range shot cadence is distinct. */
  shoot?: number;
}

/** Expected routine-cadence ticks per started step and attack, including idle decisions, pauses and animations. */
export function expectedTicks(m: BehaviourInput, walkExtra: number): ExpectedTicks {
  const walk = walkTicksPerStep(m, walkExtra);
  const attack = m.attackFrames * (m.attackRate ?? 1);
  const specialAttack = (m.specialAttackFrames ?? m.attackFrames) * (m.specialAttackRate ?? m.attackRate ?? 1);
  const law = aiRoutineLaw(m.ai);
  const model = law.model;
  if (model.kind === 'shared-per-tick') {
    const p = prob(model.act, m.intelligence);
    if (p <= 0) throw new Error(`a Zombie with intelligence ${m.intelligence} never acts — no cadence exists`);
    const idle = (1 - p) / p;
    return { step: walk + idle, attack: attack + idle };
  }
  if (model.kind === 'skeleton-ranged') {
    const shot = prob(model.shoot, m.intelligence);
    if (shot <= 0) throw new Error(`a SkeletonRanged with intelligence ${m.intelligence} never shoots — no cadence exists`);
    const retreat = prob(model.retreat, m.intelligence);
    // W44's fixed adjacent slice starts settled and is conditional on a legal retreat tile. A successful retreat
    // consumes `walk` and leaves the slice before the independent shot roll. A blocked Walk returns false in the
    // pinned routine and falls through to that shot roll in this same invocation instead of consuming `walk`.
    const decisionDuration = retreat * walk + (1 - retreat) * (shot * attack + (1 - shot));
    const attackProbability = (1 - retreat) * shot;
    return {
      step: walk,
      attack: decisionDuration / attackProbability,
      shoot: attack + (1 - shot) / shot,
    };
  }
  if (model.kind === 'forced-pause') {
    return {
      // Skeleton/Snake act unconditionally after the one failed-roll pause, so a cycle carries at most one pause.
      step: walk + (1 - prob(model.step, m.intelligence)) * meanPause(model.stepPause, m.intelligence),
      attack: attack + (1 - prob(model.attack, m.intelligence)) * meanPause(model.attackPause, m.intelligence),
    };
  }
  if (model.kind === 'settled-per-tick') {
    const afterMove = prob(model.stepAfterMove, m.intelligence);
    const settled = prob(model.step, m.intelligence);
    const waitForStep = afterMove >= 1
      ? 0
      : (1 - afterMove) * (model.settleTicks + failuresBeforeSuccess(settled, law.routine, m.intelligence));
    const normalChance = prob(model.attack, m.intelligence);
    const specialChance = Math.min(prob(model.specialBand ?? { a: 0, b: 0 }, m.intelligence), 1 - normalChance);
    const totalAttackChance = normalChance + specialChance;
    const attackIdle = failuresBeforeSuccess(totalAttackChance, law.routine, m.intelligence);
    const expectedAnimation = (normalChance * attack + specialChance * specialAttack) / totalAttackChance;
    return {
      step: walk + waitForStep,
      attack: expectedAnimation + attackIdle,
    };
  }
  if (model.kind === 'repeating-pause') {
    const afterMove = prob(model.stepAfterMove, m.intelligence);
    const settled = prob(model.step, m.intelligence);
    const attackChance = prob(model.attack, m.intelligence);
    const pause = meanPause(model.stepPause, m.intelligence);
    const pausesUntilStep = failuresBeforeSuccess(settled, law.routine, m.intelligence) + 1;
    return {
      // A failed post-move roll pauses once, then every failed ordinary roll pauses again until a step succeeds.
      step: walk + (1 - afterMove) * pause * pausesUntilStep,
      attack: attack + failuresBeforeSuccess(attackChance, law.routine, m.intelligence),
    };
  }
  if (model.kind === 'always') return { step: walk, attack };
  if (model.kind === 'shared-ranged') {
    const shotAnimation = model.specialAnimation ? specialAttack : attack;
    const shoot = shotAnimation + (model.shootPause ? meanPause(model.shootPause, m.intelligence) : 0);
    const retreat = prob(model.retreat, m.intelligence);
    // At range there is no retreat, so `shoot` stays the post-shot cycle. Adjacent and with a legal retreat tile,
    // every retreat consumes one walk before the routine can shoot. A blocked RandomWalk leaves Stand active and
    // falls through to the shot in the same invocation, so it belongs to a different geometry-conditioned slice.
    const adjacentAttack = retreat >= 1 ? Infinity : shoot + retreat / (1 - retreat) * walk;
    return { step: walk, attack: adjacentAttack, shoot };
  }
  const closeShot = prob(model.closeShot, m.intelligence);
  const farShot = prob(model.farShot, m.intelligence);
  const adjacentMelee = prob(model.adjacentMelee, m.intelligence);
  const adjacentAttack = closeShot + adjacentMelee;
  if (closeShot >= 1) throw new Error(`a ${law.routine} with intelligence ${m.intelligence} never approaches at 2 tiles — no step cadence exists`);
  const shoot = specialAttack + failuresBeforeSuccess(farShot, law.routine, m.intelligence) * walk;
  const adjacentIdle = failuresBeforeSuccess(adjacentAttack, law.routine, m.intelligence);
  const adjacentAnimation = (closeShot * specialAttack + adjacentMelee * attack) / adjacentAttack;
  return {
    // At two tiles a successful special shot is the only alternative to the otherwise-certain approach step.
    step: walk + closeShot / (1 - closeShot) * specialAttack,
    // The same 0-9999 roll gives the lower band to a special shot and the rest of the attack band to melee.
    // Rolls above the whole attack band start a fresh 5-14 tick pause; no post-delay attack is forced.
    attack: adjacentAnimation + adjacentIdle * meanPause(model.adjacentPause, m.intelligence),
    shoot,
  };
}

export function convertBehaviour(m: BehaviourInput, hero: { walkFrames: number }, target: { walkSpeed: number }) {
  const t = timingLaw();
  const ticks = expectedTicks(m, t.walkExtraTicks);
  const heroTicksPerTile = hero.walkFrames + t.walkExtraTicks;
  const ledger: ConversionLoss[] = [
    { field: 'walkSpeed', grade: 'approximate', reason: 'the reference steps tile by tile with random hesitations; PoF moves continuously at their MEAN speed, scaled by the monster/hero speed ratio' },
    { field: 'attackCycle', grade: 'approximate', reason: 'the reference re-rolls its decision every tick; the cooldown is the EXPECTED time from one swing to the next' },
    { field: 'hitDelay', grade: 'full', reason: 'the action frame at one tick per frame, in real seconds' },
  ];
  const law = aiRoutineLaw(m.ai);
  const cmPerTile = target.walkSpeed * heroTicksPerTile / t.ticksPerSecond;
  const ranged = !law.approaches;
  if (ranged) {
    ledger.push(
      { field: 'approaches', grade: 'full', reason: 'the fully-alert ranged phase holds position or retreats rather than approaching' },
      { field: 'retreatDistance', grade: 'approximate', reason: `may walk away when the target is within ${law.keepAwayTiles} tiles; adjacent cadence assumes a legal retreat tile, while a blocked retreat can still fire in the same invocation` },
      { field: 'projectileSpeed', grade: 'dropped', reason: 'the arrow moves 32 screen pixels per tick in the 2:1 projection — a direction-dependent speed with no single world value; the PoF projectile default is kept' },
    );
  }
  if (law.phaseGap) ledger.push({ field: 'cadencePhase', grade: 'data-only', reason: law.phaseGap });
  return {
    approaches: !ranged,
    retreatDistance: ranged ? (law.keepAwayTiles ?? 0) * cmPerTile : 0,
    walkSpeed: target.walkSpeed * heroTicksPerTile / ticks.step,
    attackCycleSeconds: ticks.attack / t.ticksPerSecond,
    ...(ticks.shoot === undefined ? {} : { shootCycleSeconds: ticks.shoot / t.ticksPerSecond }),
    hitDelaySeconds: m.actionFrame * (m.attackRate ?? 1) / t.ticksPerSecond,
    ticks,
    ledger,
    basis: `${m.ai} routine at intelligence ${m.intelligence}; speed ratio to a hero stepping every ${heroTicksPerTile} ticks ↔ PoF player ${target.walkSpeed} cm/s`,
  };
}

export { attackKindsOf } from '@/lib/catalog/reference/aiRoutines';

/** Back-compatible binary view for older projection callers. */
export function attackKindOf(ai: string): 'melee' | 'ranged' {
  const kinds = attackKindsOf(ai);
  return kinds.includes('missile') || kinds.includes('summon') ? 'ranged' : 'melee';
}
