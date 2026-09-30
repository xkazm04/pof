/**
 * A Run Tests dispatch is always closed from UE's report, even when the CLI run
 * completes without its record-run-results callback landing: the view POSTs
 * record-run-results itself (results: []) so the server grades every dispatched
 * scenario from index.json and none is left 'running'.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import type { TestSuite } from '@/types/ai-testing';
import type { CLITask } from '@/lib/cli-task';

type CliOpts = { sessionKey: string; onComplete?: (success: boolean, cb?: 'confirmed' | 'failed' | 'missing') => void };

const h = vi.hoisted(() => ({
  cliOpts: {} as Record<string, CliOpts>,
  execute: vi.fn<(task: unknown) => Promise<void>>(async () => {}),
  retry: vi.fn(),
  bulk: vi.fn(async () => true),
}));

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: CliOpts) => {
    h.cliOpts[opts.sessionKey] = opts;
    return { sendPrompt: vi.fn(), execute: h.execute, isRunning: false };
  },
}));

const SUITE: TestSuite = {
  id: 7,
  name: 'Aggro',
  description: '',
  targetClass: 'AARPGEnemyAIController',
  scenarios: [1, 2].map((id) => ({
    id,
    suiteId: 7,
    name: `Scenario ${id}`,
    description: '',
    stimuli: [],
    expectedActions: [],
    status: 'ready' as const,
    lastRunOutput: '',
    lastRunAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('@/hooks/useAITesting', () => ({
  useAITesting: () => ({
    suites: [SUITE],
    summary: { totalSuites: 1, totalScenarios: 2, passedCount: 0, failedCount: 0, draftCount: 0 },
    activeSuite: SUITE,
    isLoading: false,
    error: null,
    retry: h.retry,
    setActiveSuiteId: vi.fn(),
    createSuite: vi.fn(),
    deleteSuite: vi.fn(),
    createScenario: vi.fn(),
    updateScenario: vi.fn(),
    bulkUpdateScenarioStatus: h.bulk,
    deleteScenario: vi.fn(),
  }),
}));

vi.mock('@/stores/projectStore', () => {
  const state = { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.8.0' };
  return { useProjectStore: (sel: (s: typeof state) => unknown) => sel(state) };
});

vi.mock('@/components/modules/shared/ReviewableModuleView', () => ({
  ReviewableModuleView: ({ extraTabs }: { extraTabs: Array<{ render: () => React.ReactNode }> }) => <div>{extraTabs[0].render()}</div>,
}));

vi.mock('@/components/modules/game-systems/AIBehaviorView/SandboxTab', () => ({
  SandboxTab: ({ handleRunTests }: { handleRunTests: () => void }) => <button onClick={handleRunTests}>Run Tests</button>,
}));

vi.mock('@/components/modules/game-systems/AIBehaviorView/EqsSquadTab', () => ({ EqsSquadTab: () => null }));

import { AIBehaviorView } from '@/components/modules/game-systems/AIBehaviorView';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(
  JSON.stringify({ success: true, data: { updated: [1, 2] } }),
  { status: 200, headers: { 'Content-Type': 'application/json' } },
));

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
  h.execute.mockClear();
  h.retry.mockClear();
  h.bulk.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function dispatchRun(): Promise<string> {
  render(<AIBehaviorView />);
  await act(async () => { fireEvent.click(screen.getByText('Run Tests')); });
  expect(h.execute).toHaveBeenCalledTimes(1);
  const task = h.execute.mock.calls[0][0] as CLITask & { runId: string };
  expect(task.runId).toMatch(/^r-[a-z0-9]{8}$/);
  return task.runId;
}

function recordRunPosts() {
  return fetchMock.mock.calls
    .filter(([url, init]) => url === '/api/ai-testing' && init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init!.body)));
}

describe('AIBehaviorView - Run Tests closes every dispatched scenario from the report', () => {
  it('onComplete(true) with no callback received -> POSTs record-run-results {runId, reportDir, scenarioIds, results: []}', async () => {
    const runId = await dispatchRun();
    await act(async () => { h.cliOpts['ai-test-run'].onComplete?.(true, 'missing'); });

    expect(recordRunPosts()).toEqual([{
      action: 'record-run-results',
      runId,
      reportDir: `C:/proj/PoF/Saved/Automation/PoF-AITests/${runId}`,
      scenarioIds: [1, 2],
      results: [],
    }]);
    expect(h.retry).toHaveBeenCalled();
  });

  it('onComplete(true) with the callback confirmed -> no second POST (the server already graded the run)', async () => {
    await dispatchRun();
    await act(async () => { h.cliOpts['ai-test-run'].onComplete?.(true, 'confirmed'); });
    expect(recordRunPosts()).toEqual([]);
    expect(h.retry).toHaveBeenCalled();
  });
});
