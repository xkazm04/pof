/**
 * execute() while a project scan is already running must wait for that scan, so
 * the composed prompt carries the scanned context. Dispatch and composition are mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

const { composeTaskDispatch, apiFetch } = vi.hoisted(() => ({
  composeTaskDispatch: vi.fn((..._a: unknown[]) => Promise.resolve({ prompt: 'ENRICHED', variantId: 'static' })),
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/api-utils', async (orig) => ({ ...(await orig<typeof import('@/lib/api-utils')>()), apiFetch }));
vi.mock('@/hooks/useSessionAnalytics', () => ({ recordSessionOutcome: vi.fn() }));
vi.mock('@/lib/cli-dispatch', () => ({ dispatchPromptWhenReady: vi.fn() }));
vi.mock('@/lib/cli-spend-client', () => ({ fetchPreflightVerdict: vi.fn(() => Promise.resolve({})) }));
vi.mock('@/stores/preflightStore', () => ({ requestPreflightConfirm: vi.fn(() => Promise.resolve(true)) }));
vi.mock('@/lib/prompt-evolution/dispatch-resolve', () => ({
  STATIC_VARIANT_ID: 'static',
  composeTaskDispatch,
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

beforeEach(() => {
  useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null, maximizedTabId: null });
  useProjectStore.setState({
    projectPath: '/p', projectName: 'P', dynamicContext: null, isScanning: false, scanError: null,
  });
  composeTaskDispatch.mockClear();
  apiFetch.mockReset();
});

afterEach(cleanup);

describe('useModuleCLI execute during an in-flight scan', () => {
  it('composes the prompt with the context the running scan produces', async () => {
    apiFetch.mockImplementation(() => new Promise((res) => setTimeout(() => res({
      scannedAt: new Date().toISOString(), classes: [], plugins: [], buildDependencies: [], sourceFileCount: 7,
    }), 50)));
    const { result } = renderHook(() => useModuleCLI({ moduleId: MODULE, sessionKey: 'k', label: 'L', accentColor: 'x' }));
    // The setup scan is already running when the user clicks.
    void useProjectStore.getState().scanProject();
    expect(useProjectStore.getState().isScanning).toBe(true);
    await act(async () => {
      await result.current.execute(TaskFactory.featureReview(MODULE, 'Combat', [], 'http://x', 'Review'));
    });
    const ctx = composeTaskDispatch.mock.calls[0][1] as { dynamicContext: { sourceFileCount: number } | null };
    expect(ctx.dynamicContext?.sourceFileCount).toBe(7);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});
