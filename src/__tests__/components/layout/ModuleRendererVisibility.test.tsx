import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});

// Real component, stubbed registry. `evaluator` is a SPECIAL category (as in
// production — it owns the `game-design-doc` sub-module), so the dual-set state
// is reachable exactly as `navigateToModule('game-design-doc')` produces it.
//
// Each pane READS `SuspendContext` from inside its own subtree and writes it to
// the DOM, so the suspend assertions below observe what a module would actually
// receive — not merely that a prop was handed to a provider.
vi.mock('@/components/layout/ModuleRenderer/registry', async () => {
  const { useIsSuspended } = await import('@/hooks/useSuspend');
  const cache = new Map<string, React.ComponentType>();
  const paneFor = (id: string): React.ComponentType => {
    let C = cache.get(id);
    if (!C) {
      const Pane = () => {
        const suspended = useIsSuspended();
        return <div data-testid={`pane-${id}`} data-suspended={String(suspended)} />;
      };
      Pane.displayName = `Pane(${id})`;
      C = Pane;
      cache.set(id, C);
    }
    return C;
  };
  // `ghost-*` ids resolve to NO component — the shape a stale sub-module id
  // rehydrated from localStorage has after a build renamed or removed its view.
  return {
    MODULE_COMPONENTS: new Proxy({} as Record<string, React.ComponentType>, {
      get: (_t, k) =>
        typeof k === 'string' && !k.startsWith('ghost-') ? paneFor(k) : undefined,
      has: (_t, k) => typeof k === 'string' && !k.startsWith('ghost-'),
    }),
    SPECIAL_CATEGORIES: { evaluator: paneFor('evaluator') },
  };
});

vi.mock('@/components/cli/InlineTerminal', () => ({
  InlineTerminal: () => <div>terminal</div>,
}));

import { ModuleRenderer } from '@/components/layout/ModuleRenderer';
import { resolveVisibleModule } from '@/components/layout/ModuleRenderer/helpers';
import { useNavigationStore } from '@/stores/navigationStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';

/** Every mounted pane, by module id (mounting is the LRU's business, not visibility's). */
function mountedIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-testid^="pane-"]'))
    .map((el) => (el.dataset.testid ?? el.getAttribute('data-testid') ?? '').replace(/^pane-/, ''));
}

/**
 * The keep-alive shell that owns a pane — the nearest ancestor whose inline
 * `display` decides whether the user sees it. Found structurally (no test-only
 * attribute), so this observes the real toggle the component ships.
 */
function shellOf(container: HTMLElement, moduleId: string): HTMLElement | null {
  let node = container.querySelector<HTMLElement>(`[data-testid="pane-${moduleId}"]`)?.parentElement;
  while (node) {
    if (node.style.display === 'none' || node.style.display === 'block') return node;
    node = node.parentElement;
  }
  return null;
}

/** The ids of the panes actually shown to the user (display !== 'none'). */
function visibleIds(container: HTMLElement): string[] {
  return mountedIds(container).filter((id) => shellOf(container, id)?.style.display !== 'none');
}

/** `currentActiveId` as the renderer itself resolved it (drives the crossfade veil). */
function activeId(container: HTMLElement): string | null {
  const scroll = container.querySelector<HTMLElement>('[data-active-module]');
  return scroll?.dataset.activeModule || null;
}

/** What the subtree of a given pane READ out of SuspendContext. */
function suspendedIn(container: HTMLElement, moduleId: string): string | null {
  const el = container.querySelector<HTMLElement>(`[data-testid="pane-${moduleId}"]`);
  return el?.dataset.suspended ?? null;
}

describe('resolveVisibleModule states the visibility rule', () => {
  it('lets a set sub-module win over its owning special category', () => {
    // The dual-set state is only ever produced by a request for the SUB-MODULE:
    // `setActiveCategory` clears `activeSubModule`, and `navigateToModule(id)`
    // names the sub-module and merely derives its parent category.
    expect(resolveVisibleModule('evaluator', 'game-design-doc', true)).toBe('game-design-doc');
  });

  it('shows the special category when no sub-module is set', () => {
    expect(resolveVisibleModule('evaluator', null, true)).toBe('evaluator');
  });

  it('never shows a non-special category as a pane', () => {
    expect(resolveVisibleModule('content', null, false)).toBeNull();
    expect(resolveVisibleModule('content', 'materials', false)).toBe('materials');
    expect(resolveVisibleModule(null, null, false)).toBeNull();
  });
});

