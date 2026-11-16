import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { SpendBudgetPanel } from '@/components/modules/evaluator/SpendBudgetPanel';
import type { BudgetStatus } from '@/types/cli-spend';

afterEach(cleanup);

const STATUS: BudgetStatus = {
  config: { dailyLimitUsd: 5, monthlyLimitUsd: 50 }, todaySpendUsd: 1, monthSpendUsd: 10,
  dailyRemainingUsd: 4, monthlyRemainingUsd: 40, dailyPct: 20, monthlyPct: 20,
  dailyExceeded: false, monthlyExceeded: false,
  periods: { zone: 'UTC',
    day: { start: '2026-09-10T00:00:00.000Z', end: '2026-09-11T00:00:00.000Z' },
    month: { start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' } },
};
const edit = () => fireEvent.click(screen.getByRole('button', { name: /Edit limits/ }));
const save = () => fireEvent.click(screen.getByRole('button', { name: /Save/ }));

describe('SpendBudgetPanel save failure', () => {
  it('reports the failure and stays in the editor', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('disk full'));
    render(<SpendBudgetPanel status={STATUS} isSaving={false} onSave={onSave} />);
    edit();
    save();
    expect((await screen.findByRole('alert')).textContent).toContain('disk full');
    expect(screen.getByLabelText('Daily limit (USD)')).toBeTruthy();
  });

  it('closes the editor on success', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SpendBudgetPanel status={STATUS} isSaving={false} onSave={onSave} />);
    edit();
    save();
    await waitFor(() => expect(screen.queryByLabelText('Daily limit (USD)')).toBeNull());
  });
});
