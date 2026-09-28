/**
 * From "this build is flagged" to the pair to compare in one click, and a budget
 * preview that costs nothing until Apply.
 *
 * Before: the Trends tab drew one mixed-platform line with no budget; a regression
 * surfaced only as raw `[SIZE_BUDGET]` text in an expanded row, and BuildComparison
 * fixed its pair at mount to builds[1]/builds[0] with no way for a caller to hand it one.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { BuildHistoryDashboard } from '@/components/modules/game-systems/BuildHistoryDashboard';
import { getDefaultBudgets } from '@/lib/packaging/size-verdict';

afterEach(cleanup);

const GB = 1024 ** 3;
const P = '';

function build(id: number, platform: string, gib: number, version: string) {
  return {
    id, projectId: P, platform, config: 'Shipping', status: 'success', sizeBytes: gib * GB,
    durationMs: 60000, version, outputPath: null, errorSummary: null, cookTimeMs: null,
    warningCount: 0, errorCount: 0, notes: null, createdAt: `2026-09-0${id}T10:00:00Z`,
  };
}

const BUILDS = [build(3, 'Win64', 3.4, '0.1.3'), build(2, 'Android', 1.0, '0.1.2'), build(1, 'Win64', 3.0, '0.1.1')];
const TREND = [...BUILDS].reverse().map((b) => ({
  id: b.id, projectId: P, platform: b.platform, sizeBytes: b.sizeBytes, version: b.version, createdAt: b.createdAt,
}));

function mockHistory() {
  const dashboard = {
    builds: BUILDS,
    stats: null,
    trend: TREND,
    version: '0.1.3',
    nextVersion: '0.1.4',
    budgets: { budgets: getDefaultBudgets(), failOnRegression: false, unreadable: false },
  };
  const fetchMock = vi.fn().mockImplementation(() => {
    const body = { success: true, data: dashboard };
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('Trends -> Compare', () => {
  it('clicking a flagged Win64 point opens Compare on (baseline, regressor)', async () => {
    mockHistory();
    render(<BuildHistoryDashboard />);
    fireEvent.click(await screen.findByRole('tab', { name: /Trends/i }));
    const flagged = await screen.findByRole('button', { name: /build #3.*flagged/i });
    fireEvent.click(flagged);
    expect(screen.getByRole('tab', { name: /Compare/i }).getAttribute('aria-selected')).toBe('true');
    expect((screen.getByLabelText('Build A') as HTMLSelectElement).value).toBe('1');
    expect((screen.getByLabelText('Build B') as HTMLSelectElement).value).toBe('3');
  });

  it('previews a candidate budget without a request, and Apply posts set-budget for the platform', async () => {
    const fetchMock = mockHistory();
    render(<BuildHistoryDashboard />);
    fireEvent.click(await screen.findByRole('tab', { name: /Trends/i }));
    const readout = await screen.findByTestId('size-whatif-flagged');
    expect(readout.textContent).toMatch(/1 of 2/);
    const callsBefore = fetchMock.mock.calls.length;

    fireEvent.change(screen.getByLabelText(/budget \(GiB\)/i), { target: { value: '2.5' } });
    expect(screen.getByTestId('size-whatif-flagged').textContent).toMatch(/2 of 2/);
    expect(fetchMock.mock.calls.length).toBe(callsBefore);

    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    await waitFor(() => {
      const posted = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
      expect(posted).toBeDefined();
      expect(JSON.parse(String((posted![1] as RequestInit).body))).toEqual({
        action: 'set-budget', platform: 'Win64', budgetBytes: 2.5 * GB, growthPercent: 10,
      });
    });
  });
});
