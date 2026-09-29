/**
 * Budget-guard preview and pace projection — pure, derived only from data the
 * spend dashboard already returns (daily rollup + the budget status). Nothing
 * here stores or sends anything.
 *
 * - {@link budgetPeriods} builds the enforced day/month windows from the
 *   report-window keys, in an explicit zone (the guard enforces in UTC).
 * - {@link previewDailyLimit} replays a candidate daily limit over recorded days.
 * - {@link projectPeriod} projects a period's spend at its current run rate,
 *   labelled as a projection and refused under one elapsed day.
 */

import { dayKey, monthKey, addDaysToKey, zoneDayStart } from '@/lib/analytics/report-window';
import type { BudgetPeriods, DailySpend, PeriodWindow } from '@/types/cli-spend';

/** The zone the budget guard enforces in: `cli_spend.recorded_at` UTC date prefixes. */
export const ENFORCED_BUDGET_ZONE = 'UTC';

const DAY_MS = 86_400_000;

/** First-day key of the month after month key `YYYY-MM`. */
function nextMonthFirstKey(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

/** The day and month containing `now`, cut at midnight of `zone`, zone echoed. */
export function budgetPeriods(now: Date, zone: string): BudgetPeriods {
  const today = dayKey(now, zone);
  const month = monthKey(now, zone);
  return {
    zone,
    day: { start: zoneDayStart(today, zone), end: zoneDayStart(addDaysToKey(today, 1), zone) },
    month: { start: zoneDayStart(`${month}-01`, zone), end: zoneDayStart(nextMonthFirstKey(month), zone) },
  };
}

export interface DailyLimitPreview {
  /** Recorded days whose spend is over the limit (the guard's `spend > limit`). */
  overDays: number;
  /** Recorded (active) days replayed. */
  observedDays: number;
  /** Costliest recorded day, or null with no days. */
  worst: { day: string; costUsd: number } | null;
}

/** What `limit` would have done over the recorded days; null = no limit, no claim. */
export function previewDailyLimit(daily: DailySpend[], limit: number | null): DailyLimitPreview | null {
  if (limit == null || !Number.isFinite(limit) || limit < 0) return null;
  let overDays = 0;
  let worst: DailyLimitPreview['worst'] = null;
  for (const d of daily) {
    if (d.costUsd > limit) overDays++;
    if (!worst || d.costUsd > worst.costUsd) worst = { day: d.day, costUsd: d.costUsd };
  }
  return { overDays, observedDays: daily.length, worst };
}

export interface ProjectPeriodInput {
  spendUsd: number;
  window: PeriodWindow;
  now: string | Date;
  limitUsd: number | null;
}

export type PeriodProjection =
  | { projectedUsd: null; reason: 'too-early' | 'invalid-window' }
  | {
      projectedUsd: number;
      /** projected / limit × 100; null with no (positive) limit. */
      projectedPct: number | null;
      /** Instant the limit is reached at this pace, when that falls inside the window. */
      reachesLimitAt: string | null;
      /** Spend is already over the limit (the guard's own test). */
      exceeded: boolean;
      ratePerDayUsd: number;
    };

/** Run-rate projection of a period's spend to its end. */
export function projectPeriod({ spendUsd, window, now, limitUsd }: ProjectPeriodInput): PeriodProjection {
  const start = Date.parse(window.start);
  const end = Date.parse(window.end);
  const at = typeof now === 'string' ? Date.parse(now) : now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(at) || end <= start) {
    return { projectedUsd: null, reason: 'invalid-window' };
  }
  const elapsed = Math.min(at, end) - start;
  if (elapsed < DAY_MS) return { projectedUsd: null, reason: 'too-early' };

  const ratePerMs = spendUsd / elapsed;
  const projectedUsd = ratePerMs * (end - start);
  const hasLimit = limitUsd != null && Number.isFinite(limitUsd);
  const exceeded = hasLimit && spendUsd > limitUsd;
  let reachesLimitAt: string | null = null;
  if (hasLimit && !exceeded && ratePerMs > 0 && projectedUsd > limitUsd) {
    reachesLimitAt = new Date(Math.round(start + limitUsd / ratePerMs)).toISOString();
  }
  return {
    projectedUsd,
    projectedPct: hasLimit && limitUsd > 0 ? (projectedUsd / limitUsd) * 100 : null,
    reachesLimitAt,
    exceeded,
    ratePerDayUsd: ratePerMs * DAY_MS,
  };
}
