import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, renderHook, waitFor } from '@testing-library/react';
import { SpendBudgetPanel } from '@/components/modules/evaluator/SpendBudgetPanel';
import { useBudget } from '@/hooks/useCliSpend';

vi.mock('@/lib/api-utils', () => ({
  apiFetch: vi.fn().mockRejectedValue(new Error('network down')),
}));

afterEach(cleanup);

const EMPTY = {
  config: { dailyLimitUsd: null, monthlyLimitUsd: null }, todaySpendUsd: 0, monthSpendUsd: 0,
  dailyRemainingUsd: null, monthlyRemainingUsd: null, dailyPct: null, monthlyPct: null,
  dailyExceeded: false, monthlyExceeded: false,
  periods: { zone: 'UTC',
    day: { start: '2026-09-10T00:00:00.000Z', end: '2026-09-11T00:00:00.000Z' },
    month: { start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' } },
};

describe('budget load failure is not "No limit set"', () => {
  it('useBudget exposes loadError when the fetch rejects', async () => {
    const { result } = renderHook(() => useBudget());
    await waitFor(() => expect(result.current.status.loadError).toBe('network down'));
    expect(result.current.status.isLoaded).toBe(false);
  });

  it('panel shows the error, hides No limit set, and disables Edit limits', () => {
    render(
      <SpendBudgetPanel
        status={{ ...EMPTY, isLoaded: false, loadError: 'network down', retry: vi.fn() }}
        isSaving={false}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('network down');
    expect(screen.queryByText('No limit set')).toBeNull();
    const edit = screen.getByRole('button', { name: /Edit limits/ }) as HTMLButtonElement;
    expect(edit.disabled).toBe(true);
  });

  it('panel without load state still renders No limit set (genuinely none)', () => {
    render(<SpendBudgetPanel status={EMPTY} isSaving={false} onSave={vi.fn()} />);
    expect(screen.getAllByText('No limit set').length).toBe(2);
    expect((screen.getByRole('button', { name: /Edit limits/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});
