import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BuildHealthDashboard } from '@/components/modules/evaluator/BuildHealthDashboard';
import { RecurringErrorRow } from '@/components/modules/evaluator/BuildHealthDashboard/RecurringErrorRow';
import type { BuildHealthReport, RecurringError } from '@/lib/ue5-bridge/build-health';

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

function recurring(o: Partial<RecurringError> = {}): RecurringError {
  return {
    fingerprint: 'fp-1', pattern: 'Bar', category: 'unresolved-external', message: 'unresolved external symbol "void __cdecl Bar(void)"',
    occurrences: 2, moduleId: '', errorCode: 'LNK2019', wasResolved: false, lastSeenAt: '2026-05-21T10:00:00Z',
    lastSeenBuildId: 'b2', stillFailing: true, lane: 'PoFEditor Development Win64', lanes: ['PoFEditor Development Win64'],
    fixDescription: 'Ensure "Bar" is defined (not just declared) and its module is in Build.cs', buildsScanned: 10,
    ...o,
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
    recurringErrors: [recurring({ fingerprint: 'fp-1', occurrences: 2 })],
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

  it("surfaces recurring error fingerprints derived from the builds' diagnostics", () => {
    const { container, getByTestId } = render(<BuildHealthDashboard initialReport={populatedReport()} />);
    const errorRow = container.querySelector('[data-error-fingerprint="fp-1"]');
    expect(errorRow).toBeTruthy();
    expect(errorRow?.textContent).toContain('LNK2019');
    expect(errorRow?.textContent).toContain('in 2 builds');
    expect(getByTestId('build-health-errors').textContent).toContain('from build diagnostics');
    expect(getByTestId('build-health-errors').textContent).not.toContain('error memory');
  });

  it('does not celebrate an empty list when the builds counted errors it could not parse', () => {
    const report = populatedReport();
    report.recurringErrors = [];
    const { getByTestId } = render(<BuildHealthDashboard initialReport={report} />);
    const card = getByTestId('build-health-errors');
    expect(card.textContent).not.toContain('No recorded build errors');
    const unparsed = getByTestId('build-health-errors-unparsed');
    expect(unparsed.textContent).toContain('5 build errors');
    expect(unparsed.textContent).toMatch(/no parseable diagnostic/i);
  });

  it('keeps the all-clear only when the builds counted no errors', () => {
    const report = populatedReport();
    report.recurringErrors = [];
    report.summary = { ...report.summary, totalErrors: 0, avgErrorsPerBuild: 0 };
    const { getByTestId, queryByTestId } = render(<BuildHealthDashboard initialReport={report} />);
    expect(getByTestId('build-health-errors').textContent).toContain('No recorded build errors');
    expect(queryByTestId('build-health-errors-unparsed')).toBeNull();
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

describe('RecurringErrorRow', () => {
  it('shows recurrence across builds, the lane, a still-failing marker and the fix hint', () => {
    const { container } = render(
      <RecurringErrorRow
        error={recurring({
          occurrences: 3,
          buildsScanned: 10,
          stillFailing: true,
          wasResolved: false,
          lane: 'DidEditor Development Win64',
          fixDescription: 'Include the header that declares "UFoo"',
        })}
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('in 3 builds');
    expect(text).toContain('DidEditor Development Win64');
    expect(container.querySelector('[data-still-failing="true"]')?.textContent).toMatch(/still failing/i);
    expect(container.querySelector('[aria-label="resolved"]')).toBeNull();
    expect(text).toContain('Include the header that declares "UFoo"');
  });

  it("shows a fixed marker instead when the lane's latest build no longer carries it", () => {
    const { container } = render(<RecurringErrorRow error={recurring({ stillFailing: false, wasResolved: true })} />);
    expect(container.querySelector('[aria-label="resolved"]')).toBeTruthy();
    expect(container.querySelector('[data-still-failing="true"]')).toBeNull();
  });
});
