/**
 * execute()'s control channel, used by a supervising host (the workflow dispatcher).
 * Dispatch, composition and the spend guard are mocked: no CLI spawns.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

const { dispatchPromptWhenReady, requestPreflightConfirm } = vi.hoisted(() => ({
  dispatchPromptWhenReady: vi.fn(),
  requestPreflightConfirm: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/hooks/useSessionAnalytics', () => ({ recordSessionOutcome: vi.fn() }));
vi.mock('@/lib/cli-dispatch', () => ({ dispatchPromptWhenReady }));
vi.mock('@/lib/cli-spend-client', () => ({ fetchPreflightVerdict: vi.fn(() => Promise.resolve({})) }));
vi.mock('@/stores/preflightStore', () => ({ requestPreflightConfirm }));
vi.mock('@/lib/prompt-evolution/dispatch-resolve', () => ({
  STATIC_VARIANT_ID: 'static',
  composeTaskDispatch: vi.fn(() => Promise.resolve({ prompt: 'ENRICHED', variantId: 'static' })),
}));
vi.mock('@/stores/patternLibraryStore', () => ({
  usePatternLibraryStore: { getState: () => ({ checkPromptBeforeDispatch: () => Promise.resolve([]) }) },
}));

import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useProjectStore } from '@/stores/projectStore';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-combat' as SubModuleId;
const hook = () => renderHook(() => useModuleCLI({ moduleId: MODULE, sessionKey: 'k', label: 'L', accentColor: 'x' }));
const review = () => TaskFactory.featureReview(MODULE, 'Combat', [], 'http://x', 'Review');

beforeEach(() => {
  useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null, maximizedTabId: null });
  useProjectStore.setState({ projectPath: null as unknown as string, projectName: null as unknown as string });
  dispatchPromptWhenReady.mockClear();
  requestPreflightConfirm.mockClear();
  requestPreflightConfirm.mockResolvedValue(true);
});

afterEach(cleanup);

describe('useModuleCLI execute control', () => {
  it('dispatches when the host still wants it', async () => {
    const { result } = hook();
    await act(async () => { await result.current.execute(review(), { shouldDispatch: () => true }); });
    expect(dispatchPromptWhenReady).toHaveBeenCalledTimes(1);
  });

  it('drops the launch when the host cancelled during the prepare', async () => {
    const { result } = hook();
    await act(async () => { await result.current.execute(review(), { shouldDispatch: () => false }); });
    expect(dispatchPromptWhenReady).not.toHaveBeenCalled();
  });

  it('tells the host a declined spend guard launched nothing', async () => {
    requestPreflightConfirm.mockResolvedValue(false);
    const onDeclined = vi.fn();
    const { result } = hook();
    await act(async () => { await result.current.execute(review(), { onDeclined }); });
    expect(onDeclined).toHaveBeenCalledTimes(1);
    expect(dispatchPromptWhenReady).not.toHaveBeenCalled();
  });

  it('behaves as before with no control', async () => {
    const { result } = hook();
    await act(async () => { await result.current.execute(review()); });
    expect(dispatchPromptWhenReady).toHaveBeenCalledTimes(1);
  });
});
