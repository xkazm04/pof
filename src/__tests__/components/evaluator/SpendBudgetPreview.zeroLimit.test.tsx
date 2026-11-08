/**
 * scan-sweep (cross-module-features): the budget-edit preview must read a typed
 * limit by the SAME rule the server saves it by. `normalizeLimit` in
 * src/app/api/cli-spend/route.ts stores `0` (and any value <= 0) as "no limit",
 * so previewing a typed `0` as a $0 limit that "would have been exceeded" on
 * every recorded day describes a guard that will never exist once saved.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BudgetEditPreview } from '@/components/modules/evaluator/SpendBudgetPreview';
import type { BudgetStatus, DailySpend } from '@/types/cli-spend';

afterEach(cleanup);

const HISTORY = [
  { day: '2026-11-01', costUsd: 1.5 },
  { day: '2026-11-02', costUsd: 2.25 },
] as unknown as DailySpend[];

const STATUS = {
  monthSpendUsd: 3.75,
  config: { dailyLimitUsd: null, monthlyLimitUsd: null },
  periods: {
    zone: 'UTC',
    day: { start: '2026-11-08T00:00:00.000Z', end: '2026-11-09T00:00:00.000Z' },
    month: { start: '2026-11-01T00:00:00.000Z', end: '2026-12-01T00:00:00.000Z' },
  },
} as unknown as BudgetStatus;

describe('BudgetEditPreview — a typed 0 is "no limit", as the server saves it', () => {
  it('previews nothing for a 0 daily and 0 monthly limit', () => {
    const { container } = render(
      <BudgetEditPreview history={HISTORY} status={STATUS} dailyInput="0" monthlyInput="0" />,
    );
    expect(container.textContent).toBe('');
  });

  it('still previews a real positive limit (control)', () => {
    const { container } = render(
      <BudgetEditPreview history={HISTORY} status={STATUS} dailyInput="2" monthlyInput="" />,
    );
    expect(container.textContent).toContain('Daily: would have been exceeded on 1 of');
  });
});
