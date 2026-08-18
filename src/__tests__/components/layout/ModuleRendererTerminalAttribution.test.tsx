import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});

// Real component, stubbed registry — TWO special categories, so the suite covers
// both the one the old hardcoded attribution list knew (`evaluator`) and one it
// did not (`game-director`). `ghost-*` ids resolve to no component, the shape a
// stale sub-module id rehydrated from localStorage has.
vi.mock('@/components/layout/ModuleRenderer/registry', () => {
  const cache = new Map<string, React.ComponentType>();
  const paneFor = (id: string): React.ComponentType => {
    let C = cache.get(id);
    if (!C) {
      const Pane = () => <div data-testid={`pane-${id}`} />;
      Pane.displayName = `Pane(${id})`;
      C = Pane;
      cache.set(id, C);
    }
    return C;
  };
  return {
    MODULE_COMPONENTS: new Proxy({} as Record<string, React.ComponentType>, {
      get: (_t, k) =>
        typeof k === 'string' && !k.startsWith('ghost-') ? paneFor(k) : undefined,
      has: (_t, k) => typeof k === 'string' && !k.startsWith('ghost-'),
    }),
    SPECIAL_CATEGORIES: {
      evaluator: paneFor('evaluator'),
      'game-director': paneFor('game-director'),
    },
  };
});

// The inline terminal reports the id it was mounted for and whether the renderer
// considers it visible — the observable form of "which module is this session
// attributed to".
vi.mock('@/components/cli/InlineTerminal', () => ({
  InlineTerminal: ({ sessionId, visible }: { sessionId: string; visible: boolean }) => (
    <div data-testid={`terminal-${sessionId}`} data-visible={String(visible)} />
  ),
}));

import { ModuleRenderer } from '@/components/layout/ModuleRenderer';
import { useActiveModuleId } from '@/hooks/useActiveModuleId';
import { useNavigationStore } from '@/stores/navigationStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import type { CLISessionState } from '@/components/cli/store/cliPanelStore';
import { MODULE_COLORS } from '@/lib/chart-colors';

/** Renders the attribution the hook yields, beside the renderer, in one tree. */
function AttributionProbe() {
  const id = useActiveModuleId();
  return <div data-testid="attribution" data-module-id={id ?? ''} />;
}

function Harness() {
  return (
    <>
      <ModuleRenderer />
      <AttributionProbe />
    </>
  );
}

/** `currentActiveId` as the renderer itself resolved it (the visible pane). */
function visiblePane(container: HTMLElement): string | null {
  const scroll = container.querySelector<HTMLElement>('[data-active-module]');
  return scroll?.getAttribute('data-active-module') || null;
}

/** The module the CLI session is attributed to, per `useActiveModuleId`. */
function attribution(container: HTMLElement): string | null {
  const el = container.querySelector<HTMLElement>('[data-testid="attribution"]');
  return el?.getAttribute('data-module-id') || null;
}

/** True when the inline terminal for `tabId` is mounted AND shown. */
function terminalShown(container: HTMLElement, tabId: string): boolean {
  const el = container.querySelector<HTMLElement>(`[data-testid="terminal-${tabId}"]`);
  return el?.getAttribute('data-visible') === 'true';
}

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
  useCLIPanelStore.setState({
    sessions: { [tabId]: session },
    tabOrder: [tabId],
    maximizedTabId: tabId,
  });
}

function navigate(cat: string | null, sub: string | null) {
  act(() => {
    useNavigationStore.setState({
      activeCategory: cat as never,
      activeSubModule: sub as never,
    });
  });
}

describe('the maximized terminal is attributed to the pane the user SEES', () => {
  beforeEach(() => {
    useNavigationStore.setState({ activeCategory: null, activeSubModule: null });
    useCLIPanelStore.setState({ sessions: {}, tabOrder: [], maximizedTabId: null });
  });

  it('shows a terminal maximized for the visible sub-module in the dual-set state', () => {
    // The split brain this closes: the pane on screen is `game-design-doc`, but
    // attribution asked whether the session belonged to `evaluator`, so this
    // terminal stayed hidden — mounted for nothing, invisible to its own module.
    seedSession('tab-gdd', 'game-design-doc');
    navigate('evaluator', 'game-design-doc');
    const { container } = render(<Harness />);

    expect(visiblePane(container)).toBe('game-design-doc');
    expect(attribution(container)).toBe('game-design-doc');
    expect(terminalShown(container, 'tab-gdd')).toBe(true);
  });

  it('does NOT show a terminal owned by the covered category', () => {
    // The other half of the same lie: an `evaluator` session used to be shown
    // inline while the user was looking at `game-design-doc`.
    seedSession('tab-eval', 'evaluator');
    navigate('evaluator', 'game-design-doc');
    const { container } = render(<Harness />);

    expect(visiblePane(container)).toBe('game-design-doc');
    expect(terminalShown(container, 'tab-eval')).toBe(false);
  });

  it('shows a terminal for a special category the old hardcoded list omitted', () => {
    // game-director is special in the registry but was missing from
    // `'project-setup' || 'evaluator'`, so attribution fell through to
    // `activeSubModule` — null here — and the terminal never appeared.
    seedSession('tab-gd', 'game-director');
    navigate('game-director', null);
    const { container } = render(<Harness />);

    expect(visiblePane(container)).toBe('game-director');
    expect(attribution(container)).toBe('game-director');
    expect(terminalShown(container, 'tab-gd')).toBe(true);
  });

  it('follows the pane as navigation moves between category and sub-module', () => {
    seedSession('tab-gdd', 'game-design-doc');
    const { container } = render(<Harness />);

    navigate('evaluator', null);
    expect(terminalShown(container, 'tab-gdd')).toBe(false);

    navigate('evaluator', 'game-design-doc');
    expect(terminalShown(container, 'tab-gdd')).toBe(true);

    // Leaving the sub-module hides it again — the pane it belongs to is covered.
    navigate('evaluator', null);
    expect(terminalShown(container, 'tab-gdd')).toBe(false);
  });

  it('attributes to the category when the stored sub-module has no view', () => {
    seedSession('tab-eval', 'evaluator');
    navigate('evaluator', 'ghost-removed-module');
    const { container } = render(<Harness />);

    expect(visiblePane(container)).toBe('evaluator');
    expect(terminalShown(container, 'tab-eval')).toBe(true);
  });

  it('agrees with the visible pane across a walk of every reachable state', () => {
    // The non-tautological parity guard: `data-active-module` is computed inside
    // index.tsx from `resolveVisibleModule`, the probe from the hook. Two
    // derivations, asserted equal — so they cannot drift apart again silently.
    const { container } = render(<Harness />);
    const states: Array<[string | null, string | null]> = [
      ['content', 'materials'],
      ['evaluator', null],
      ['evaluator', 'game-design-doc'],
      ['game-director', null],
      ['content', null],
      ['evaluator', 'ghost-removed-module'],
      ['project-setup', null],
      [null, null],
    ];
    for (const [cat, sub] of states) {
      navigate(cat, sub);
      expect(attribution(container)).toBe(visiblePane(container));
    }
  });
});
