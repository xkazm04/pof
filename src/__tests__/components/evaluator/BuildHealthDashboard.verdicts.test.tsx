import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BuildHealthDashboard } from '@/components/modules/evaluator/BuildHealthDashboard';
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
