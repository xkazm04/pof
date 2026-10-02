import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// The shell gate is what is under test, not the shells: the lab is a stub, the legacy shell is
// the REAL AppShell with its children and side-effect hooks stubbed (so its own listeners count).
vi.mock('@/components/layout-lab/NewHome', () => ({ NewHome: () => <div data-testid="ecw-shell">ecw</div> }));
vi.mock('@/components/layout/TopBar', () => ({ TopBar: () => null }));
vi.mock('@/components/layout/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('@/components/layout/ModuleRenderer', () => ({ ModuleRenderer: () => null }));
vi.mock('@/components/layout/CLIBottomPanel', () => ({ CLIBottomPanel: () => null }));
vi.mock('@/components/layout/ActivityFeedPanel', () => ({ ActivityFeedPanel: () => null }));
vi.mock('@/components/layout/GlobalSearchPanel', () => ({ GlobalSearchPanel: () => null }));
vi.mock('@/components/layout/EventBusDevTools', () => ({ EventBusDevTools: () => null }));
vi.mock('@/components/layout/ShellSkeleton', () => ({ ShellSkeleton: () => null }));
vi.mock('@/components/cli/PreflightGuardDialog', () => ({ PreflightGuardDialog: () => null }));
vi.mock('@/components/modules/project-setup/SetupWizard', () => ({ SetupWizard: () => null }));
vi.mock('@/hooks/useActivityFeedBridge', () => ({ useActivityFeedBridge: () => {} }));
vi.mock('@/hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: () => {} }));
vi.mock('@/hooks/useFileWatcher', () => ({ useFileWatcher: () => {} }));
vi.mock('@/hooks/useDynamicTitle', () => ({ useDynamicTitle: () => {} }));
vi.mock('@/hooks/usePofBridge', () => ({ usePofBridge: () => {} }));
vi.mock('@/hooks/useShellRouteSync', () => ({ useShellRouteSync: () => {} }));

import Home from '@/app/page';
import { requestShellSwitch } from '@/hooks/useLeaveGuard';
import { addPaneHold } from '@/hooks/usePaneHold';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';

function dispatchBeforeUnload(): Event {
  const ev = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(ev);
  return ev;
}

const releases: Array<() => void> = [];

afterEach(() => {
  cleanup();
  while (releases.length) releases.pop()!();
  useOneShotJobStore.setState({ phase: 'idle' });
  useCLIPanelStore.setState({ sessions: {} });
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks();
});

describe('useLeaveGuard — one root guard above the shell gate', () => {
  it('the DEFAULT (lab) shell guards unload while a one-shot run is in flight', () => {
    window.history.replaceState({}, '', '/');
    const { getByTestId } = render(<Home />);
    expect(getByTestId('ecw-shell')).toBeTruthy();
    useOneShotJobStore.setState({ phase: 'running' });
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
  });

  it('[guard] nothing in flight -> no prompt; the legacy shell registers exactly ONE beforeunload listener', () => {
    const add = vi.spyOn(window, 'addEventListener');
    window.history.replaceState({}, '', '/?legacy=1');
    render(<Home />);
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
    const unloadListeners = add.mock.calls.filter(([type]) => type === 'beforeunload');
    expect(unloadListeners).toHaveLength(1);
  });

  it('[guard] a running CLI session still prompts (now in both shells)', () => {
    render(<Home />);
    useCLIPanelStore.setState({ sessions: { t1: { isRunning: true, label: 'Terminal 1' } as never } });
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
  });
});

describe('requestShellSwitch — a shell flip names what it would tear down', () => {
  it('a held cook asks first; declining leaves the shell, the preference and history untouched', () => {
    releases.push(addPaneHold('packaging', 'UE cook running'));
    localStorage.setItem('pof.shell', 'legacy');
    window.history.replaceState({}, '', '/?legacy=1');
    const push = vi.spyOn(window.history, 'pushState');
    const confirm = vi.fn(() => false);

    expect(requestShellSwitch('ecw', { confirm })).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(String((confirm.mock.calls[0] as unknown[])[0])).toContain('UE cook running');
    expect(localStorage.getItem('pof.shell')).toBe('legacy');
    expect(push).not.toHaveBeenCalled();
  });

  it('accepting the prompt switches exactly as switchShell does', () => {
    releases.push(addPaneHold('packaging', 'UE cook running'));
    localStorage.setItem('pof.shell', 'legacy');
    window.history.replaceState({}, '', '/?legacy=1');
    const push = vi.spyOn(window.history, 'pushState');
    const popstate = vi.fn();
    window.addEventListener('popstate', popstate);

    expect(requestShellSwitch('ecw', { confirm: () => true })).toBe(true);
    expect(localStorage.getItem('pof.shell')).toBe('ecw');
    expect(push).toHaveBeenCalledTimes(1);
    expect(new URLSearchParams(window.location.search).get('legacy')).toBe('0');
    expect(popstate).toHaveBeenCalledTimes(1);
    window.removeEventListener('popstate', popstate);
  });

  it('[guard] with no risk it never asks and flips', () => {
    const confirm = vi.fn(() => false);
    expect(requestShellSwitch('legacy', { confirm })).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(localStorage.getItem('pof.shell')).toBe('legacy');
  });
});
