import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { SpendDashboard as SpendDashboardData, BudgetStatus } from '@/types/cli-spend';

afterEach(cleanup);

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const BUDGET: BudgetStatus = {
  config: { dailyLimitUsd: null, monthlyLimitUsd: null }, todaySpendUsd: 0, monthSpendUsd: 0,
  dailyRemainingUsd: null, monthlyRemainingUsd: null, dailyPct: null, monthlyPct: null,
  dailyExceeded: false, monthlyExceeded: false,
  periods: { zone: 'UTC',
    day: { start: '2026-06-28T00:00:00.000Z', end: '2026-06-29T00:00:00.000Z' },
    month: { start: '2026-06-01T00:00:00.000Z', end: '2026-07-01T00:00:00.000Z' } },
};

const day = (d: string, runs = 1) => ({ day: d, costUsd: 0.5, tokensIn: 1, tokensOut: 1, runs });
// Spend on three days, 20 calendar days apart: 2026-05-09, 05-29, 06-18 -> 41 slots.
const DAILY = [day('2026-05-09'), day('2026-05-29'), day('2026-06-18')];
const dashboard: SpendDashboardData = {
  totalRuns: 3, totalCostUsd: 1.5, totalTokensIn: 3, totalTokensOut: 3,
  byModule: [], byTaskType: [], daily: DAILY, recent: [], budget: BUDGET,
};

vi.mock('@/hooks/useCliSpend', () => ({
  useSpendDashboard: () => ({ dashboard, isLoading: false, error: null, refetch: vi.fn() }),
  useBudget: () => ({ status: BUDGET, isSaving: false, save: vi.fn(), refetch: vi.fn() }),
}));
vi.mock('@/stores/moduleStore', () => ({
  useModuleStore: (selector: (s: { checklistProgress: Record<string, never> }) => unknown) =>
    selector({ checklistProgress: {} }),
}));

import { SpendDashboard } from '@/components/modules/evaluator/SpendDashboard';

describe('Daily spend chart is calendar time', () => {
  it('draws one slot per calendar day, idle days included', () => {
    const { container } = render(<SpendDashboard />);
    const chart = container.querySelector('[aria-label="Daily spend bar chart"]');
    expect(chart).not.toBeNull();
    expect(chart!.querySelectorAll('[tabindex="0"]').length).toBe(41);
  });

  it('does not mutate the recorded-days array the budget preview replays', () => {
    render(<SpendDashboard />);
    expect(dashboard.daily).toHaveLength(3);
  });
});
