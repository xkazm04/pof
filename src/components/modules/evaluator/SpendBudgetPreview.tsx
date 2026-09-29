'use client';

import { formatUsd } from '@/lib/cli-spend/format';
import { previewDailyLimit, projectPeriod } from '@/lib/cli-spend/budgetPreview';
import { STATUS_ERROR, STATUS_WARNING } from '@/lib/chart-colors';
import type { BudgetStatus, DailySpend } from '@/types/cli-spend';

/**
 * Budget-guard consequences, derived only from data the dashboard already holds:
 * - {@link BudgetEditPreview}: under the limit inputs, what the typed limits would
 *   have done over the recorded days and against this month's pace (before Save).
 * - {@link BudgetPace}: under the meters, the month projected at its current run
 *   rate and when the enforced daily window resets.
 * Every figure is labelled as a projection or a replay; nothing is stored or sent.
 */

/** A typed limit: blank / invalid = no limit (mirrors the panel's save rule). */
function parseLimit(input: string): number | null {
  if (input.trim() === '') return null;
  const n = Number(input);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** `3 Sep` for an instant, on the calendar of `zone`. */
function shortDate(iso: string, zone: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: zone });
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function dailyLine(history: DailySpend[], limit: number | null): string | null {
  const p = previewDailyLimit(history, limit);
  if (!p) return null;
  if (p.observedDays === 0 || !p.worst) return 'No recorded days yet to replay this daily limit against.';
  const worst = `${shortDate(`${p.worst.day}T00:00:00.000Z`, 'UTC')} ${formatUsd(p.worst.costUsd)}`;
  const span = `the last ${plural(p.observedDays, 'active day')}`;
  return p.overDays > 0
    ? `Daily: would have been exceeded on ${p.overDays} of ${span}; worst ${worst}.`
    : `Daily: would not have been exceeded on any of ${span} (highest ${worst}).`;
}

function monthlyLine(status: BudgetStatus, limit: number | null): string | null {
  if (limit == null) return null;
  const p = projectPeriod({
    spendUsd: status.monthSpendUsd,
    window: status.periods.month,
    now: new Date(),
    limitUsd: limit,
  });
  if (p.projectedUsd == null) return 'Monthly: too early in the month to project a pace against this limit.';
  if (p.exceeded) return `Monthly: this month's ${formatUsd(status.monthSpendUsd)} is already over this limit.`;
  const pace = `at this month's pace (~${formatUsd(p.projectedUsd)} by month end)`;
  return p.reachesLimitAt
    ? `Monthly: ${pace} this limit would be reached ~${shortDate(p.reachesLimitAt, status.periods.zone)}.`
    : `Monthly: ${pace} this limit holds.`;
}

export function BudgetEditPreview({
  history,
  status,
  dailyInput,
  monthlyInput,
}: {
  history: DailySpend[];
  status: BudgetStatus;
  dailyInput: string;
  monthlyInput: string;
}) {
  const lines = [dailyLine(history, parseLimit(dailyInput)), monthlyLine(status, parseLimit(monthlyInput))].filter(
    (l): l is string => l != null,
  );
  if (lines.length === 0) return null;
  return (
    <div className="col-span-2 space-y-0.5" aria-live="polite">
      {lines.map((l) => (
        <p key={l} className="text-2xs text-text-muted-hover">
          {l}
        </p>
      ))}
    </div>
  );
}

export function BudgetPace({ status }: { status: BudgetStatus }) {
  const { periods } = status;
  const limit = status.config.monthlyLimitUsd;
  const p = projectPeriod({ spendUsd: status.monthSpendUsd, window: periods.month, now: new Date(), limitUsd: limit });
  const resetsAt = new Date(periods.day.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let pace: string | null = null;
  let color = 'var(--text-muted)';
  if (p.projectedUsd != null && (limit != null || status.monthSpendUsd > 0)) {
    pace = `Month projected ~${formatUsd(p.projectedUsd)} at the current pace`;
    if (p.exceeded) {
      pace += ' — the monthly limit is already exceeded.';
      color = STATUS_ERROR;
    } else if (p.reachesLimitAt && limit != null) {
      pace += ` (${Math.round(p.projectedPct ?? 0)}% of ${formatUsd(limit)}); reaches the limit ~${shortDate(p.reachesLimitAt, periods.zone)}.`;
      color = STATUS_WARNING;
    } else {
      pace += limit != null ? `, within the ${formatUsd(limit)} limit.` : '.';
    }
  }

  return (
    <div className="sm:col-span-2 space-y-0.5">
      {pace && (
        <p className="text-2xs" style={{ color }}>
          {pace}
        </p>
      )}
      <p className="text-2xs text-text-muted">
        Budget days are {periods.zone} days: the daily budget resets at {resetsAt} your time.
      </p>
    </div>
  );
}
