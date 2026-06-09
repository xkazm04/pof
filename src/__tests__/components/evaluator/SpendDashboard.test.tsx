import { describe, it, expect, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { SpendDashboard as SpendDashboardData, BudgetStatus } from '@/types/cli-spend';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// TruncateWithTooltip observes overflow via ResizeObserver, which jsdom lacks.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const dashboardRef = { current: null as SpendDashboardData | null };
const statusRef = { current: {} as BudgetStatus };

vi.mock('@/hooks/useCliSpend', () => ({
  useSpendDashboard: () => ({ dashboard: dashboardRef.current, isLoading: false, error: null, refetch: vi.fn() }),
  useBudget: () => ({ status: statusRef.current, isSaving: false, save: vi.fn(), refetch: vi.fn() }),
}));

// Module store: SpendDashboard reads checklistProgress via a selector.
vi.mock('@/stores/moduleStore', () => ({
  useModuleStore: (selector: (s: { checklistProgress: Record<string, Record<string, boolean>> }) => unknown) =>
    selector({ checklistProgress: { 'arpg-combat': { a: true, b: true, c: false } } }),
}));

import { SpendDashboard } from '@/components/modules/evaluator/SpendDashboard';

const NO_BUDGET: BudgetStatus = {
  config: { dailyLimitUsd: null, monthlyLimitUsd: null },
  todaySpendUsd: 0,
  monthSpendUsd: 0,
  dailyRemainingUsd: null,
  monthlyRemainingUsd: null,
  dailyPct: null,
  monthlyPct: null,
  dailyExceeded: false,
  monthlyExceeded: false,
};

function makeDashboard(): SpendDashboardData {
  return {
    totalRuns: 5,
    totalCostUsd: 1.25,
    totalTokensIn: 12000,
    totalTokensOut: 3400,
    byModule: [
      { key: 'arpg-combat', runs: 3, costUsd: 0.9, tokensIn: 8000, tokensOut: 2000, successCount: 3, avgCostUsd: 0.3 },
      { key: 'animations', runs: 2, costUsd: 0.35, tokensIn: 4000, tokensOut: 1400, successCount: 1, avgCostUsd: 0.175 },
    ],
    byTaskType: [
      { key: 'module-scan', runs: 2, costUsd: 0.8, tokensIn: 6000, tokensOut: 1500, successCount: 2, avgCostUsd: 0.4 },
      { key: 'checklist', runs: 3, costUsd: 0.45, tokensIn: 6000, tokensOut: 1900, successCount: 2, avgCostUsd: 0.15 },
    ],
    daily: [
      { day: '2026-06-07', costUsd: 0.5, tokensIn: 5000, tokensOut: 1000, runs: 2 },
      { day: '2026-06-08', costUsd: 0.75, tokensIn: 7000, tokensOut: 2400, runs: 3 },
    ],
    recent: [
      { id: 2, moduleId: 'arpg-combat', taskType: 'module-scan', taskLabel: 'Scan', sessionKey: 'k', costUsd: 0.4, tokensIn: 3000, tokensOut: 800, cacheReadTokens: 0, cacheCreationTokens: 0, durationMs: 45000, success: true, recordedAt: '2026-06-08T00:00:00Z' },
    ],
    budget: NO_BUDGET,
  };
}

describe('SpendDashboard', () => {
  beforeEach(() => {
    statusRef.current = NO_BUDGET;
  });

  it('shows the empty state (plus the budget panel) when no spend is recorded', () => {
    dashboardRef.current = { ...makeDashboard(), totalRuns: 0 };
    render(<SpendDashboard />);
    expect(screen.getByText(/No spend recorded yet/)).toBeTruthy();
    expect(screen.getByText('Budget guard')).toBeTruthy();
  });

  it('renders KPI totals and the cost-by-module / task-type / ROI sections', () => {
    dashboardRef.current = makeDashboard();
    render(<SpendDashboard />);

    // KPI cost total formatted as USD
    expect(screen.getByText('$1.25')).toBeTruthy();
    expect(screen.getByText('Total Cost')).toBeTruthy();

    // Section headers present
    expect(screen.getByText('Cost by module')).toBeTruthy();
    expect(screen.getByText('Cost by task type')).toBeTruthy();
    expect(screen.getByText('Per-module ROI')).toBeTruthy();

    // Task type label is humanized (not the raw id)
    expect(screen.getAllByText('Module scan').length).toBeGreaterThanOrEqual(1);
  });

  it('computes per-module ROI cost-per-item from checklist completions', () => {
    dashboardRef.current = makeDashboard();
    render(<SpendDashboard />);
    // arpg-combat: $0.90 over 2 completed items → $0.45 / item
    expect(screen.getAllByText('$0.45').length).toBeGreaterThanOrEqual(1);
    // animations has no completed items → em dash
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "No limit set" when no budget is configured', () => {
    dashboardRef.current = makeDashboard();
    render(<SpendDashboard />);
    expect(screen.getAllByText('No limit set').length).toBe(2);
  });
});
