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
import { D1_AI_ROUTINES, isD1AiRoutineId, type AiAttackKind, type AiRoutineRoll } from '@/lib/catalog/reference/aiRoutines';
import { stableStringify } from '@/lib/catalog/reference/hash';
import type { ConversionLoss } from './playerScale';

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
export type AiRoutineLaw =
  | { routine: 'Zombie'; act: Pct }
  | { routine: 'SkeletonMelee'; attack: Pct; attackPause: Pause; step: Pct; stepPause: Pause }
  | { routine: 'SkeletonRanged'; shoot: Pct; keepAwayTiles: number };

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
  if (!isD1AiRoutineId(ai) || !['Zombie', 'SkeletonMelee', 'SkeletonRanged'].includes(ai)) {
    throw new Error(`AI routine "${ai}" is not modelled for cadence — its engine-derived structure is reference-only`);
  }
  const routine = D1_AI_ROUTINES[ai];
  if (ai === 'Zombie') {
    return { routine: 'Zombie', act: linearChance(ai, rollAt(ai, routine.rolls, 0)) };
  }
  if (ai === 'SkeletonMelee') {
    const stepRoll = rollAt(ai, routine.rolls, 0);
    const attackRoll = rollAt(ai, routine.rolls, 1);
    return {
      routine: 'SkeletonMelee',
      attack: linearChance(ai, attackRoll), attackPause: pauseOf(ai, attackRoll),
      step: linearChance(ai, stepRoll), stepPause: pauseOf(ai, stepRoll),
    };
  }
  const keepAwayTiles = routine.distances.find((d) => d.name === 'retreat band')?.threshold;
  if (keepAwayTiles === undefined) throw new Error('AI routine "SkeletonRanged" has no structured retreat threshold');
  return { routine: 'SkeletonRanged', keepAwayTiles, shoot: linearChance(ai, rollAt(ai, routine.rolls, 2)) };
}

export interface BehaviourInput {
  walkFrames: number;
  walkRate?: number;
  attackFrames: number;
  attackRate?: number;
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

/**
 * Expected routine-cadence ticks per started step and per attack. After a pause the routines act unconditionally
 * (DevilutionX: `var1 == Delay` → attack / walk), so each cycle carries at most one pause.
 */
export function expectedTicks(m: BehaviourInput, walkExtra: number): { step: number; attack: number } {
  const walk = walkTicksPerStep(m, walkExtra);
  const attack = m.attackFrames * (m.attackRate ?? 1);
  const law = aiRoutineLaw(m.ai);
  if (law.routine === 'Zombie') {
    const p = prob(law.act, m.intelligence);
    if (p <= 0) throw new Error(`a Zombie with intelligence ${m.intelligence} never acts — no cadence exists`);
    const idle = (1 - p) / p;
    return { step: walk + idle, attack: attack + idle };
  }
  if (law.routine === 'SkeletonRanged') {
    // It only ever walks AWAY (its retreat hesitation is not modelled: the bare walk is its step), and shoots on a
    // per-tick chance while it stands.
    const p = prob(law.shoot, m.intelligence);
    if (p <= 0) throw new Error(`a SkeletonRanged with intelligence ${m.intelligence} never shoots — no cadence exists`);
    return { step: walk, attack: attack + (1 - p) / p };
  }
  return {
    step: walk + (1 - prob(law.step, m.intelligence)) * meanPause(law.stepPause, m.intelligence),
    attack: attack + (1 - prob(law.attack, m.intelligence)) * meanPause(law.attackPause, m.intelligence),
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
  const ranged = law.routine === 'SkeletonRanged';
  if (ranged) {
    ledger.push(
      { field: 'approaches', grade: 'full', reason: 'the routine never walks toward its target: it holds position' },
      { field: 'retreatDistance', grade: 'approximate', reason: `walks away when the target is within ${law.keepAwayTiles} tiles; the retreat's own chances are not modelled (it always retreats)` },
      { field: 'projectileSpeed', grade: 'dropped', reason: 'the arrow moves 32 screen pixels per tick in the 2:1 projection — a direction-dependent speed with no single world value; the PoF projectile default is kept' },
    );
  }
  return {
    approaches: !ranged,
    retreatDistance: ranged ? law.keepAwayTiles * cmPerTile : 0,
    walkSpeed: target.walkSpeed * heroTicksPerTile / ticks.step,
    attackCycleSeconds: ticks.attack / t.ticksPerSecond,
    hitDelaySeconds: m.actionFrame * (m.attackRate ?? 1) / t.ticksPerSecond,
    ticks,
    ledger,
    basis: `${m.ai} routine at intelligence ${m.intelligence}; speed ratio to a hero stepping every ${heroTicksPerTile} ticks ↔ PoF player ${target.walkSpeed} cm/s`,
  };
}

/** Every attack category used by a routine, without collapsing mixed or non-combat routines. */
export function attackKindsOf(ai: string): AiAttackKind[] {
  if (!isD1AiRoutineId(ai)) throw new Error(`AI routine "${ai}" is not in the engine-derived routine table`);
  return [...new Set(D1_AI_ROUTINES[ai].attacks.map((entry) => entry.kind))];
}

/** Back-compatible binary view for older projection callers. */
export function attackKindOf(ai: string): 'melee' | 'ranged' {
  const kinds = attackKindsOf(ai);
  return kinds.includes('missile') || kinds.includes('summon') ? 'ranged' : 'melee';
}
