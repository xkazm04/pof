import { describe, it, expect } from 'vitest';
import { previewDailyLimit, projectPeriod, budgetPeriods } from '@/lib/cli-spend/budgetPreview';
import type { DailySpend } from '@/types/cli-spend';

const DAILY: DailySpend[] = [
  { day: '2026-09-01', costUsd: 2, tokensIn: 10, tokensOut: 5, runs: 1 },
  { day: '2026-09-02', costUsd: 6, tokensIn: 10, tokensOut: 5, runs: 2 },
  { day: '2026-09-03', costUsd: 12, tokensIn: 10, tokensOut: 5, runs: 3 },
];

const SEPT = { start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' };

describe('previewDailyLimit', () => {
  it('counts the active days a typed limit would have been exceeded on, and names the worst', () => {
    expect(previewDailyLimit(DAILY, 5)).toEqual({
      overDays: 2,
      observedDays: 3,
      worst: { day: '2026-09-03', costUsd: 12 },
    });
  });

  it('makes no claim when there is no limit', () => {
    expect(previewDailyLimit(DAILY, null)).toBeNull();
  });
});

describe('projectPeriod', () => {
  const base = { spendUsd: 30, window: SEPT, now: '2026-09-10T00:00:00.000Z', limitUsd: 60 };

  it('projects the period at the current run rate and says when the limit is reached', () => {
    const p = projectPeriod(base);
    expect(p.projectedUsd).toBeCloseTo(100, 6);
    if (p.projectedUsd == null) throw new Error('expected a projection');
    expect(p.projectedPct).toBeCloseTo(166.667, 2);
    expect(p.reachesLimitAt).toBe('2026-09-19T00:00:00.000Z');
    expect(p.exceeded).toBe(false);
  });

  it('refuses to project under one elapsed day', () => {
    expect(projectPeriod({ ...base, now: '2026-09-01T06:00:00.000Z' })).toEqual({
      projectedUsd: null,
      reason: 'too-early',
    });
  });

  it('reports an already-exceeded limit instead of a reach date', () => {
    const p = projectPeriod({ ...base, spendUsd: 70 });
    if (p.projectedUsd == null) throw new Error('expected a projection');
    expect(p.exceeded).toBe(true);
    expect(p.reachesLimitAt).toBeNull();
  });
});

describe('budgetPeriods (month keys from report-window, zone explicit)', () => {
  it('cuts the day and month at midnight of the given zone and echoes it', () => {
    expect(budgetPeriods(new Date('2026-09-10T12:00:00.000Z'), 'UTC')).toEqual({
      zone: 'UTC',
      day: { start: '2026-09-10T00:00:00.000Z', end: '2026-09-11T00:00:00.000Z' },
      month: SEPT,
    });
    expect(budgetPeriods(new Date('2026-12-31T23:30:00.000Z'), 'Europe/Prague').month).toEqual({
      start: '2026-12-31T23:00:00.000Z',
      end: '2027-01-31T23:00:00.000Z',
    });
  });
});
