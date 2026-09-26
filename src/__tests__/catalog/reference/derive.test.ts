// /diablo D29 (operator, 2026-09-24): values PoF DERIVES from the reference (mapped columns + engine-derived canon laws)
// live in the projection as `data.derived`, in the reference's own units, so the pipeline and the produce prompt see them.
// Synthetic entity data; the laws come from the canon's own text.
import { describe, it, expect } from 'vitest';
import { MONSTER_DERIVE } from '@/lib/catalog/reference/derive';
import { behaviourLawTexts, timingLaw } from '@/lib/catalog/reference/behaviourScale';
import { contentHash } from '@/lib/catalog/reference/hash';

const monster = (over: Record<string, unknown> = {}, tags = ['Zombie']) => ({
  id: 'x', name: 'x', tags,
  data: { animFrames: '10,20,12,6,16,0', animRates: '3,1,1,1,1,1', attackActionFrame: '8', intelligence: '1', ...over },
});

describe('MONSTER_DERIVE', () => {
  it('derives walk and attack timing in the reference units (ticks, tiles, seconds)', () => {
    const d = MONSTER_DERIVE.derive(monster()) as Record<string, number> & { locomotion: Record<string, number> };
    const t = timingLaw();
    const locomotion = d.locomotion;
    expect(d.walkTicksPerStep).toBeGreaterThanOrEqual(20 + t.walkExtraTicks);
    expect(locomotion.walkTicksPerStep).toBe(20 + t.walkExtraTicks);
    expect(d.tilesPerSecond).toBeLessThanOrEqual(locomotion.tilesPerSecondWhileWalking);
    expect(d.tilesPerSecond).toBeCloseTo(t.ticksPerSecond / d.walkTicksPerStep, 10);
    expect(d.attackCycleSeconds).toBeCloseTo(d.attackCycleTicks / t.ticksPerSecond, 10);
    expect(d.hitDelaySeconds).toBeCloseTo(8 / t.ticksPerSecond, 10);
  });

  it('derives animation-only locomotion and attack kinds for an unmodelled routine', () => {
    const d = MONSTER_DERIVE.derive(monster({ animRates: '3,2,1,1,1,1' }, ['Fallen'])) as Record<string, unknown>;
    const t = timingLaw();
    const locomotion = d.locomotion as Record<string, number>;
    expect(locomotion.walkTicksPerStep).toBe(20 * 2 + t.walkExtraTicks);
    expect(locomotion.tilesPerSecondWhileWalking).toBeCloseTo(t.ticksPerSecond / (20 * 2 + t.walkExtraTicks), 10);
    expect(d.attackKinds).toEqual(['melee', 'heal']);
    expect(d.gap).toMatch(/Fallen.*not modelled.*cadence.*only the while-walking upper bound.*effective tilesPerSecond needs.*cadence model/);
    expect(d.walkTicksPerStep).toBeUndefined();
    expect(d.tilesPerSecond).toBeUndefined();
    expect(d.attackCycleTicks).toBeUndefined();
    expect(d.attackCycleSeconds).toBeUndefined();
  });

  it('names the laws it used (a derived value carries its basis)', () => {
    const d = MONSTER_DERIVE.derive(monster()) as { laws: string[] };
    expect(d.laws).toEqual(expect.arrayContaining(['d1-timing-law', 'd1-ai-zombie-law']));
  });

  it('exposes every attack category used by a modelled routine', () => {
    const d = MONSTER_DERIVE.derive(monster()) as { attackKinds: string[] };
    expect(d.attackKinds).toEqual(['melee']);
  });

  it('reports unmodelled cadence or missing locomotion input as a declared gap', () => {
    expect(MONSTER_DERIVE.derive(monster({}, ['Succubus']))).toMatchObject({ gap: expect.stringMatching(/Succubus.*not modelled/) });
    expect(MONSTER_DERIVE.derive(monster({ animFrames: '' }))).toMatchObject({ gap: expect.stringMatching(/animFrames/) });
  });

  it('versions itself by the law texts it reads, so a law edit re-projects', () => {
    expect(MONSTER_DERIVE.version()).toMatch(/^[0-9a-f]{8,}$/);
    expect(MONSTER_DERIVE.version()).toBe(MONSTER_DERIVE.version());
    expect(MONSTER_DERIVE.version()).not.toBe(contentHash({ code: 'monster-timing@1', laws: behaviourLawTexts() }));
  });
});
