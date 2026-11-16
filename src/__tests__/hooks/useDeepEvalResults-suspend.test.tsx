/**
 * scan-sweep 2026-11-08 (code-quality-evaluation): the deep-eval job poll ran on a raw
 * setInterval, so a module the LRU had hidden (SuspendContext = true) kept polling
 * /api/evaluator/deep-eval every UI_TIMEOUTS.pollInterval for the whole scan. The repo
 * convention is useSuspendableEffect for polling; on resume the poll restarts.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { UI_TIMEOUTS } from '@/lib/constants';
import { SuspendContext } from '@/hooks/useSuspend';
import type { DeepEvalJobSnapshot } from '@/lib/evaluator/deep-eval-job';

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ isRunning: false, sendPrompt: vi.fn(), sessionId: null }),
}));

import { useDeepEvalResults } from '@/components/modules/evaluator/DeepEvalResults/useDeepEvalResults';
import { useDeepEvalStore } from '@/stores/deepEvalStore';
import { useProjectStore } from '@/stores/projectStore';

const PROJECT = 'C:/UE/PoF';

const RUNNING: DeepEvalJobSnapshot = {
  scanId: 'scan-1', projectPath: PROJECT, status: 'running', moduleIds: ['arpg-combat'],
  progress: {
    status: 'running', currentModule: null, currentPass: null, completedSteps: 1, totalSteps: 4,
    passStatuses: {}, findings: [], error: null,
  },
  result: null, error: null, startedAt: 1, finishedAt: null,
};

function Harness() {
  const { isRunning } = useDeepEvalResults();
  return <span data-testid="running">{String(isRunning)}</span>;
}

function pollIntervals(spy: ReturnType<typeof vi.spyOn>): number {
  return spy.mock.calls.filter((c: unknown[]) => c[1] === UI_TIMEOUTS.pollInterval).length;
}

beforeEach(() => {
  useDeepEvalStore.setState({ lastScan: null });
  useProjectStore.setState({ projectPath: PROJECT, projectName: 'PoF' });
  globalThis.fetch = vi.fn().mockImplementation((url: string) => {
    const data = String(url).includes('latest=1') ? { scan: null } : { job: RUNNING };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data }) });
  }) as unknown as typeof fetch;
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('useDeepEvalResults - the job poll pauses while the module is suspended', () => {
  it('a hidden module attached to a running job sets up no poll; resuming starts it', async () => {
    const spy = vi.spyOn(globalThis, 'setInterval');
    let rerender: (ui: React.ReactElement) => void = () => {};
    await act(async () => {
      ({ rerender } = render(<SuspendContext.Provider value><Harness /></SuspendContext.Provider>));
    });
    // Visible control: the same tree un-suspended does start the poll.
    expect(pollIntervals(spy)).toBe(0);

    await act(async () => {
      rerender(<SuspendContext.Provider value={false}><Harness /></SuspendContext.Provider>);
    });
    expect(pollIntervals(spy)).toBe(1);
  });
});
