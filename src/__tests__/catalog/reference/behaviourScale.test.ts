// /diablo W08: a monster's speed and attack cadence, derived from its animation data + its AI routine (both
// engine-derived LAWS parsed from the diablo1 canon), converted to PoF: time in real seconds, distance by the
// monster/player speed ratio. Monster numbers here are synthetic; the laws come from the canon's own text.
import { describe, it, expect } from 'vitest';
import {
  aiRoutineLaw,
  aiRoutineCadenceStatus,
  attackKindsOf,
  behaviourLawTexts,
  convertBehaviour,
  expectedTicks,
  timingLaw,
  walkTicksPerStep,
  type BehaviourInput,
} from '@/lib/catalog/reference/behaviourScale';
import { D1_AI_ROUTINES } from '@/lib/catalog/reference/aiRoutines';

const HERO = { walkFrames: 6 };
const TARGET = { walkSpeed: 500 };
const base: Omit<BehaviourInput, 'ai' | 'intelligence'> = { walkFrames: 10, attackFrames: 9, actionFrame: 5 };

describe('the laws are read from the canon, not remembered', () => {
  it('timing: ticks per second and the walk tick overhead', () => {
    const t = timingLaw();
    expect(t.ticksPerSecond).toBeGreaterThan(0);
    expect(t.walkExtraTicks).toBeGreaterThanOrEqual(0);
  });
  it('an unmodelled AI routine is a refusal naming it', () => {
    expect(() => aiRoutineLaw('Counselor')).toThrow(/Counselor.*not modelled.*fade.*circle.*retreat/);
  });
  it('includes the structured routine table in the derivation-version material', () => {
    expect(behaviourLawTexts().at(-1)).toMatch(/"SkeletonRanged".*"rolls"/);
  });
});

describe('every table routine has either a model or a precise refusal', () => {
  it('classifies all 33 routines without a generic reference-only gap', () => {
    const statuses = Object.keys(D1_AI_ROUTINES).map((ai) => [ai, aiRoutineCadenceStatus(ai)] as const);
    expect(statuses).toHaveLength(33);
    expect(statuses.filter(([, status]) => status.modelled).map(([ai]) => ai)).toHaveLength(22);
    expect(statuses.filter(([, status]) => !status.modelled).map(([ai]) => ai)).toEqual([
      'Scavenger', 'Fallen', 'SkeletonKing', 'Gargoyle', 'FireMan', 'Zhar', 'Snotspill',
      'Counselor', 'Mega', 'Lazarus', 'Lachdanan',
    ]);
    for (const [ai, status] of statuses) {
      if (status.modelled) expect(() => aiRoutineLaw(ai)).not.toThrow();
      else expect(status.reason).toMatch(/health|death|summon|statue|dispatch|talk|fade|distance|dialogue/);
    }
  });

  it('marks quest-gated models as combat-phase expectations', () => {
    expect(aiRoutineLaw('Gharbad').phaseGap).toMatch(/quest dialogue.*no movement or attack cadence/);
    expect(aiRoutineLaw('LazarusSuccubus').phaseGap).toMatch(/before.*quest.*no combat cadence/);
    expect(aiRoutineLaw('Warlord').phaseGap).toMatch(/speech.*no movement or attack cadence/);
  });
});

