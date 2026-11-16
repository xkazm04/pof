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
  checkPromptBeforeDispatch: vi.fn(() => Promise.resolve([])),
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
import type { SubModuleId } from '@/types/modules';

const HOST = 'core-engine' as SubModuleId;
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

describe('useModuleCLI — one dispatch, one recorded outcome', () => {
  it('records each dispatch once — a later undispatched run in the session is not re-recorded', async () => {
    const { result } = renderHook(() =>
      useModuleCLI({ moduleId: HOST, sessionKey: KEY, label: 'L', accentColor: 'x' }),
    );
    act(() => result.current.sendPrompt('first prompt'));
    await playRun();
    // A second run in the same tab that this hook never dispatched.
    await playRun();
    expect(recordSessionOutcome).toHaveBeenCalledTimes(1);

    // A fresh dispatch is recorded again.
    act(() => result.current.sendPrompt('second prompt'));
    await playRun();
    expect(recordSessionOutcome).toHaveBeenCalledTimes(2);
    expect(recordSessionOutcome.mock.calls[1][0].prompt).toBe('second prompt');
  });
});
