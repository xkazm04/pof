/**
 * useModuleActions spend attribution (scan-sweep night 2026-11-08).
 *
 * sendPromptToModule reuses ANY session of the module (findSessionByModule) — often
 * a useModuleCLI tab whose lastTaskType is the previous dispatch's ('feature-review').
 * The terminal attributes a run's spend from lastTaskType at dispatch time
 * (CompactTerminal resolveAttribution), so an Activity-feed / search prompt was
 * billed as that earlier task type. The dispatch must stamp its own type.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

vi.mock('@/lib/cli-dispatch', () => ({ dispatchPromptWhenReady: vi.fn() }));

import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useModuleActions } from '@/hooks/useModuleActions';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-combat' as SubModuleId;

beforeEach(() => {
  useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null, maximizedTabId: null });
});
afterEach(cleanup);

describe('useModuleActions — spend attribution', () => {
  it('stamps the reused session as an interactive dispatch, not the previous task type', () => {
    const store = useCLIPanelStore.getState();
    const tabId = store.createSession({ sessionKey: 'arpg-combat-rv-review', moduleId: MODULE, label: 'Combat Review' });
    store.setSessionTaskMeta(tabId, 'feature-review', 'Combat Review');

    const { result } = renderHook(() => useModuleActions());
    act(() => result.current.sendPromptToModule(MODULE, 'fix the dodge window'));

    const sess = useCLIPanelStore.getState().sessions[tabId];
    expect(sess.lastTaskType).toBe('interactive');
  });

  it('stamps a freshly created session too', () => {
    const { result } = renderHook(() => useModuleActions());
    act(() => result.current.sendPromptToModule(MODULE, 'hello'));
    const sess = Object.values(useCLIPanelStore.getState().sessions)[0];
    expect(sess.lastTaskType).toBe('interactive');
  });
});