describe('convertBehaviour', () => {
  const t = timingLaw();
  const tick = 1 / t.ticksPerSecond;
  const cmPerTile = TARGET.walkSpeed * (HERO.walkFrames + t.walkExtraTicks) * tick;

  it('a smarter member of a family is quicker to act (both routines)', () => {
    for (const ai of ['Zombie', 'SkeletonMelee']) {
      const dull = convertBehaviour({ ...base, ai, intelligence: 0 }, HERO, TARGET);
      const sharp = convertBehaviour({ ...base, ai, intelligence: 3 }, HERO, TARGET);
      expect(sharp.attackCycleSeconds).toBeLessThan(dull.attackCycleSeconds);
      expect(sharp.walkSpeed).toBeGreaterThan(dull.walkSpeed);
    }
  });

  it('never moves faster than its bare walk animation allows, and never swings faster than its attack animation', () => {
    for (const ai of ['Zombie', 'SkeletonMelee']) {
      const b = convertBehaviour({ ...base, ai, intelligence: 3 }, HERO, TARGET);
      const bareTicksPerTile = base.walkFrames + t.walkExtraTicks;
      expect(b.walkSpeed).toBeLessThanOrEqual(cmPerTile / (bareTicksPerTile * tick) + 1e-9);
      expect(b.attackCycleSeconds).toBeGreaterThanOrEqual(base.attackFrames * tick - 1e-9);
    }
  });

  it('keeps the monster/player speed ratio: a monster as fast as the hero walks at the target player speed', () => {
    const b = convertBehaviour({ walkFrames: HERO.walkFrames, attackFrames: 9, actionFrame: 5, ai: 'Zombie', intelligence: 45 }, HERO, TARGET);
    // intelligence 45 makes the Zombie act on every tick (2·45+10 = 100%), so it walks back-to-back like the hero.
    expect(b.walkSpeed).toBeCloseTo(TARGET.walkSpeed, 6);
  });

  it('lands its hit on the action frame, in real seconds', () => {
    const b = convertBehaviour({ ...base, ai: 'SkeletonMelee', intelligence: 0 }, HERO, TARGET);
    expect(b.hitDelaySeconds).toBeCloseTo(base.actionFrame * tick, 10);
  });

  it('grades every field and names both anchors', () => {
    const b = convertBehaviour({ ...base, ai: 'Zombie', intelligence: 1 }, HERO, TARGET);
    expect(b.ledger.map((l) => l.field)).toEqual(expect.arrayContaining(['walkSpeed', 'attackCycle', 'hitDelay']));
    for (const l of b.ledger) expect(['full', 'approximate', 'data-only', 'dropped']).toContain(l.grade);
    expect(b.basis).toMatch(/Zombie/);
  });
});

describe('locomotion and routine cadence stay separate', () => {
  const t = timingLaw();

  it('computes the one-tile walking time from animation data alone', () => {
    expect(walkTicksPerStep({ walkFrames: 10, walkRate: 2 }, t.walkExtraTicks)).toBe(21);
  });

  it('preserves the previously modelled routine cadence numbers', () => {
    const input = { ...base, intelligence: 1 };
    expect(expectedTicks({ ...input, ai: 'Zombie' }, t.walkExtraTicks)).toEqual({
      step: 18.333333333333336,
      attack: 16.333333333333336,
    });
    expect(expectedTicks({ ...input, ai: 'SkeletonMelee' }, t.walkExtraTicks)).toEqual({
      step: 16.425,
      attack: 18.75,
    });
    expect(expectedTicks({ ...input, ai: 'SkeletonRanged' }, t.walkExtraTicks)).toEqual({
      step: 11,
      attack: 66.8235294117647,
      shoot: 27.999999999999996,
    });
  });

  it('hand-computes a settle gate and a shared normal/special attack roll (Fat, invented animations)', () => {
    const ticks = expectedTicks({
      ...base, ai: 'Fat', intelligence: 0, specialAttackFrames: 5, specialAttackRate: 2,
    }, t.walkExtraTicks);
    // Step: 11 + (1-.70) * (21 ticks to var2>20 + (.80/.20) failures) = 18.5.
    // Attack: conditional animation (.15*9 + .05*10)/.20 + .80/.20 idle failures = 13.25.
    expect(ticks.step).toBe(18.5);
    expect(ticks.attack).toBeCloseTo(13.25, 12);
  });

  it('hand-computes repeated pauses after the post-move chance (Rhino, invented animations)', () => {
    const ticks = expectedTicks({ ...base, ai: 'Rhino', intelligence: 0 }, t.walkExtraTicks);
    // Step: 11 + (1-.83) * 14.5 / .33. Attack: 9 + .72/.28 idle decisions.
    expect(ticks.step).toBeCloseTo(11 + 0.17 * 14.5 / 0.33, 12);
    expect(ticks.attack).toBeCloseTo(9 + 0.72 / 0.28, 12);
  });

  it('hand-computes a forced post-pause action (Snake, invented animations)', () => {
    const ticks = expectedTicks({ ...base, ai: 'Snake', intelligence: 0 }, t.walkExtraTicks);
    expect(ticks).toEqual({
      step: 11 + 0.35 * 19.5,
      attack: 9 + 0.8 * 14.5,
    });
  });

  it('hand-computes adjacent retreats and the distinct at-range post-shot delay (Succubus, invented animations)', () => {
    expect(expectedTicks({ ...base, ai: 'Succubus', intelligence: 0 }, t.walkExtraTicks)).toEqual({
      step: 11,
      attack: 44.166666666666664,
      shoot: 18.5,
    });
  });

  it('does not apply the normal-shot delay gate to AcidUnique special shots', () => {
    expect(expectedTicks({
      ...base, ai: 'AcidUnique', intelligence: 0, specialAttackFrames: 5, specialAttackRate: 2,
    }, t.walkExtraTicks)).toEqual({
      step: 11,
      attack: 35.666666666666664,
      shoot: 10,
    });
  });

  it('hand-computes competing approach, adjacent attacks and far shots (Magma, invented animations)', () => {
    const ticks = expectedTicks({
      ...base, ai: 'Magma', intelligence: 0, specialAttackFrames: 5, specialAttackRate: 2,
    }, t.walkExtraTicks);
    // At d=2: 5% special shots precede each otherwise-certain step. At d>=3: shots have 10% chance.
    expect(ticks.step).toBeCloseTo(11 + 0.05 / 0.95 * 10, 12);
    expect(ticks.shoot).toBe(10 + 0.9 / 0.1 * 11);
    // Adjacent shared roll: 5% special, next 55% melee, 40% repeated 9.5-tick pauses.
    expect(ticks.attack).toBeCloseTo((0.05 * 10 + 0.55 * 9) / 0.6 + 0.4 / 0.6 * 9.5, 12);
  });

  it('uses bare action animations for deterministic routines (Butcher, invented animations)', () => {
    expect(expectedTicks({ ...base, ai: 'Butcher', intelligence: 0 }, t.walkExtraTicks)).toEqual({ step: 11, attack: 9 });
  });
});