describe('ModuleRenderer shows exactly one pane in the dual-set state', () => {
  beforeEach(() => {
    useNavigationStore.setState({ activeCategory: null, activeSubModule: null });
    useCLIPanelStore.setState({ sessions: {}, maximizedTabId: null });
  });

  it('shows the sub-module, hides the category, and agrees with currentActiveId', () => {
    act(() => {
      useNavigationStore.setState({
        activeCategory: 'evaluator' as never,
        activeSubModule: 'game-design-doc' as never,
      });
    });
    const { container } = render(<ModuleRenderer />);

    // Both stay MOUNTED — that is the LRU's job and is unchanged.
    expect(mountedIds(container).sort()).toEqual(['evaluator', 'game-design-doc']);

    // …but only one is SHOWN, and it is the one the navigation asked for.
    expect(visibleIds(container)).toEqual(['game-design-doc']);
    expect(activeId(container)).toBe('game-design-doc');
  });

  it('suspends the hidden pane — the subtree really reads SuspendContext = true', () => {
    act(() => {
      useNavigationStore.setState({
        activeCategory: 'evaluator' as never,
        activeSubModule: 'game-design-doc' as never,
      });
    });
    const { container } = render(<ModuleRenderer />);

    expect(suspendedIn(container, 'evaluator')).toBe('true');
    expect(suspendedIn(container, 'game-design-doc')).toBe('false');
  });

  it('shows the special category when it owns no active sub-module', () => {
    act(() => {
      useNavigationStore.setState({ activeCategory: 'evaluator' as never, activeSubModule: null });
    });
    const { container } = render(<ModuleRenderer />);

    expect(visibleIds(container)).toEqual(['evaluator']);
    expect(activeId(container)).toBe('evaluator');
    expect(suspendedIn(container, 'evaluator')).toBe('false');
  });

  it('moves the crossfade target with the visible pane on category → sub-module', () => {
    const { container } = render(<ModuleRenderer />);
    act(() => {
      useNavigationStore.setState({ activeCategory: 'evaluator' as never, activeSubModule: null });
    });
    expect(activeId(container)).toBe('evaluator');

    // Selecting the category's sub-module changes what the user sees, so it must
    // change the veil target too — otherwise the animation covers the wrong pane.
    act(() => {
      useNavigationStore.setState({ activeSubModule: 'game-design-doc' as never });
    });
    expect(visibleIds(container)).toEqual(['game-design-doc']);
    expect(activeId(container)).toBe('game-design-doc');
    expect(suspendedIn(container, 'evaluator')).toBe('true');

    // …and back: leaving the sub-module returns the category pane, suspending the
    // sub-module that stays mounted behind it.
    act(() => {
      useNavigationStore.setState({ activeSubModule: null });
    });
    expect(visibleIds(container)).toEqual(['evaluator']);
    expect(activeId(container)).toBe('evaluator');
    expect(suspendedIn(container, 'game-design-doc')).toBe('true');
  });

  it('falls back to the category when the stored sub-module has no view', () => {
    // Navigation state is persisted, so a sub-module id from an older build can
    // rehydrate here. It must not win the rule and blank the canvas.
    act(() => {
      useNavigationStore.setState({
        activeCategory: 'evaluator' as never,
        activeSubModule: 'ghost-removed-module' as never,
      });
    });
    const { container } = render(<ModuleRenderer />);

    expect(visibleIds(container)).toEqual(['evaluator']);
    expect(activeId(container)).toBe('evaluator');
  });

  it('never shows two panes across a walk through every reachable state', () => {
    const { container } = render(<ModuleRenderer />);
    const states: Array<[string | null, string | null]> = [
      ['content', 'materials'],
      ['evaluator', null],
      ['evaluator', 'game-design-doc'],
      ['content', 'materials'],
      ['evaluator', 'game-design-doc'],
      ['evaluator', null],
    ];
    for (const [cat, sub] of states) {
      act(() => {
        useNavigationStore.setState({
          activeCategory: cat as never,
          activeSubModule: sub as never,
        });
      });
      const shown = visibleIds(container);
      expect(shown).toHaveLength(1);
      expect(shown[0]).toBe(activeId(container));
      for (const id of mountedIds(container)) {
        expect(suspendedIn(container, id)).toBe(String(id !== shown[0]));
      }
    }
  });
});
