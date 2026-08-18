import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, act, cleanup, fireEvent } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// NO registry mock — the real `SPECIAL_CATEGORIES` / `MODULE_COMPONENTS` decide
// attribution here, so this suite exercises the production evaluator ⇄
// game-design-doc pair rather than a stub of it.
import { CLIBottomPanel } from '@/components/layout/CLIBottomPanel';
import { useNavigationStore } from '@/stores/navigationStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import type { CLISessionState } from '@/components/cli/store/cliPanelStore';
import { MODULE_COLORS } from '@/lib/chart-colors';

function seedSession(tabId: string, moduleId: string) {
  const session = {
    id: tabId,
    label: tabId,
    projectPath: null,
    claudeSessionId: null,
    currentExecutionId: null,
    currentTaskId: null,
    isRunning: false,
    lastTaskSuccess: null,
    accentColor: MODULE_COLORS.core,
    moduleId,
    createdAt: 0,
    lastActivityAt: 0,
    enabledSkills: [],
  } satisfies CLISessionState;
  act(() => {
    useCLIPanelStore.setState({
      sessions: { [tabId]: session },
      tabOrder: [tabId],
      maximizedTabId: tabId,
      activeTabId: tabId,
    });
  });
}

function clickTab(container: HTMLElement, tabId: string) {
  const btn = container.querySelector<HTMLElement>(`[data-testid="pof-cli-panel-tab-${tabId}"]`);
  if (!btn) throw new Error(`tab ${tabId} not rendered`);
  act(() => {
    fireEvent.click(btn);
  });
}

describe('CLIBottomPanel judges "already viewing this session\'s module" by what is on screen', () => {
  beforeEach(() => {
    act(() => {
      useNavigationStore.setState({ activeCategory: null, activeSubModule: null });
      useCLIPanelStore.setState({
        sessions: {},
        tabOrder: [],
        maximizedTabId: null,
        activeTabId: null,
      });
    });
  });

  it('minimizes when the maximized tab belongs to the visible sub-module', () => {
    // `navigateToModule('game-design-doc')` leaves BOTH category `evaluator` and
    // sub-module `game-design-doc` set; the pane on screen is the sub-module.
    // Attribution used to answer `evaluator`, so this click re-maximized and
    // re-navigated instead of toggling the terminal away.
    seedSession('tab-gdd', 'game-design-doc');
    act(() => {
      useNavigationStore.getState().navigateToModule('game-design-doc');
    });
    const { container } = render(<CLIBottomPanel />);

    clickTab(container, 'tab-gdd');

    expect(useCLIPanelStore.getState().maximizedTabId).toBeNull();
  });

  it('minimizes for a special category the old hardcoded list omitted', () => {
    // game-director is a special category in the registry; attribution used to
    // return null for it, so its own terminal could never be toggled off.
    seedSession('tab-gd', 'game-director');
    act(() => {
      useNavigationStore.getState().navigateToModule('game-director');
    });
    const { container } = render(<CLIBottomPanel />);

    clickTab(container, 'tab-gd');

    expect(useCLIPanelStore.getState().maximizedTabId).toBeNull();
  });

  it('navigates to the session\'s module when the user is looking elsewhere', () => {
    // Unchanged behaviour, asserted so the fix cannot have swapped the branches.
    seedSession('tab-gdd', 'game-design-doc');
    act(() => {
      useNavigationStore.getState().navigateToModule('materials');
    });
    const { container } = render(<CLIBottomPanel />);

    clickTab(container, 'tab-gdd');

    expect(useCLIPanelStore.getState().maximizedTabId).toBe('tab-gdd');
    const nav = useNavigationStore.getState();
    expect([nav.activeCategory, nav.activeSubModule]).toEqual(['evaluator', 'game-design-doc']);
  });

  it('does not minimize a session that belongs to the covered category', () => {
    // The inverse: an `evaluator` session while `game-design-doc` is on screen is
    // NOT "the module you are viewing" — clicking it must navigate there.
    seedSession('tab-eval', 'evaluator');
    act(() => {
      useNavigationStore.getState().navigateToModule('game-design-doc');
    });
    const { container } = render(<CLIBottomPanel />);

    clickTab(container, 'tab-eval');

    expect(useCLIPanelStore.getState().maximizedTabId).toBe('tab-eval');
    const nav = useNavigationStore.getState();
    expect([nav.activeCategory, nav.activeSubModule]).toEqual(['evaluator', null]);
  });
});
