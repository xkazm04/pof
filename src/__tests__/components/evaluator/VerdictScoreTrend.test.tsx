import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { VerdictScoreTrend } from '@/components/modules/evaluator/JudgeVerdictsView/VerdictScoreTrend';
import { VERDICT_HISTORY_LIMIT, type JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/**
 * The trend is VISIBLE where a verdict is already shown. Before the append-only log the modal
 * rendered a rich single verdict with nothing to compare it against.
 */
const STEP = { catalogId: 'items', entityId: 'sword', step: 'Economy', judge: 'llm-panel' as const };

const v = (score: number, judgedAt: string, contentHash?: string): JudgeVerdict => ({
  ...STEP, verdict: score >= 60 ? 'pass' : 'fail', score, findings: 'f', model: 'opus', judgedAt,
  ...(contentHash ? { contentHash } : {}),
});

function mockHistory(history: JudgeVerdict[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.includes('/api/judge-verdicts/history')) throw new Error(`unexpected fetch: ${url}`);
    return { ok: true, json: async () => ({ success: true, data: history }) } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('VerdictScoreTrend', () => {
  it('requests the history for THIS step + judge class only', async () => {
    const fetchMock = mockHistory([]);
    render(<VerdictScoreTrend verdict={STEP} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('catalogId=items');
    expect(url).toContain('entityId=sword');
    expect(url).toContain('step=Economy');
    expect(url).toContain('judge=llm-panel');
  });

  it('shows the improvement across re-judges, with a bar per judgment', async () => {
    mockHistory([v(41, '2026-07-20 10:00'), v(58, '2026-07-22 09:00'), v(77, '2026-07-28 18:30')]);
    const { container } = render(<VerdictScoreTrend verdict={STEP} />);
    await waitFor(() => expect(screen.getByTestId('verdict-trend').textContent).toContain('improved +36'));
    const text = screen.getByTestId('verdict-trend').textContent ?? '';
    expect(text).toContain('IMPROVED');
    expect(text).toContain('41 → 77');
    // Rendered through the shared ChartPanel (one labelled row per judgment), not hand-rolled.
    expect(container.querySelector('[role="figure"]')).toBeTruthy();
    expect(text).toContain('07-20 10:00');
    expect(text).toContain('07-28 18:30');
  });

  it('states the retention bound', async () => {
    mockHistory([v(41, '2026-07-20 10:00'), v(77, '2026-07-28 18:30')]);
    render(<VerdictScoreTrend verdict={STEP} />);
    await waitFor(() => expect(screen.getByTestId('verdict-trend').textContent).toContain(`last ${VERDICT_HISTORY_LIMIT} judgments`));
  });

  it('says there is nothing to compare rather than implying a trend, on a single judgment', async () => {
    mockHistory([v(72, '2026-07-20 10:00')]);
    const { container } = render(<VerdictScoreTrend verdict={STEP} />);
    await waitFor(() => expect(screen.getByTestId('verdict-trend').textContent).toContain('no prior verdict'));
    expect(container.querySelector('[role="figure"]')).toBeNull();
    expect(screen.getByTestId('verdict-trend').textContent).not.toContain('IMPROVED');
  });

  it('warns when a re-judge read the SAME content (variance, not a fix)', async () => {
    mockHistory([v(60, '2026-07-20 10:00', 'v2:aaa'), v(74, '2026-07-22 10:00', 'v2:aaa')]);
    render(<VerdictScoreTrend verdict={STEP} />);
    await waitFor(() => expect(screen.getByTestId('verdict-trend').textContent).toContain('judge variance, not a fix'));
  });

  it('reports a failed fetch instead of rendering an empty trend as fact', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ success: false, error: 'db down' }) } as unknown as Response)));
    render(<VerdictScoreTrend verdict={STEP} />);
    await waitFor(() => expect(screen.getByTestId('verdict-trend').textContent).toContain('unavailable'));
  });
});
