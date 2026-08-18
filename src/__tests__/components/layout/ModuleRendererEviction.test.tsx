import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Deterministic reduced-motion + avoid jsdom matchMedia gaps.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});

// Keep the component under test real; stub only the heavy lazy module registry so
// the LRU/eviction logic in index.tsx is what is exercised.
vi.mock('@/components/layout/ModuleRenderer/registry', () => {
  const Stub = () => <div>module</div>;
  return {
    MODULE_COMPONENTS: new Proxy({} as Record<string, React.ComponentType>, {
      get: () => Stub,
      has: () => true,
    }),
    SPECIAL_CATEGORIES: {},
  };
});

vi.mock('@/components/cli/InlineTerminal', () => ({
  InlineTerminal: () => <div>terminal</div>,
}));

import { ModuleRenderer } from '@/components/layout/ModuleRenderer';
import { lruTouched, describeEviction } from '@/components/layout/ModuleRenderer/helpers';
import { useNavigationStore } from '@/stores/navigationStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { eventBus } from '@/lib/event-bus';
import type { BusEvent } from '@/types/event-bus';

const MODULES = [
  'arpg-character',
  'arpg-animation',
  'arpg-gas',
  'arpg-combat',
  'arpg-enemy-ai',
  'arpg-inventory',
] as const;

describe('lruTouched reports what an eviction costs', () => {
  it('is pure — the input list is never mutated', () => {
    const list = ['a', 'b'];
    const touch = lruTouched(list, 'c', 5);
    expect(list).toEqual(['a', 'b']);
    expect(touch?.next).toEqual(['c', 'a', 'b']);
  });

  it('returns null (no work) when the id is already MRU', () => {
    expect(lruTouched(['a', 'b'], 'a', 5)).toBeNull();
  });

  it('names the evicted tail exactly when the cap is exceeded, and null otherwise', () => {
    const under = lruTouched(['d', 'c', 'b', 'a'], 'e', 5);
    expect(under?.evicted).toBeNull();
    expect(under?.next).toHaveLength(5);

    const over = lruTouched(['e', 'd', 'c', 'b', 'a'], 'f', 5);
    expect(over?.evicted).toBe('a'); // least-recently-used tail
    expect(over?.next).toEqual(['f', 'e', 'd', 'c', 'b']);
  });
});

describe('describeEviction does not guess about live work', () => {
  it('flags a running CLI session attributable to the evicted module', () => {
    const signal = describeEviction('arpg-combat', 'module', 5, {
      t1: { moduleId: 'arpg-combat', isRunning: true },
    });
    expect(signal.liveWork).toBe('cli-session-running');
    expect(signal.evictedId).toBe('arpg-combat');
  });

  it('reports none-observed when no attributable session is running', () => {
    expect(
      describeEviction('arpg-combat', 'module', 5, {
        t1: { moduleId: 'arpg-combat', isRunning: false },
        t2: { moduleId: 'arpg-loot', isRunning: true },
      }).liveWork,
    ).toBe('none-observed');
  });

  it('matches a session eviction on the session id, not the module id', () => {
    const sessions = { t1: { moduleId: 'arpg-combat', isRunning: true } };
    expect(describeEviction('t1', 'session', 5, sessions).liveWork).toBe('cli-session-running');
    expect(describeEviction('t9', 'session', 5, sessions).liveWork).toBe('none-observed');
  });
});

describe('ModuleRenderer emits an observable signal on LRU eviction', () => {
  let events: BusEvent<'nav.module.evicted'>[] = [];
  let unsub: () => void;

  beforeEach(() => {
    events = [];
    unsub = eventBus.on('nav.module.evicted', (e) => events.push(e));
    useNavigationStore.setState({ activeCategory: 'core-engine', activeSubModule: null });
    useCLIPanelStore.setState({ sessions: {}, maximizedTabId: null });
  });

  afterEach(() => unsub());

  const visit = (id: string) =>
    act(() => {
      useNavigationStore.setState({ activeSubModule: id as never });
    });

  it('stays silent while under the cap, then names the evicted module id', () => {
    render(<ModuleRenderer />);

    // Five modules fit in the LRU (LRU_CAP = 5) — nothing is torn down.
    for (const id of MODULES.slice(0, 5)) visit(id);
    expect(events).toHaveLength(0);

    // The sixth navigation unmounts the least-recently-used pane.
    visit(MODULES[5]);
    expect(events).toHaveLength(1);
    expect(events[0].payload.evictedId).toBe('arpg-character');
    expect(events[0].payload.label).toBeTruthy();
    expect(events[0].payload.scope).toBe('module');
    expect(events[0].payload.cap).toBe(5);
    expect(events[0].payload.liveWork).toBe('none-observed');
  });

  it('distinguishes an eviction that tore down a running CLI session', () => {
    useCLIPanelStore.setState({
      sessions: {
        t1: {
          id: 't1',
          label: 'combat',
          moduleId: 'arpg-character',
          isRunning: true,
        } as never,
      },
    });
    render(<ModuleRenderer />);

    for (const id of MODULES) visit(id);

    expect(events).toHaveLength(1);
    expect(events[0].payload.evictedId).toBe('arpg-character');
    expect(events[0].payload.liveWork).toBe('cli-session-running');
  });
});
