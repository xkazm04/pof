import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SpendBudgetPanel } from '@/components/modules/evaluator/SpendBudgetPanel';
import type { BudgetStatus, DailySpend } from '@/types/cli-spend';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const DAILY: DailySpend[] = [
  { day: '2026-09-01', costUsd: 2, tokensIn: 10, tokensOut: 5, runs: 1 },
  { day: '2026-09-02', costUsd: 6, tokensIn: 10, tokensOut: 5, runs: 2 },
  { day: '2026-09-03', costUsd: 12, tokensIn: 10, tokensOut: 5, runs: 3 },
];

const PERIODS: BudgetStatus['periods'] = {
  zone: 'UTC',
  day: { start: '2026-09-10T00:00:00.000Z', end: '2026-09-11T00:00:00.000Z' },
  month: { start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' },
};

function status(over: Partial<BudgetStatus> = {}): BudgetStatus {
  return {
    config: { dailyLimitUsd: null, monthlyLimitUsd: null },
    todaySpendUsd: 0,
    monthSpendUsd: 0,
    dailyRemainingUsd: null,
    monthlyRemainingUsd: null,
    dailyPct: null,
    monthlyPct: null,
    dailyExceeded: false,
    monthlyExceeded: false,
    periods: PERIODS,
    ...over,
  };
}

describe('SpendBudgetPanel preview', () => {
  it('previews what a typed daily limit would have done, before Save', () => {
    const onSave = vi.fn();
    render(<SpendBudgetPanel status={status()} daily={DAILY} isSaving={false} onSave={onSave} />);
    fireEvent.click(screen.getByText('Edit limits'));
    fireEvent.change(screen.getByLabelText('Daily limit (USD)'), { target: { value: '5' } });
    expect(screen.getByText(/exceeded on 2 of the last 3 active days/)).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('projects the month at pace in view mode, with the reach date', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-10T00:00:00.000Z'));
    render(
      <SpendBudgetPanel
        status={status({
          config: { dailyLimitUsd: null, monthlyLimitUsd: 60 },
          monthSpendUsd: 30,
          monthlyRemainingUsd: 30,
          monthlyPct: 50,
        })}
        daily={DAILY}
        isSaving={false}
        onSave={vi.fn()}
      />,
    );
    const line = screen.getByText(/projected/i);
    expect(line.textContent).toMatch(/\$100\.00/);
    expect(line.textContent).toMatch(/19 Sep/);
  });
});
