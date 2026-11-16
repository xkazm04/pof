/**
 * scan-sweep (cross-module-features/B): BudgetPace formatted its date with a
 * pinned 'en-GB' and its reset time with the viewer locale, so one surface mixed
 * "3 Sep" with "07:00 PM". Both now take the same locale argument (the viewer's).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BudgetPace } from '@/components/modules/evaluator/SpendBudgetPreview';
import type { BudgetStatus } from '@/types/cli-spend';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-10T12:00:00.000Z')); });

const STATUS = {
  monthSpendUsd: 100,
  config: { dailyLimitUsd: null, monthlyLimitUsd: 150 },
  periods: {
    zone: 'UTC',
    day: { start: '2026-11-10T00:00:00.000Z', end: '2026-11-11T00:00:00.000Z' },
    month: { start: '2026-11-01T00:00:00.000Z', end: '2026-12-01T00:00:00.000Z' },
  },
} as unknown as BudgetStatus;

describe('BudgetPace — one locale convention', () => {
  it('the date and the reset time are formatted with the same locale argument', () => {
    const dateArgs: unknown[] = [];
    const timeArgs: unknown[] = [];
    const d = Date.prototype.toLocaleDateString;
    const t = Date.prototype.toLocaleTimeString;
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (this: Date, ...a: Parameters<Date['toLocaleDateString']>) {
      dateArgs.push(a[0]);
      return d.apply(this, a);
    });
    vi.spyOn(Date.prototype, 'toLocaleTimeString').mockImplementation(function (this: Date, ...a: Parameters<Date['toLocaleTimeString']>) {
      timeArgs.push(a[0]);
      return t.apply(this, a);
    });
    const { container } = render(<BudgetPace status={STATUS} />);
    expect(container.textContent).toContain('reaches the limit');
    expect(dateArgs.length).toBeGreaterThan(0);
    expect(timeArgs.length).toBe(1);
    const all = new Set([...dateArgs, ...timeArgs].map((x) => JSON.stringify(x ?? null)));
    expect(all.size).toBe(1);
  });
});
