/**
 * useModuleCLI run attribution (scan-sweep night 2026-11-08,
 * module-cli-orchestration-hooks).
 *
 * 1. A host that dispatches tasks for OTHER modules (the Unified Summary's lift-plan
 *    Review is mounted once, under core-engine, and reviews any module) can opt into
 *    attributing each run to the dispatched task's module. Without it every review's
 *    session analytics and anti-pattern check went to the host module.
 * 2. The analytics context belongs to ONE dispatch. A later run in the same session
 *    that this hook did not dispatch (a follow-up typed in the terminal, an Activity
 *    feed prompt routed into the tab) must not be recorded again under the old
 *    prompt and the old start time.
 *
 * No real CLI is spawned: dispatch, prompt composition and the recorder are mocked,
 * and a run's end is played as the store's isRunning true -> false edge.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

const { recordSessionOutcome, checkPromptBeforeDispatch } = vi.hoisted(() => ({
  recordSessionOutcome: vi.fn(),
  checkPromptBeforeDispatch: vi.fn<(prompt: string, moduleId: string) => Promise<unknown[]>>(() => Promise.resolve([])),
}));

vi.mock('@/hooks/useSessionAnalytics', () => ({ recordSessionOutcome }));
vi.mock('@/lib/cli-dispatch', () => ({ dispatchPromptWhenReady: vi.fn() }));
vi.mock('@/lib/prompt-evolution/dispatch-resolve', () => ({
  STATIC_VARIANT_ID: 'static',
  composeTaskDispatch: vi.fn((task: { prompt: string }) => Promise.resolve({ prompt: `ENRICHED ${task.prompt}`, variantId: 'static' })),
}));
vi.mock('@/stores/patternLibraryStore', () => ({
  usePatternLibraryStore: { getState: () => ({ checkPromptBeforeDispatch }) },
}));

import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useProjectStore } from '@/stores/projectStore';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import type { SubModuleId } from '@/types/modules';

const HOST = 'core-engine' as SubModuleId;
const REVIEWED = 'arpg-loot' as SubModuleId;
const KEY = 'attribution-test';

function setRunning(running: boolean, success = true) {
  const { sessions } = useCLIPanelStore.getState();
  const id = Object.keys(sessions).find((k) => sessions[k].sessionKey === KEY);
  if (!id) throw new Error('session not created');
  useCLIPanelStore.setState({
    sessions: { ...sessions, [id]: { ...sessions[id], isRunning: running, lastTaskSuccess: running ? null : success } },
  } as never);
}

async function playRun() {
  act(() => setRunning(true));
  act(() => setRunning(false));
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null, maximizedTabId: null });
  // No project: scanProject and the telemetry skill resolve both no-op.
  useProjectStore.setState({ projectPath: null as unknown as string, projectName: null as unknown as string });
  recordSessionOutcome.mockClear();
  checkPromptBeforeDispatch.mockClear();
});

afterEach(cleanup);

describe('useModuleCLI — run attribution', () => {
  it('records a task-module run under the dispatched task module when the host opts in', async () => {
    const { result } = renderHook(() =>
      useModuleCLI({ moduleId: HOST, sessionKey: KEY, label: 'Health Review', accentColor: 'x', attributeToTaskModule: true }),
    );
    await act(async () => {
      await result.current.execute(TaskFactory.featureReview(REVIEWED, 'Loot', [], 'http://x', 'Loot Review'));
    });
    await playRun();

    expect(recordSessionOutcome).toHaveBeenCalledTimes(1);
    expect(recordSessionOutcome.mock.calls[0][0].moduleId).toBe(REVIEWED);
    expect(checkPromptBeforeDispatch.mock.calls[0][1]).toBe(REVIEWED);
    // The tab still lives in the host module, where its inline terminal is shown.
    const tab = Object.values(useCLIPanelStore.getState().sessions)[0];
    expect(tab.moduleId).toBe(HOST);
  });

  it('keeps host attribution by default', async () => {
    const { result } = renderHook(() =>
      useModuleCLI({ moduleId: HOST, sessionKey: KEY, label: 'L', accentColor: 'x' }),
    );
    await act(async () => {
      await result.current.execute(TaskFactory.featureReview(REVIEWED, 'Loot', [], 'http://x', 'Loot Review'));
    });
    await playRun();
    expect(recordSessionOutcome.mock.calls[0][0].moduleId).toBe(HOST);
  });

});
