/**
 * Adaptive skill packs must reach THIS dispatch whatever the order in which the
 * telemetry fetch and the prompt composition resolve (new key, existing key).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

const { dispatchPromptWhenReady, composeGate } = vi.hoisted(() => ({
  dispatchPromptWhenReady: vi.fn(),
  composeGate: { release: null as null | (() => void) },
}));

vi.mock('@/hooks/useSessionAnalytics', () => ({ recordSessionOutcome: vi.fn() }));
vi.mock('@/lib/cli-dispatch', () => ({ dispatchPromptWhenReady }));
vi.mock('@/lib/cli-spend-client', () => ({ fetchPreflightVerdict: vi.fn(() => Promise.resolve({})) }));
vi.mock('@/stores/preflightStore', () => ({ requestPreflightConfirm: vi.fn(() => Promise.resolve(true)) }));
vi.mock('@/lib/prompt-evolution/dispatch-resolve', () => ({
  STATIC_VARIANT_ID: 'static',
  composeTaskDispatch: vi.fn(
    () => new Promise((resolve) => { composeGate.release = () => resolve({ prompt: 'P', variantId: 'static' }); }),
  ),
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

let resolveFetch: (() => void) | null = null;

beforeEach(() => {
  useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null, maximizedTabId: null });
  useProjectStore.setState({ projectPath: 'C:/p', projectName: 'p', scanProject: () => Promise.resolve() } as never);
  dispatchPromptWhenReady.mockClear();
  composeGate.release = null;
  vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
    resolveFetch = () => resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { skills: ['souls-combat'] } }),
    });
  })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const skillsOf = () => Object.values(useCLIPanelStore.getState().sessions)[0]?.enabledSkills;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('useModuleCLI skill resolution ordering', () => {
  it('fetch resolves first, new session key: packs land on the dispatched session', async () => {
    const { result } = hook();
    let done: Promise<boolean> | undefined;
    await act(async () => { done = result.current.execute(review()); });
    await flush();
    await act(async () => { resolveFetch?.(); });
    await flush();
    await act(async () => { composeGate.release?.(); await done; });
    expect(skillsOf()).toEqual(['souls-combat']);
  });

  it('fetch resolves last (after compose): the prompt still waits for the packs', async () => {
    const { result } = hook();
    let done: Promise<boolean> | undefined;
    await act(async () => { done = result.current.execute(review()); });
    await flush();
    await act(async () => { composeGate.release?.(); });
    await flush();
    expect(dispatchPromptWhenReady).not.toHaveBeenCalled();
    await act(async () => { resolveFetch?.(); await done; });
    expect(skillsOf()).toEqual(['souls-combat']);
    expect(dispatchPromptWhenReady).toHaveBeenCalledTimes(1);
  });

  it('existing session key: packs are applied to the reused session', async () => {
    const id = useCLIPanelStore.getState().createSession({
      label: 'L', accentColor: 'x', moduleId: MODULE, sessionKey: 'k', projectPath: 'C:/p',
    });
    const { result } = hook();
    let done: Promise<boolean> | undefined;
    await act(async () => { done = result.current.execute(review()); });
    await flush();
    await act(async () => { composeGate.release?.(); resolveFetch?.(); await done; });
    expect(useCLIPanelStore.getState().sessions[id].enabledSkills).toEqual(['souls-combat']);
  });
});
