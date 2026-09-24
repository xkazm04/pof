/**
 * A monster's speed and attack cadence, converted to PoF (/diablo W08).
 *
 * Diablo I keeps a monster's feel in two places: its animation data (`frames[6]`/`rate[6]`, `animFrameNum` in
 * monstdat) and its AI ROUTINE (code: how often it acts, how long it hesitates). Both are read here — the data from
 * the monster, the routine and the engine's timing from engine-derived LAWS in the diablo1 canon, parsed from the
 * rule text (registry: design-canon-as-executable-law; edit the prose and the number moves, lose the sentence and
 * this refuses). The routine's randomness is reduced to its EXPECTATION.
 *
 * Conversion: time is carried in real seconds (both games run in real time). Distance has no shared unit, so the
 * monster/player SPEED RATIO is preserved against a named player anchor on each side (the D23 idea): a monster that
 * steps as often as the reference hero walks as fast as PoF's player.
 */
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
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

const pct = (m: RegExpExecArray, i: number): Pct => ({ a: Number(m[i]), b: Number(m[i + 1]) });
const pause = (m: RegExpExecArray, i: number): Pause => ({ c: Number(m[i]), d: Number(m[i + 1]), spread: Number(m[i + 2]) });

/** The canon rule ids each modelled routine is read from (a derived value names its basis). */
export const AI_LAW_IDS: Record<string, string> = {
  Zombie: 'd1-ai-zombie-law', SkeletonMelee: 'd1-ai-skeleton-melee-law', SkeletonRanged: 'd1-ai-skeleton-ranged-law',
};

/** The rule texts the behaviour model reads — hashed into the ingest version so a law edit re-projects. */
export function behaviourLawTexts(): string[] {
  return ['d1-timing-law', ...Object.values(AI_LAW_IDS)].map((id) => DIABLO1_CANON.find((r) => r.id === id)?.body ?? `missing:${id}`);
}

export function aiRoutineLaw(ai: string): AiRoutineLaw {
  if (ai === 'Zombie') {
    return { routine: 'Zombie', act: pct(need('d1-ai-zombie-law', /acts on only \((\d+) x intelligence \+ (\d+)\)% of ticks/), 1) };
  }
  if (ai === 'SkeletonMelee') {
    const m = need('d1-ai-skeleton-melee-law',
      /attacks on \((\d+) x intelligence \+ (\d+)\)% of decisions and otherwise pauses \((\d+) - (\d+) x intelligence\) plus 0-(\d+) ticks, then attacks; away from its target it steps on \((\d+) \+ (\d+) x intelligence\)% of decisions and otherwise pauses \((\d+) - (\d+) x intelligence\) plus 0-(\d+) ticks/);
    return {
      routine: 'SkeletonMelee',
      attack: pct(m, 1), attackPause: pause(m, 3),
      step: { a: Number(m[7]), b: Number(m[6]) }, stepPause: pause(m, 8),
    };
  }
  if (ai === 'SkeletonRanged') {
    const m = need('d1-ai-skeleton-ranged-law', /within (\d+) tiles it may walk away[\s\S]*shoots an arrow on \((\d+) x intelligence \+ (\d+)\)% of ticks/);
    return { routine: 'SkeletonRanged', keepAwayTiles: Number(m[1]), shoot: pct(m, 2) };
  }
  throw new Error(`AI routine "${ai}" is not modelled yet — add its engine-derived law to the diablo1 canon first`);
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

const prob = (p: Pct, int: number) => Math.min(1, Math.max(0, (p.a * int + p.b) / 100));
const meanPause = (q: Pause, int: number) => Math.max(0, q.c - q.d * int) + q.spread / 2;

/**
 * Expected ticks per tile stepped and per attack, for one monster under its routine. After a pause the routines
 * act unconditionally (DevilutionX: `var1 == Delay` → attack / walk), so each cycle carries at most one pause.
 */
export function expectedTicks(m: BehaviourInput, walkExtra: number): { step: number; attack: number } {
  const walk = m.walkFrames * (m.walkRate ?? 1) + walkExtra;
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

/** How a monster attacks, from its AI routine (/diablo W09): an archer's routine shoots, the others strike. */
export function attackKindOf(ai: string): 'melee' | 'ranged' {
  return aiRoutineLaw(ai).routine === 'SkeletonRanged' ? 'ranged' : 'melee';
}
