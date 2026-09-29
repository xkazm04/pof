import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act, fireEvent, renderHook } from '@testing-library/react';
import { BuildHealthDashboard } from '@/components/modules/evaluator/BuildHealthDashboard';
import { useBuildRun } from '@/hooks/useBuildRun';
import { useProjectStore } from '@/stores/projectStore';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { BuildHealthReport, RegressionAlert } from '@/lib/ue5-bridge/build-health';

const BUILD_URL = '/api/ue5-bridge/build';

function report(totalBuilds: number, regressions: RegressionAlert[] = []): BuildHealthReport {
  return {
    summary: {
      totalBuilds, successCount: totalBuilds, failedCount: 0, abortedCount: 0, successRate: totalBuilds ? 100 : 0,
      avgDurationMs: totalBuilds ? 40_000 : null, medianDurationMs: totalBuilds ? 40_000 : null,
      totalErrors: 0, totalWarnings: 0, avgErrorsPerBuild: 0,
    },
    durationTrend: totalBuilds
      ? [{ buildId: 'build-9', createdAt: '2026-09-28T10:00:00Z', durationMs: 40_000, status: 'success', errorCount: 0, warningCount: 0 }]
      : [],
    slowestTargets: [],
    recurringErrors: [],
    regressions,
    generatedAt: '2026-09-29T10:00:00.000Z',
  };
}

const envelope = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });

/** fetch spy routing by URL + method; poll answers are consumed in order. */
function installFetch(opts: { reports: BuildHealthReport[]; polls: unknown[] }) {
  const reports = [...opts.reports];
  const polls = [...opts.polls];
  const spy = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url.startsWith('/api/ue5-bridge/build-health')) return envelope(reports.length > 1 ? reports.shift() : reports[0]);
    if (url === BUILD_URL && method === 'POST') return envelope({ buildId: 'build-2-new' });
    if (url.startsWith(`${BUILD_URL}?projectPath=`)) return envelope(polls.length > 1 ? polls.shift() : polls[0]);
    throw new Error(`unexpected fetch ${method} ${url}`);
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

const posts = (spy: ReturnType<typeof installFetch>) =>
  spy.mock.calls.filter(([url, init]) => url === BUILD_URL && init?.method === 'POST');
const pollsMade = (spy: ReturnType<typeof installFetch>) =>
  spy.mock.calls.filter(([url]) => String(url).startsWith(`${BUILD_URL}?projectPath=`));
const reportFetches = (spy: ReturnType<typeof installFetch>) =>
  spy.mock.calls.filter(([url]) => String(url).startsWith('/api/ue5-bridge/build-health'));

const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  useProjectStore.setState({ projectPath: 'C:\\Proj', projectName: 'Did', ueVersion: '5.8.0' });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Build Health: build now (case 7)', () => {
  it('empty tab offers "Build DidEditor"; mount, polls and the settle refetch never POST — only the click does, once', async () => {
    const running = (percent: number) => ({ queue: [{ buildId: 'build-2-new', status: 'running', progress: { message: '[3/42] Compile A.cpp', percent } }], history: [] });
    const spy = installFetch({
      reports: [report(0), report(1)],
      polls: [running(26), running(60), { queue: [], history: [{ buildId: 'build-2-new', status: 'success', errorCount: 0 }] }],
    });

    const { getByTestId, getByRole, queryByText } = render(<BuildHealthDashboard />);
    await tick(0);
    const empty = getByTestId('build-health-empty');
    expect(empty.textContent).not.toMatch(/module's build action|nightly scheduler/);

    // Idle: time passes, nothing is dispatched and nothing is polled.
    await tick(UI_TIMEOUTS.pollInterval * 3);
    expect(posts(spy)).toHaveLength(0);
    expect(pollsMade(spy)).toHaveLength(0);

    fireEvent.click(getByRole('button', { name: 'Build DidEditor' }));
    await tick(0);
    expect(posts(spy)).toHaveLength(1);
    expect(JSON.parse(String(posts(spy)[0][1]?.body))).toEqual({
      action: 'start', projectPath: 'C:\\Proj', targetName: 'Did', targetType: 'Editor',
      configuration: 'Development', platform: 'Win64', ueVersion: '5.8.0',
    });

    await tick(UI_TIMEOUTS.pollInterval);
    expect(getByTestId('build-run-status').textContent).toContain('26%');
    await tick(UI_TIMEOUTS.pollInterval);
    await tick(UI_TIMEOUTS.pollInterval);
    expect(pollsMade(spy)).toHaveLength(3);
    expect(reportFetches(spy)).toHaveLength(2); // mount + the settle refetch
    expect(queryByText(/No headless builds yet/)).toBeNull();

    // Settled: polling stopped, and still exactly one POST across mount, 3 polls and the refetch.
    await tick(UI_TIMEOUTS.pollInterval * 3);
    expect(pollsMade(spy)).toHaveLength(3);
    expect(posts(spy)).toHaveLength(1);
  });
});

describe('useBuildRun (case 2)', () => {
  it('an invalid project is refused before any request is sent', () => {
    const spy = installFetch({ reports: [report(0)], polls: [] });
    const onSettled = vi.fn();
    const { result } = renderHook(() =>
      useBuildRun({ project: { projectPath: 'C:\\Proj', projectName: 'My Game', ueVersion: '5.8.0' }, onSettled }),
    );
    act(() => { result.current.buildNow(); });
    expect(spy).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe('rejected');
    if (result.current.state.phase === 'rejected') expect(result.current.state.reason).toMatch(/projectName/);
  });
});

describe('RegressionBanner: rebuild to confirm (case 8)', () => {
  it('a duration alert for build-9 POSTs { action: rebuild, buildId: build-9 }', async () => {
    const alert: RegressionAlert = {
      kind: 'duration', buildId: 'build-9', createdAt: '2026-09-28T10:00:00Z', current: 58_000, baseline: 40_000,
      deltaPct: 45, severity: 'warning', message: 'Build took 58s vs 40s baseline',
    };
    const spy = installFetch({ reports: [report(1, [alert])], polls: [{ queue: [], history: [] }] });
    const { getByRole } = render(<BuildHealthDashboard initialReport={report(1, [alert])} />);
    expect(posts(spy)).toHaveLength(0);

    fireEvent.click(getByRole('button', { name: 'Rebuild to confirm' }));
    await tick(0);
    expect(posts(spy)).toHaveLength(1);
    expect(JSON.parse(String(posts(spy)[0][1]?.body))).toEqual({ action: 'rebuild', buildId: 'build-9' });
  });
});
