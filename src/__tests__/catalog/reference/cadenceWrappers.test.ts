import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { aiRoutineCadenceStatus, timingLaw } from '@/lib/catalog/reference/behaviourScale';
import { animationEndTick } from '@/lib/catalog/reference/animationTiming';
import { effectiveUniqueMonstersForPromotion } from '@/lib/catalog/reference/uniqueMonsters';
import { wrapTable } from '@/lib/catalog/reference/wrapper';

const file = resolve('.reference/devilutionX/assets/txtdata/monsters/monstdat.tsv');
const uniqueFile = resolve('.reference/devilutionX/assets/txtdata/monsters/unique_monstdat.tsv');

const numbers = (value: unknown) => String(value).split(',').map((entry) => Number(entry.trim()));
const chance = (percent: number) => Math.min(1, Math.max(0, percent / 100));

describe('real monstdat cadence before/after guard', () => {
  it('keeps Zombie/SkeletonMelee exact, pins retreat-first SkeletonRanged, and adds numbers only to newly-modelled routines', () => {
    if (!existsSync(file)) return;
    const spec = DIABLO1.tables.find((entry) => entry.file === 'monsters/monstdat.tsv')!;
    const wrappers = wrapTable(DIABLO1, spec, readFileSync(file, 'utf8'), 'cadence-comparison').wrappers;
    const t = timingLaw();
    const oldRoutines = new Set(['Zombie', 'SkeletonMelee', 'SkeletonRanged']);
    let oldCount = 0;
    let gainedCount = 0;
    let gapCount = 0;

    for (const wrapper of wrappers) {
      const ai = wrapper.entity.tags?.[0] ?? '';
      const derived = wrapper.entity.data.derived as Record<string, unknown>;
      const hasEffectiveSpeed = typeof derived.tilesPerSecond === 'number';
      if (!oldRoutines.has(ai)) {
        const status = aiRoutineCadenceStatus(ai);
        if (hasEffectiveSpeed) {
          gainedCount++;
          expect(status.modelled, wrapper.key).toBe(true);
        } else {
          gapCount++;
          expect(status.modelled, wrapper.key).toBe(false);
          expect(derived.gap, wrapper.key).toContain(status.reason);
        }
        continue;
      }

      oldCount++;
      const frames = numbers(wrapper.entity.data.animFrames);
      const rates = numbers(wrapper.entity.data.animRates);
      const intelligence = Number(wrapper.entity.data.intelligence);
      const walk = frames[1] * rates[1] + t.walkExtraTicks;
      const attack = animationEndTick(frames[2], rates[2]);
      let step: number;
      let attackCycle: number;
      if (ai === 'Zombie') {
        const idle = (1 - chance(2 * intelligence + 10)) / chance(2 * intelligence + 10);
        step = walk + idle;
        attackCycle = attack + idle;
      } else if (ai === 'SkeletonMelee') {
        step = walk + (1 - chance(4 * intelligence + 65)) * (15 - 2 * intelligence + 4.5);
        attackCycle = attack + (1 - chance(2 * intelligence + 20)) * (10 - 2 * intelligence + 4.5);
      } else {
        step = walk;
        const shoot = chance(2 * intelligence + 3);
        const retreat = chance(2 * intelligence + 13);
        const decisionDuration = retreat * walk + (1 - retreat) * (shoot * attack + (1 - shoot));
        attackCycle = decisionDuration / ((1 - retreat) * shoot);
      }
      expect(derived.walkTicksPerStep, `${wrapper.key} walk`).toBe(step);
      expect(derived.tilesPerSecond, `${wrapper.key} speed`).toBe(t.ticksPerSecond / step);
      expect(derived.attackCycleTicks, `${wrapper.key} attack`).toBe(attackCycle);
      expect(derived.attackCycleSeconds, `${wrapper.key} attack seconds`).toBe(attackCycle / t.ticksPerSecond);
    }

    expect({ total: wrappers.length, oldCount, gainedCount, gapCount }).toEqual({
      total: 112,
      oldCount: 31,
      gainedCount: 51,
      gapCount: 30,
    });
  });

  it('reprojects the ten promoted vanilla uniques with their override AI/intelligence and base animations', () => {
    if (!existsSync(file) || !existsSync(uniqueFile)) return;
    const baseSpec = DIABLO1.tables.find((entry) => entry.file === 'monsters/monstdat.tsv')!;
    const uniqueSpec = DIABLO1.tables.find((entry) => entry.file === 'monsters/unique_monstdat.tsv')!;
    const bases = wrapTable(DIABLO1, baseSpec, readFileSync(file, 'utf8'), 'cadence-comparison').wrappers;
    const uniques = wrapTable(DIABLO1, uniqueSpec, readFileSync(uniqueFile, 'utf8'), 'cadence-comparison').wrappers;
    const result = effectiveUniqueMonstersForPromotion(uniques.slice(0, 10), [...bases, ...uniques]);
    expect(result.unresolved).toEqual([]);
    const timing = result.wrappers.map((wrapper) => ({
      ai: wrapper.raw.ai,
      derived: wrapper.entity.data.derived as Record<string, unknown>,
    }));
    for (const entry of timing) {
      expect(typeof entry.derived.tilesPerSecond === 'number', entry.ai)
        .toBe(aiRoutineCadenceStatus(entry.ai).modelled);
    }
    expect(timing.filter((entry) => typeof entry.derived.tilesPerSecond === 'number')).toHaveLength(5);
    expect(timing.filter((entry) => typeof entry.derived.gap === 'string')).toHaveLength(5);
  });
});
