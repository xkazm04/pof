// /diablo W08: a monster's speed and attack cadence, derived from its animation data + its AI routine (both
// engine-derived LAWS parsed from the diablo1 canon), converted to PoF: time in real seconds, distance by the
// monster/player speed ratio. Monster numbers here are synthetic; the laws come from the canon's own text.
import { describe, it, expect } from 'vitest';
import {
  aiRoutineLaw,
  convertBehaviour,
  timingLaw,
  type BehaviourInput,
} from '@/lib/catalog/reference/behaviourScale';

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
    expect(() => aiRoutineLaw('Succubus')).toThrow(/Succubus.*not modelled/);
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

describe('SkeletonRanged (W09): an archer never approaches, shoots on a per-tick chance, and keeps its distance', () => {
  const t = timingLaw();
  it('reads the ranged law from the canon', () => {
    const law = aiRoutineLaw('SkeletonRanged');
    expect(law.routine).toBe('SkeletonRanged');
    expect(law.routine === 'SkeletonRanged' && law.keepAwayTiles).toBeGreaterThan(0);
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
  it('derives the attack kind from the routine, and refuses an unmodelled one', async () => {
    const { attackKindOf } = await import('@/lib/catalog/reference/behaviourScale');
    expect(attackKindOf('SkeletonRanged')).toBe('ranged');
    expect(attackKindOf('Zombie')).toBe('melee');
    expect(() => attackKindOf('Succubus')).toThrow(/not modelled/);
  });
});