describe('SkeletonRanged (W09): an archer never approaches, shoots on a per-tick chance, and keeps its distance', () => {
  const t = timingLaw();
  it('reads the ranged law from the canon', () => {
    const law = aiRoutineLaw('SkeletonRanged');
    expect(law.routine).toBe('SkeletonRanged');
    expect(law.routine === 'SkeletonRanged' && law.keepAwayTiles).toBeGreaterThan(0);
    expect(law.phase).toMatch(/blocked retreat.*same invocation/);
  });
  it('shoots no faster than its attack animation, and a smarter archer shoots sooner', () => {
    const dull = convertBehaviour({ ...base, ai: 'SkeletonRanged', intelligence: 0 }, HERO, TARGET);
    const sharp = convertBehaviour({ ...base, ai: 'SkeletonRanged', intelligence: 3 }, HERO, TARGET);
    expect(dull.attackCycleSeconds).toBeGreaterThanOrEqual(base.attackFrames / t.ticksPerSecond);
    expect(sharp.attackCycleSeconds).toBeLessThan(dull.attackCycleSeconds);
  });
  it('holds position and converts its keep-away distance through the same tile the speed uses', () => {
    const b = convertBehaviour({ ...base, ai: 'SkeletonRanged', intelligence: 0 }, HERO, TARGET);
    const cmPerTile = TARGET.walkSpeed * (HERO.walkFrames + t.walkExtraTicks) / t.ticksPerSecond;
    expect(b.approaches).toBe(false);
    expect(b.retreatDistance).toBeCloseTo(aiRoutineLaw('SkeletonRanged').routine === 'SkeletonRanged' ? (aiRoutineLaw('SkeletonRanged') as { keepAwayTiles: number }).keepAwayTiles * cmPerTile : 0, 6);
  });
  it('melee routines approach and keep no distance', () => {
    const b = convertBehaviour({ ...base, ai: 'Zombie', intelligence: 0 }, HERO, TARGET);
    expect(b.approaches).toBe(true);
    expect(b.retreatDistance).toBe(0);
  });
});

describe('attackKindOf', () => {
  it('derives both structured and legacy attack kinds from the routine table', async () => {
    const { attackKindOf } = await import('@/lib/catalog/reference/behaviourScale');
    expect(attackKindsOf('Bat')).toEqual(['melee', 'special', 'missile']);
    expect(attackKindsOf('Lachdanan')).toEqual(['none']);
    expect(attackKindOf('SkeletonRanged')).toBe('ranged');
    expect(attackKindOf('Zombie')).toBe('melee');
    expect(attackKindOf('Succubus')).toBe('ranged');
    expect(() => attackKindsOf('Unknown')).toThrow(/not in the engine-derived routine table/);
  });
});
