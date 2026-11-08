/**
 * What a suite run's record claims must not exceed what actually ran: the verdict, the
 * counts and the detail rows of the Test Harness Results tab. No test reaches a UE editor;
 * the runner and snapshot hooks are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, renderHook, act, fireEvent } from '@testing-library/react';
import type { PofTestResult, PofSnapshotDiffReport } from '@/types/pof-bridge';
import type { SuiteRunResult } from '@/components/modules/project-setup/TestHarnessPanel/types';

const mocks = vi.hoisted(() => ({
  runTest: vi.fn(),
  capture: vi.fn(),
}));

vi.mock('@/hooks/useTestRunner', () => ({
  useTestRunner: () => ({
    runTest: mocks.runTest, results: [], isRunning: false, error: null, clearResults: vi.fn(),
  }),
}));

vi.mock('@/hooks/useSnapshots', () => ({
  useSnapshots: () => ({
    capture: mocks.capture, acceptBaselines: vi.fn(), diffReport: null, isCapturing: false,
    error: null, refreshDiff: vi.fn(),
  }),
}));

vi.mock('@/components/modules/project-setup/TestHarnessPanel/WaitingTestsTab', () => ({ WaitingTestsTab: () => null }));

import { TestHarnessPanel } from '@/components/modules/project-setup/TestHarnessPanel';
import { ScenarioCard } from '@/components/modules/project-setup/TestHarnessPanel/ScenarioCard';
import { TEMPLATE_SCENARIO } from '@/components/modules/project-setup/TestHarnessPanel/constants';
import { useTestHarnessPanel } from '@/components/modules/project-setup/TestHarnessPanel/useTestHarnessPanel';
import { ResultsTab } from '@/components/modules/project-setup/TestHarnessPanel/ResultsTab';

const result = (testId: string, status: PofTestResult['status']): PofTestResult => ({
  testId, status, startTime: '2026-11-08T00:00:00Z', assertions: [], logs: [], errors: [],
});

const run = (name: string, startedAt: number, results: PofTestResult[], snapshotReport: PofSnapshotDiffReport | null = null): SuiteRunResult => ({
  suiteId: name, suiteName: name, startedAt, finishedAt: startedAt + 1000, testResults: results,
  expectedCount: results.length, snapshotReport, status: 'failed',
});

/** A hook with one active suite of `scenarios` scenarios. */
function suiteOf(scenarios: number) {
  const { result: hook } = renderHook(() => useTestHarnessPanel());
  act(() => hook.current.createSuite());
  for (let i = 1; i < scenarios; i++) act(() => hook.current.addScenario());
  return hook;
}

beforeEach(() => {
  mocks.runTest.mockReset();
  mocks.capture.mockReset();
});

afterEach(() => cleanup());

describe('the Results history', () => {
  it('keeps the opened run open when a newer run lands above it', () => {
    const older = run('Older', 1000, [result('older-test', 'passed')]);
    const newer = run('Newer', 2000, [result('newer-test', 'passed')]);
    const { rerender } = render(<ResultsTab isRunning={false} onClear={() => {}} history={[older]} />);
    expect(screen.queryByText('older-test')).toBeTruthy();
    rerender(<ResultsTab isRunning={false} onClear={() => {}} history={[newer, older]} />);
    expect(screen.queryByText('older-test')).toBeTruthy();
    expect(screen.queryByText('newer-test')).toBeNull();
  });
});

describe('the run detail rows', () => {
  const preset = (presetId: string, status: PofSnapshotDiffReport['results'][number]['status']) => ({
    presetId, presetName: presetId, status, diffPercentage: 0, maxPixelDiff: 0, diffPixelCount: 0, totalPixelCount: 1,
  });

  it('names every preset that did not pass, not only the failed ones', () => {
    const report: PofSnapshotDiffReport = {
      generatedAt: '2026-11-08T00:00:00Z', diffThreshold: 0.5, overallStatus: 'failed',
      results: [preset('fresh-cam', 'no-baseline'), preset('wide-cam', 'resolution-mismatch')],
      summary: { totalPresets: 2, passed: 0, failed: 0, noBaseline: 1, skipped: 0 },
    };
    render(<ResultsTab isRunning={false} onClear={() => {}} history={[run('S', 1000, [], report)]} />);
    expect(screen.getByText(/fresh-cam: no baseline/)).toBeTruthy();
    expect(screen.getByText(/wide-cam: resolution mismatch/)).toBeTruthy();
  });

  const failing = (failureReason?: string): PofTestResult => ({
    ...result('t', 'failed'),
    assertions: [{ id: 'a', status: 'failed', description: 'health', expected: '100', actual: '0', failureReason }],
  });

  it('shows actual and expected for a failed assertion that carries no reason', () => {
    render(<ResultsTab isRunning={false} onClear={() => {}} history={[run('S', 1000, [failing()])]} />);
    expect(screen.getByText(/0 \(expected 100\)/)).toBeTruthy();
  });

  it("shows the plugin's failure reason when it gives one", () => {
    render(<ResultsTab isRunning={false} onClear={() => {}} history={[run('S', 1000, [failing('actor never spawned')])]} />);
    expect(screen.getByText(/actor never spawned/)).toBeTruthy();
  });
});

