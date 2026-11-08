import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act, fireEvent, waitFor } from '@testing-library/react';
import { BuildHealthDashboard } from '@/components/modules/evaluator/BuildHealthDashboard';
import { useProjectStore } from '@/stores/projectStore';
import type { BuildHealthReport } from '@/lib/ue5-bridge/build-health';

afterEach(cleanup);

function report(counts: { success: number; failed: number; aborted: number }): BuildHealthReport {
  const total = counts.success + counts.failed + counts.aborted;
  return {
    summary: {
      totalBuilds: total,
      successCount: counts.success,
      failedCount: counts.failed,
      abortedCount: counts.aborted,
      successRate: Math.round((counts.success / total) * 100),
      avgDurationMs: 40_000,
      medianDurationMs: 40_000,
      totalErrors: 0,
      totalWarnings: 0,
      avgErrorsPerBuild: 0,
    },
    durationTrend: [],
    slowestTargets: [],
    recurringErrors: [],
    regressions: [],
    generatedAt: '2026-11-08T10:00:00.000Z',
  };
}

/** The Total Builds tile's sub-line — the KPICard that holds data-stat="total-builds". */
function totalBuildsSub(container: HTMLElement): string {
  const stat = container.querySelector('[data-stat="total-builds"]');
  let card: Element | null | undefined = stat;
  // Walk up until the card also carries the sub-line text (the label sits beside the value).
  while (card && !(card.textContent ?? '').includes('Total Builds')) card = card.parentElement;
  return card?.textContent ?? '';
}

describe('BuildHealthDashboard: a refetch never hides rendered rows (table: fetch keeps rows)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('keeps the populated dashboard on screen while Refresh is in flight', async () => {
    useProjectStore.setState({ projectPath: 'C:\\Proj', projectName: 'Did', ueVersion: '5.8.0' });
    const populated = report({ success: 3, failed: 1, aborted: 0 });
    let release: (() => void) | null = null;
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      if (calls > 1) await new Promise<void>((r) => { release = r; });
      return { ok: true, json: async () => ({ success: true, data: populated }) };
    }));

    const { container, findByLabelText } = render(<BuildHealthDashboard />);
    const refresh = await findByLabelText('Refresh build health');
    expect(container.querySelector('[data-stat="total-builds"]')).not.toBeNull();

    await act(async () => { fireEvent.click(refresh); });
    // Second fetch is pending: the KPI row must still be rendered.
    expect(calls).toBe(2);
    expect(container.querySelector('[data-stat="total-builds"]')).not.toBeNull();

    await act(async () => { release?.(); });
    await waitFor(() => expect(container.querySelector('[data-stat="total-builds"]')).not.toBeNull());
  });
});

describe('BuildHealthDashboard: Total Builds verdict (quality-gates: no verdict reads as compliance)', () => {
  it('does not say "all passing" when builds were aborted', () => {
    const { container } = render(<BuildHealthDashboard initialReport={report({ success: 3, failed: 0, aborted: 2 })} />);
    const text = totalBuildsSub(container);
    expect(text).not.toContain('all passing');
    expect(text).toContain('2 aborted');
  });

  it('names failed and aborted builds together', () => {
    const { container } = render(<BuildHealthDashboard initialReport={report({ success: 3, failed: 1, aborted: 1 })} />);
    const text = totalBuildsSub(container);
    expect(text).toContain('1 failed');
    expect(text).toContain('1 aborted');
  });

  it('still says "all passing" when every build succeeded', () => {
    const { container } = render(<BuildHealthDashboard initialReport={report({ success: 4, failed: 0, aborted: 0 })} />);
    expect(totalBuildsSub(container)).toContain('all passing');
  });
});
