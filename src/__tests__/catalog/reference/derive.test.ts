// /diablo D29 (operator, 2026-09-24): values PoF DERIVES from the reference (mapped columns + engine-derived canon laws)
// live in the projection as `data.derived`, in the reference's own units, so the pipeline and the produce prompt see them.
// Synthetic entity data; the laws come from the canon's own text.
import { describe, it, expect } from 'vitest';
import { MONSTER_DERIVE } from '@/lib/catalog/reference/derive';
import { timingLaw } from '@/lib/catalog/reference/behaviourScale';

const monster = (over: Record<string, unknown> = {}, tags = ['Zombie']) => ({
  id: 'x', name: 'x', tags,
  data: { animFrames: '10,20,12,6,16,0', animRates: '3,1,1,1,1,1', attackActionFrame: '8', intelligence: '1', ...over },
});

describe('MONSTER_DERIVE', () => {
  it('derives walk and attack timing in the reference units (ticks, tiles, seconds)', () => {
    const d = MONSTER_DERIVE.derive(monster()) as Record<string, number>;
    const t = timingLaw();
    expect(d.walkTicksPerStep).toBeGreaterThanOrEqual(20 + t.walkExtraTicks);
    expect(d.tilesPerSecond).toBeCloseTo(t.ticksPerSecond / d.walkTicksPerStep, 10);
    expect(d.attackCycleSeconds).toBeCloseTo(d.attackCycleTicks / t.ticksPerSecond, 10);
    expect(d.hitDelaySeconds).toBeCloseTo(8 / t.ticksPerSecond, 10);
  });

  it('names the laws it used (a derived value carries its basis)', () => {
    const d = MONSTER_DERIVE.derive(monster()) as { laws: string[] };
    expect(d.laws).toEqual(expect.arrayContaining(['d1-timing-law', 'd1-ai-zombie-law']));
  });

  it('reports an unmodelled routine or missing input as a declared gap, never a number', () => {
    expect(MONSTER_DERIVE.derive(monster({}, ['Succubus']))).toMatchObject({ gap: expect.stringMatching(/Succubus.*not modelled/) });
    expect(MONSTER_DERIVE.derive(monster({ animFrames: '' }))).toMatchObject({ gap: expect.stringMatching(/animFrames/) });
  });

  it('versions itself by the law texts it reads, so a law edit re-projects', () => {
    expect(MONSTER_DERIVE.version()).toMatch(/^[0-9a-f]{8,}$/);
    expect(MONSTER_DERIVE.version()).toBe(MONSTER_DERIVE.version());
  });
});