describe('disclosure state is exposed to assistive tech', () => {
  it('the panel header', () => {
    render(<TestHarnessPanel />);
    const header = screen.getByRole('button', { name: /Test Harness/ });
    expect(header.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('false');
  });

  it('a run row and its test row', () => {
    render(<ResultsTab isRunning={false} onClear={() => {}} history={[run('Suite', 1000, [result('t1', 'failed')])]} />);
    expect(screen.getByRole('button', { name: /Suite/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /t1/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('a scenario section', () => {
    render(<ScenarioCard scenario={TEMPLATE_SCENARIO} index={0} isExpanded onToggle={() => {}} onUpdate={() => {}} onRemove={() => {}} />);
    expect(screen.getByRole('button', { name: /Assertions \(1\)/ }).getAttribute('aria-expanded')).toBe('true');
  });
});

describe('suite verdict', () => {
  it('control: every scenario returned and passed is passed', async () => {
    mocks.runTest.mockResolvedValue(result('a', 'passed'));
    const hook = suiteOf(2);
    await act(async () => { await hook.current.runSuite(); });
    expect(hook.current.suiteRunHistory[0].status).toBe('passed');
  });

  it('a run where no scenario returned a result is an error, never passed', async () => {
    mocks.runTest.mockResolvedValue(null);
    const hook = suiteOf(2);
    await act(async () => { await hook.current.runSuite(); });
    expect(hook.current.suiteRunHistory[0].status).toBe('error');
  });

  it('a scenario lost to a read-back timeout makes the run partial, and it says how many were expected', async () => {
    mocks.runTest.mockResolvedValueOnce(result('a', 'passed')).mockResolvedValueOnce(null);
    const hook = suiteOf(2);
    await act(async () => { await hook.current.runSuite(); });
    expect(hook.current.suiteRunHistory[0].status).toBe('partial');
    expect(hook.current.suiteRunHistory[0].expectedCount).toBe(2);
  });

  it('an aborted run is partial even though everything that ran passed', async () => {
    const hook = suiteOf(2);
    mocks.runTest.mockImplementationOnce(async () => {
      hook.current.abortRun();
      return result('a', 'passed');
    });
    await act(async () => { await hook.current.runSuite(); });
    expect(mocks.runTest).toHaveBeenCalledTimes(1);
    expect(hook.current.suiteRunHistory[0].status).toBe('partial');
  });

  describe('with snapshot presets', () => {
    const passedReport = { overallStatus: 'passed', results: [], summary: {} };

    it('a snapshot-only suite whose comparison passed is passed', async () => {
      mocks.capture.mockResolvedValue(passedReport);
      const hook = suiteOf(1);
      act(() => hook.current.removeScenario(0));
      act(() => hook.current.updateSuiteField(hook.current.activeSuiteId as string, 'snapshotPresets', ['a']));
      await act(async () => { await hook.current.runSuite(); });
      expect(hook.current.suiteRunHistory[0].status).toBe('passed');
    });

    it('scenarios that all vanished stay partial even when the comparison passed', async () => {
      mocks.runTest.mockResolvedValue(null);
      mocks.capture.mockResolvedValue(passedReport);
      const hook = suiteOf(2);
      act(() => hook.current.updateSuiteField(hook.current.activeSuiteId as string, 'snapshotPresets', ['a']));
      await act(async () => { await hook.current.runSuite(); });
      expect(hook.current.suiteRunHistory[0].status).toBe('partial');
    });
  });

  it('a scenario the plugin timed out fails the run', async () => {
    mocks.runTest.mockResolvedValue(result('a', 'timeout'));
    const hook = suiteOf(1);
    await act(async () => { await hook.current.runSuite(); });
    expect(hook.current.suiteRunHistory[0].status).toBe('failed');
  });

  it('the Results row counts against the scenarios expected, not the results returned', () => {
    render(
      <ResultsTab
        isRunning={false}
        onClear={() => {}}
        history={[{
          suiteId: 's', suiteName: 'Suite', startedAt: 1000, finishedAt: 2000,
          testResults: [result('a', 'passed')], expectedCount: 3, snapshotReport: null, status: 'partial',
        }]}
      />,
    );
    expect(screen.getByText('1/3 passed')).toBeTruthy();
  });
});
