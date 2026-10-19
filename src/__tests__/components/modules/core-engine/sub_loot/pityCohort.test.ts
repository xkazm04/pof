// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  simulateCohort, cohortPercentiles, compareToAnalytic, pityBenefit, mulberry32,
} from '@/components/modules/core-engine/sub_loot/pity/pityCohort';
import { findPercentileKill } from '@/components/modules/core-engine/sub_loot/_shared/math';

vi.mock('@/components/modules/core-engine/sub_loot/pity/pityCohort', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/modules/core-engine/sub_loot/pity/pityCohort')>();
  return { ...actual, simulateCohort: vi.fn(actual.simulateCohort) };
});

import { usePityCohort } from '@/components/modules/core-engine/sub_loot/pity/usePityCohort';

const run = (rate: number, threshold: number | null, seed = 7, players = 5000) =>
  simulateCohort({ rate, threshold, players, rng: mulberry32(seed) });

describe('simulateCohort', () => {
  it('returns a sorted kills array of length players, min >= 1, deterministic per seed', () => {
    const a = run(0.1, null);
    const b = run(0.1, null);
    expect(a.kills).toHaveLength(5000);
    expect(a.kills[0]).toBeGreaterThanOrEqual(1);
    expect([...a.kills].sort((x, y) => x - y)).toEqual(a.kills);
    expect(b.kills).toEqual(a.kills);
    expect(run(0.1, null, 8).kills).not.toEqual(a.kills);
  });

  it('threshold caps kills and the forced share matches (1-rate)^(T-1)', () => {
    const T = 20;
    const { kills } = run(0.1, T);
    expect(Math.max(...kills)).toBeLessThanOrEqual(T);
    const forced = kills.filter((k) => k === T).length;
    const p = Math.pow(0.9, T - 1);
    const sigma = Math.sqrt(5000 * p * (1 - p));
    expect(Math.abs(forced - 5000 * p)).toBeLessThanOrEqual(3 * sigma);
  });

  it('threshold 1 gives all ones; rate 0 without pity is capped, not infinite', () => {
    expect(run(0.3, 1).kills.every((k) => k === 1)).toBe(true);
    const r = simulateCohort({ rate: 0, threshold: null, players: 50, cap: 300, rng: mulberry32(1) });
    expect(r.capped).toBe(true);
    expect(r.kills.every((k) => k === 300)).toBe(true);
    expect(run(0.1, null).capped).toBe(false);
  });
});

describe('cohortPercentiles', () => {
  it('uses nearest-rank and tolerates an empty array', () => {
    const kills = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(cohortPercentiles(kills, [50, 95, 99])).toEqual([50, 95, 99]);
    expect(cohortPercentiles([], [50, 95])).toEqual([null, null]);
  });
});

describe('compareToAnalytic', () => {
  it('seeded 5000-player p95 agrees with findPercentileKill', () => {
    for (const [rate, T] of [[0.1, null], [0.1, 20], [0.05, 30]] as const) {
      const c = run(rate, T);
      const cmp = compareToAnalytic(c, rate, T);
      expect(cmp.analyticP95).toBe(findPercentileKill(rate, 95, T));
      expect(Math.abs(cmp.observedP95! - cmp.analyticP95)).toBeLessThanOrEqual(cmp.tolerance);
      expect(cmp.ok).toBe(true);
    }
  });
  it('flags a cohort that disagrees', () => {
    const cmp = compareToAnalytic(run(0.5, null), 0.05, null);
    expect(cmp.ok).toBe(false);
  });
});

describe('pityBenefit', () => {
  it('reports saved kills and players helped', () => {
    const no = run(0.05, null);
    const pity = run(0.05, 30);
    const b = pityBenefit(no, pity);
    expect(b.p99Saved).toBeGreaterThan(0);
    expect(b.worstCaseSaved).toBeGreaterThan(0);
    expect(b.playersHelpedPct).toBeGreaterThan(0);
  });
  it('threshold above the no-pity p99 helps under 1% of players', () => {
    const no = run(0.3, null);
    const [p99] = cohortPercentiles(no.kills, [99]);
    const b = pityBenefit(no, run(0.3, p99! + 20));
    expect(b.playersHelpedPct).toBeLessThan(1);
  });
});

describe('usePityCohort', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.mocked(simulateCohort).mockClear(); });
  afterEach(() => { vi.useRealTimers(); });

  it('debounces: three threshold changes in 150 ms -> one pity simulation, last wins', () => {
    const { result, rerender } = renderHook(({ t }) => usePityCohort({ rate: 0.1, threshold: t, players: 500 }), {
      initialProps: { t: 20 },
    });
    act(() => { vi.advanceTimersByTime(200); });
    vi.mocked(simulateCohort).mockClear();
    rerender({ t: 21 });
    act(() => { vi.advanceTimersByTime(50); });
    rerender({ t: 22 });
    act(() => { vi.advanceTimersByTime(50); });
    rerender({ t: 23 });
    act(() => { vi.advanceTimersByTime(50); });
    expect(simulateCohort).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    const pityCalls = vi.mocked(simulateCohort).mock.calls.filter(([a]) => a.threshold !== null);
    expect(pityCalls).toHaveLength(1);
    expect(pityCalls[0][0].threshold).toBe(23);
    expect(Math.max(...result.current.result!.pity.kills)).toBeLessThanOrEqual(23);
  });
});
