import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BuildHealthDashboard } from '@/components/modules/evaluator/BuildHealthDashboard';
import type { BuildHealthReport } from '@/lib/ue5-bridge/build-health';

afterEach(cleanup);

function emptyReport(): BuildHealthReport {
  return {
    summary: {
      totalBuilds: 0,
      successCount: 0,
      failedCount: 0,
      abortedCount: 0,
      successRate: 0,
      avgDurationMs: null,
      medianDurationMs: null,
      totalErrors: 0,
      totalWarnings: 0,
      avgErrorsPerBuild: 0,
    },
    durationTrend: [],
    slowestTargets: [],
    recurringErrors: [],
    regressions: [],
    generatedAt: '2026-05-27T10:00:00.000Z',
  };
}

function populatedReport(): BuildHealthReport {
  return {
    summary: {
      totalBuilds: 10,
      successCount: 8,
      failedCount: 2,
      abortedCount: 0,
      successRate: 80,
      avgDurationMs: 42_000,
      medianDurationMs: 40_000,
      totalErrors: 5,
      totalWarnings: 12,
      avgErrorsPerBuild: 0.5,
    },
    durationTrend: [
      { buildId: 'b1', createdAt: '2026-05-20T10:00:00Z', durationMs: 40_000, status: 'success', errorCount: 0, warningCount: 1 },
      { buildId: 'b2', createdAt: '2026-05-21T10:00:00Z', durationMs: 44_000, status: 'success', errorCount: 0, warningCount: 2 },
    ],
    slowestTargets: [
      { targetName: 'PoFEditor', builds: 6, successRate: 83, avgDurationMs: 60_000, maxDurationMs: 90_000, lastStatus: 'success' },
      { targetName: 'PoF', builds: 4, successRate: 75, avgDurationMs: 30_000, maxDurationMs: 35_000, lastStatus: 'failed' },
    ],
    recurringErrors: [
      { fingerprint: 'fp-1', pattern: 'LNK2019 unresolved external', category: 'unresolved-external', message: 'unresolved external symbol', occurrences: 9, moduleId: 'arpg-combat', errorCode: 'LNK2019', wasResolved: false, lastSeenAt: '2026-05-22T10:00:00Z' },
    ],
    regressions: [],
    generatedAt: '2026-05-27T10:00:00.000Z',
  };
}

describe('BuildHealthDashboard', () => {
  it('renders an empty state when no builds have been recorded', () => {
    const { getByTestId } = render(<BuildHealthDashboard initialReport={emptyReport()} />);
    expect(getByTestId('build-health-empty')).toBeTruthy();
  });

  it('renders headline KPIs from the report', () => {
    const { container } = render(<BuildHealthDashboard initialReport={populatedReport()} />);
    expect(container.querySelector('[data-stat="success-rate"]')?.textContent).toContain('80');
    expect(container.querySelector('[data-stat="total-builds"]')?.textContent).toContain('10');
    expect(container.querySelector('[data-stat="total-errors"]')?.textContent).toContain('5');
  });

  it('lists slowest targets ranked, slowest first', () => {
    const { getByTestId, container } = render(<BuildHealthDashboard initialReport={populatedReport()} />);
    expect(getByTestId('build-health-targets')).toBeTruthy();
    const rows = Array.from(container.querySelectorAll('[data-target]'));
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute('data-target')).toBe('PoFEditor');
  });

  it('surfaces recurring error fingerprints from the error-memory DB', () => {
    const { container } = render(<BuildHealthDashboard initialReport={populatedReport()} />);
    const errorRow = container.querySelector('[data-error-fingerprint="fp-1"]');
    expect(errorRow).toBeTruthy();
    expect(errorRow?.textContent).toContain('LNK2019');
    expect(errorRow?.textContent).toContain('9'); // occurrences
  });

  it('shows a regression alert banner when a regression is detected', () => {
    const report = populatedReport();
    report.regressions = [
      {
        kind: 'duration',
        buildId: 'b-spike',
        createdAt: '2026-05-27T10:00:00Z',
        current: 90_000,
        baseline: 40_000,
        deltaPct: 125,
        severity: 'critical',
        message: 'Build duration spiked 125% above the rolling baseline (90s vs 40s).',
      },
    ];
    const { getByTestId } = render(<BuildHealthDashboard initialReport={report} />);
    const banner = getByTestId('build-health-regressions');
    expect(banner.textContent).toContain('125%');
    expect(banner.querySelector('[data-regression-kind="duration"]')).toBeTruthy();
  });

  it('does not render the regression banner when there are no regressions', () => {
    const { queryByTestId } = render(<BuildHealthDashboard initialReport={populatedReport()} />);
    expect(queryByTestId('build-health-regressions')).toBeNull();
  });
});
