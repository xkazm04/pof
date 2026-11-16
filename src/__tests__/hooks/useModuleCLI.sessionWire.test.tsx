/**
 * useModuleCLI -> POST /api/session-analytics wire shape (scan-sweep project-ops-api).
 * The hook used to send `promptVariantId` on every outcome; the route builds recordSession from a
 * fixed field list and the table has no column, so it was discarded every time. Variant
 * attribution travels through checklist/complete and the callback handlers instead. Every key the
 * hook hands the recorder must be one the route reads.
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

const ROUTE_FIELDS = ['moduleId', 'sessionKey', 'prompt', 'hadProjectContext', 'success', 'durationMs', 'startedAt', 'completedAt'];

describe('useModuleCLI session outcome wire shape', () => {
  it('sends only fields the session-analytics route reads, even for a variant dispatch', async () => {
    const { result } = renderHook(() =>
      useModuleCLI({ moduleId: HOST, sessionKey: KEY, label: 'L', accentColor: 'x' }),
    );
    act(() => result.current.sendPrompt('variant prompt', { variantId: 'variant-123' }));
    await playRun();
    expect(recordSessionOutcome).toHaveBeenCalledTimes(1);
    const sent = Object.keys(recordSessionOutcome.mock.calls[0][0] as Record<string, unknown>);
    expect(sent.filter((k) => !ROUTE_FIELDS.includes(k))).toEqual([]);
  });
});
