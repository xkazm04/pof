import { describe, it, expect } from 'vitest';
import {
  pacingModel, minutesPerLevel, daysToMax, rewardSchedule, pacingTimeline,
  evenSpacingSuggestion, gapCV, type PacingModel,
} from '@/components/modules/core-engine/sub_progression/_shared/rewardPacing';
import {
  LEVEL_REWARDS, calculateXpForLevel, generateChartData,
} from '@/components/modules/core-engine/sub_progression/_shared/data';

const MODEL: PacingModel = { baseXp: 100, exponent: 1.5, maxLevel: 50, xpPerMinAtL1: 100, rateGrowth: 1 };

describe('reward pacing kernel', () => {
  it('case 1: minutesPerLevel -> 50 entries, L1 1.000 min, L50 7.071 min, XP from calculateXpForLevel', () => {
    const mins = minutesPerLevel(MODEL);
    expect(mins).toHaveLength(50);
    expect(mins[0]).toBeCloseTo(1.0, 3);
    expect(Math.abs(mins[49] - 7.071)).toBeLessThanOrEqual(0.001);
    mins.forEach((m, i) => {
      const level = i + 1;
      expect(m).toBeCloseTo(calculateXpForLevel(level, 100, 1.5) / (100 * level), 9);
    });
  });

  it('case 2 (pure): daysToMax at 30 vs 240 min/day is exactly 8x; default model matches the stated rate', () => {
    expect(daysToMax(MODEL, 30) / daysToMax(MODEL, 240)).toBeCloseTo(8, 9);
    expect(pacingModel(100, 1.5)).toEqual(MODEL);
    expect(daysToMax(MODEL, 30)).toBeCloseTo(7.97, 2);
  });

  it('case 4 (pure): rewardSchedule groups 15 rewards into 8 ascending levels; L5 holds Dodge Roll + Force Push', () => {
    const groups = rewardSchedule(LEVEL_REWARDS);
    expect(groups.map((g) => g.level)).toEqual([5, 10, 15, 20, 25, 30, 40, 50]);
    expect(groups[0].rewards.map((r) => r.name)).toEqual(['Dodge Roll', 'Force Push']);
    expect(groups.reduce((n, g) => n + g.rewards.length, 0)).toBe(15);
  });

  it('case 6: pacingTimeline gap hours, droughts at L40/L50 only, clumps at the 7 co-level groups', () => {
    const tl = pacingTimeline(MODEL, rewardSchedule(LEVEL_REWARDS));
    const expected = [0.14, 0.23, 0.30, 0.35, 0.40, 0.44, 0.99, 1.12];
    expect(tl).toHaveLength(8);
    tl.forEach((e, i) => expect(Math.abs(e.gapHours - expected[i])).toBeLessThanOrEqual(0.01));
    expect(tl.filter((e) => e.drought).map((e) => e.level)).toEqual([40, 50]);
    expect(tl.filter((e) => e.clump).map((e) => e.level)).toEqual([5, 10, 15, 20, 30, 40, 50]);
    // hours from start accumulate the gaps
    expect(tl[7].hoursFromStart).toBeCloseTo(tl.reduce((s, e) => s + e.gapHours, 0), 9);
  });

  it('case 7 (pure): evenSpacingSuggestion -> strictly increasing levels in [1,50] ending at 50 with gap CV < 0.10', () => {
    const schedule = rewardSchedule(LEVEL_REWARDS);
    const levels = evenSpacingSuggestion(MODEL, schedule);
    expect(levels).toEqual([12, 20, 26, 31, 36, 41, 46, 50]);
    levels.forEach((l, i) => {
      expect(l).toBeGreaterThanOrEqual(1);
      expect(l).toBeLessThanOrEqual(50);
      if (i) expect(l).toBeGreaterThan(levels[i - 1]);
    });
    const respaced = schedule.map((g, i) => ({ ...g, level: levels[i] }));
    const cvAfter = gapCV(pacingTimeline(MODEL, respaced).map((e) => e.gapHours));
    const cvBefore = gapCV(pacingTimeline(MODEL, schedule).map((e) => e.gapHours));
    expect(cvAfter).toBeLessThan(0.10);
    expect(cvBefore).toBeCloseTo(0.676, 2);
  });

  it('case 8 [guard]: generateChartData and calculateXpForLevel unchanged (35355 at the cap)', () => {
    expect(calculateXpForLevel(50, 100, 1.5)).toBe(35355);
    const chart = generateChartData(100, 1.5);
    expect(chart[0]).toEqual({ level: 1, xp: 100, totalParams: 1 });
    expect(chart[chart.length - 1]).toEqual({ level: 50, xp: 35355, totalParams: 75 });
    expect(chart.map((p) => p.level)).toEqual([1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
  });
});
