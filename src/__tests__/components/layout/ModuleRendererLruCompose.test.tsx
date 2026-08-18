import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, act, cleanup, screen } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});

// Real component, stubbed registry: every sub-module id resolves to a pane that
// names itself, and `evaluator` is a SPECIAL category (as it is in production —
// it owns the `game-design-doc` sub-module, so both can be active at once).
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
      get: (_t, k) => (typeof k === 'string' ? paneFor(k) : undefined),
      has: () => true,
    }),
    SPECIAL_CATEGORIES: { evaluator: paneFor('evaluator') },
  };
});

vi.mock('@/components/cli/InlineTerminal', () => ({
  InlineTerminal: () => <div>terminal</div>,
}));

import { ModuleRenderer } from '@/components/layout/ModuleRenderer';
import { lruTouchedAll } from '@/components/layout/ModuleRenderer/helpers';
import { useNavigationStore } from '@/stores/navigationStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { eventBus } from '@/lib/event-bus';
import type { BusEvent } from '@/types/event-bus';

describe('lruTouchedAll folds several touches through ONE list', () => {
  it('keeps every touched id — the last one ends up MRU', () => {
    const list: string[] = [];
    const touch = lruTouchedAll(list, ['game-design-doc', 'evaluator'], 5);
    expect(touch?.next).toEqual(['evaluator', 'game-design-doc']);
    expect(list).toEqual([]); // pure — input untouched
  });

  it('returns null when the fold leaves the list unchanged BY CONTENT', () => {
    // Both ids already present in this exact order: touch 1 pulls the sub-module
    // to the front, touch 2 pulls the category back. An identity-only check would
    // set state on every render and never converge.
    expect(lruTouchedAll(['evaluator', 'game-design-doc', 'x'], ['game-design-doc', 'evaluator'], 5))
      .toBeNull();
    expect(lruTouchedAll(['a', 'b'], [], 5)).toBeNull();
    expect(lruTouchedAll(['a', 'b'], ['a'], 5)).toBeNull();
  });

  it('collects every id that genuinely fell off the tail, in eviction order', () => {
    const touch = lruTouchedAll(['e', 'd', 'c', 'b', 'a'], ['f', 'g'], 5);
    expect(touch?.next).toEqual(['g', 'f', 'e', 'd', 'c']);
    expect(touch?.evicted).toEqual(['a', 'b']);
  });

  it('does not report an id that a later touch put back — it is still mounted', () => {
    // 'a' is pushed off by the 'f' touch, then re-touched — it is back in the final
    // list, so calling it evicted would be a phantom teardown signal. 'b' is the id
    // that actually left.
    const touch = lruTouchedAll(['e', 'd', 'c', 'b', 'a'], ['f', 'a'], 5);
    expect(touch?.next).toEqual(['a', 'f', 'e', 'd', 'c']);
    expect(touch?.evicted).toEqual(['b']);
  });
});

describe('ModuleRenderer keeps both touches when a sub-module and a special category are active', () => {
  let events: BusEvent<'nav.module.evicted'>[] = [];
  let unsub: () => void;

  beforeEach(() => {
    events = [];
    unsub = eventBus.on('nav.module.evicted', (e) => events.push(e));
    useNavigationStore.setState({ activeCategory: null, activeSubModule: null });
    useCLIPanelStore.setState({ sessions: {}, maximizedTabId: null });
  });

  afterEach(() => unsub());

  it('mounts BOTH ids — neither touch overwrites the other', () => {
    // Reachable in production: navigateToModule('game-design-doc') resolves the
    // parent category 'evaluator', which is itself a special category.
    act(() => {
      useNavigationStore.setState({
        activeCategory: 'evaluator' as never,
        activeSubModule: 'game-design-doc' as never,
      });
    });
    render(<ModuleRenderer />);

    expect(screen.queryByTestId('pane-game-design-doc')).not.toBeNull();
    expect(screen.queryByTestId('pane-evaluator')).not.toBeNull();
  });

  it('survives repeated renders with both set (the fold converges)', () => {
    act(() => {
      useNavigationStore.setState({
        activeCategory: 'evaluator' as never,
        activeSubModule: 'game-design-doc' as never,
      });
    });
    const { rerender } = render(<ModuleRenderer />);
    for (let i = 0; i < 3; i++) rerender(<ModuleRenderer />);

    expect(screen.queryByTestId('pane-game-design-doc')).not.toBeNull();
    expect(screen.queryByTestId('pane-evaluator')).not.toBeNull();
    expect(events).toHaveLength(0); // never exceeded the cap
  });

  it('reports each eviction exactly once when one pass evicts twice', () => {
    render(<ModuleRenderer />);

    // Fill the LRU to LRU_CAP = 5 one sub-module at a time.
    const filler = ['arpg-character', 'arpg-animation', 'arpg-gas', 'arpg-combat', 'arpg-enemy-ai'];
    for (const id of filler) {
      act(() => {
        useNavigationStore.setState({ activeCategory: null, activeSubModule: id as never });
      });
    }
    expect(events).toHaveLength(0);

    // One navigation, TWO touches: both push an id off the tail.
    act(() => {
      useNavigationStore.setState({
        activeCategory: 'evaluator' as never,
        activeSubModule: 'game-design-doc' as never,
      });
    });

    const evicted = events.map((e) => e.payload.evictedId);
    expect(evicted).toEqual(['arpg-character', 'arpg-animation']);
    expect(new Set(evicted).size).toBe(evicted.length); // no double-report
    expect(events.every((e) => e.payload.scope === 'module' && e.payload.cap === 5)).toBe(true);

    // …and both newly-visited ids are mounted, which is the whole point.
    expect(screen.queryByTestId('pane-game-design-doc')).not.toBeNull();
    expect(screen.queryByTestId('pane-evaluator')).not.toBeNull();
  });
});
