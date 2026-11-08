/**
 * What a suite run's record claims must not exceed what actually ran: the verdict, the
 * counts and the detail rows of the Test Harness Results tab. No test reaches a UE editor;
 * the runner and snapshot hooks are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, renderHook, act } from '@testing-library/react';
import type { PofTestResult } from '@/types/pof-bridge';

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

import { useTestHarnessPanel } from '@/components/modules/project-setup/TestHarnessPanel/useTestHarnessPanel';
import { ResultsTab } from '@/components/modules/project-setup/TestHarnessPanel/ResultsTab';

const result = (testId: string, status: PofTestResult['status']): PofTestResult => ({
  testId, status, startTime: '2026-11-08T00:00:00Z', assertions: [], logs: [], errors: [],
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
