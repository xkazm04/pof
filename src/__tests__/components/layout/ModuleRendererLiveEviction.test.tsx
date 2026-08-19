import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, act, cleanup, renderHook } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});

// Each stub NAMES its module in the DOM (and is cached, so identity is stable
// across renders) — that is what lets a test prove a pane is still MOUNTED rather
// than merely un-named in the eviction report.
vi.mock('@/components/layout/ModuleRenderer/registry', () => {
  const stubs = new Map<string, React.ComponentType>();
  return {
    MODULE_COMPONENTS: new Proxy({} as Record<string, React.ComponentType>, {
      get: (_t, key: string) => {
        if (!stubs.has(key)) stubs.set(key, () => <div data-module={key}>module</div>);
        return stubs.get(key)!;
      },
      has: () => true,
    }),
    SPECIAL_CATEGORIES: {},
  };
});

vi.mock('@/components/cli/InlineTerminal', () => ({
  InlineTerminal: () => <div>terminal</div>,
}));

import { ModuleRenderer } from '@/components/layout/ModuleRenderer';
import {
  lruTouched,
  lruTouchedAll,
  observedLiveKey,
  observedLiveProbe,
  tearsDownObservedWork,
  describeEviction,
} from '@/components/layout/ModuleRenderer/helpers';
import { useNavigationStore } from '@/stores/navigationStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import { useActivityFeedBridge } from '@/hooks/useActivityFeedBridge';
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

/** A running CLI session attributed to `moduleId`, shaped as the store holds it. */
const runningSession = (id: string, moduleId: string) =>
  ({ id, label: moduleId, moduleId, isRunning: true }) as never;

// ── The decision: liveness is an INPUT, not an epitaph ──

describe('lruTouched prefers a victim with no observed live work', () => {
  it('skips the live tail and evicts the next least-recently-used id instead', () => {
    // MRU-first; 'a' is the tail and is live.
    const touch = lruTouched(['e', 'd', 'c', 'b', 'a'], 'f', 5, (id) => id === 'a');
    expect(touch?.evicted).toBe('b');
    expect(touch?.next).toContain('a'); // the live pane survives
    expect(touch?.basis).toBe('no-observed-live-work');
  });

  it('still evicts (bounded memory) when EVERY candidate is live, and says it was forced', () => {
    const touch = lruTouched(['e', 'd', 'c', 'b', 'a'], 'f', 5, () => true);
    expect(touch?.evicted).toBe('a'); // classic tail — nothing better exists
    expect(touch?.next).toHaveLength(5);
    expect(touch?.basis).toBe('forced-over-live-work');
  });

  it('never evicts the just-touched head, even when it is the only non-live id', () => {
    const touch = lruTouched(['e', 'd', 'c', 'b', 'a'], 'f', 5, (id) => id !== 'f');
    expect(touch?.evicted).toBe('a');
    expect(touch?.next[0]).toBe('f');
    expect(touch?.basis).toBe('forced-over-live-work');
  });

  it('reports `unprobed` — never a clean bill of health — when no probe is given', () => {
    const touch = lruTouched(['e', 'd', 'c', 'b', 'a'], 'f', 5);
    expect(touch?.evicted).toBe('a');
    expect(touch?.basis).toBe('unprobed');
  });

  it('is still pure and still a no-op when the id is already MRU', () => {
    const list = ['a', 'b'];
    expect(lruTouched(list, 'a', 5, () => true)).toBeNull();
    expect(lruTouched(list, 'c', 5, () => true)?.next).toEqual(['c', 'a', 'b']);
    expect(list).toEqual(['a', 'b']);
  });
});

describe('lruTouchedAll folds the probe through every touch', () => {
  it('protects a live id across a multi-touch pass and lists what was forced', () => {
    const fold = lruTouchedAll(['e', 'd', 'c', 'b', 'a'], ['f', 'g'], 5, (id) => id === 'a');
    expect(fold?.next).toContain('a');
    expect(fold?.evicted).toEqual(['b', 'c']);
    expect(fold?.forced).toEqual([]);
  });

  it('marks forced evictions when nothing idle is left', () => {
    const fold = lruTouchedAll(['e', 'd', 'c', 'b', 'a'], ['f'], 5, () => true);
    expect(fold?.evicted).toEqual(['a']);
    expect(fold?.forced).toEqual(['a']);
  });
});

// ── The observation: positive evidence only ──

describe('observedLiveKey / observedLiveProbe report only what was observed', () => {
  it('flags both the running session id and the module it is attributed to', () => {
    const key = observedLiveKey({
      t1: { moduleId: 'arpg-combat', isRunning: true },
      t2: { moduleId: 'arpg-loot', isRunning: false },
    });
    expect(observedLiveProbe(key, 'module')('arpg-combat')).toBe(true);
    expect(observedLiveProbe(key, 'session')('t1')).toBe(true);
    // Idle session and its module: NOT flagged.
    expect(observedLiveProbe(key, 'module')('arpg-loot')).toBe(false);
    expect(observedLiveProbe(key, 'session')('t2')).toBe(false);
  });

  it('does not cross scopes — a session id is not a module id', () => {
    const key = observedLiveKey({ t1: { moduleId: 'arpg-combat', isRunning: true } });
    expect(observedLiveProbe(key, 'module')('t1')).toBe(false);
    expect(observedLiveProbe(key, 'session')('arpg-combat')).toBe(false);
  });

  it('is order-stable, so a re-render cannot churn the subscription', () => {
    const a = observedLiveKey({ t1: { moduleId: 'm1', isRunning: true }, t2: { moduleId: 'm2', isRunning: true } });
    const b = observedLiveKey({ t2: { moduleId: 'm2', isRunning: true }, t1: { moduleId: 'm1', isRunning: true } });
    expect(a).toBe(b);
  });

  it('flags a running session with no module attribution for its session scope only', () => {
    const key = observedLiveKey({ t1: { isRunning: true } });
    expect(observedLiveProbe(key, 'session')('t1')).toBe(true);
    expect(key.includes('m:')).toBe(false);
  });

  it('an empty observation flags nothing rather than everything', () => {
    const probe = observedLiveProbe(observedLiveKey({}), 'module');
    expect(probe('arpg-combat')).toBe(false);
  });
});

// ── The report: observed loss is loud, silence is never a safety claim ──

describe('tearsDownObservedWork', () => {
  const base = { evictedId: 'x', label: 'X', scope: 'module' as const, cap: 5 };

  it('is true when the LRU was forced over live work', () => {
    expect(
      tearsDownObservedWork({ ...base, liveWork: 'none-observed', basis: 'forced-over-live-work' }),
    ).toBe(true);
  });

  it('is true when a session was running at report time even if the probe missed it', () => {
    expect(
      tearsDownObservedWork({ ...base, liveWork: 'cli-session-running', basis: 'no-observed-live-work' }),
    ).toBe(true);
  });

  it('is false only for the un-flagged case — which is "nothing observed", not "nothing lost"', () => {
    expect(
      tearsDownObservedWork({ ...base, liveWork: 'none-observed', basis: 'no-observed-live-work' }),
    ).toBe(false);
  });
});

describe('describeEviction carries the decision basis alongside the observation', () => {
  it('keeps liveWork and basis independent', () => {
    const signal = describeEviction('arpg-combat', 'module', 5, {}, 'forced-over-live-work');
    expect(signal.liveWork).toBe('none-observed');
    expect(signal.basis).toBe('forced-over-live-work');
  });

  it('defaults to `unprobed` rather than inventing a clean decision', () => {
    expect(describeEviction('arpg-combat', 'module', 5, {}).basis).toBe('unprobed');
  });
});

// ── End to end through the real shell ──

describe('ModuleRenderer does not evict a module with a running CLI session', () => {
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

  it('keeps the live least-recently-used pane mounted and evicts the next one instead', () => {
    useCLIPanelStore.setState({
      sessions: { t1: runningSession('t1', 'arpg-character') },
    });
    const { container } = render(<ModuleRenderer />);

    for (const id of MODULES) visit(id);

    // The tail WAS 'arpg-character' and it was running paid work — it survives.
    expect(events).toHaveLength(1);
    expect(events[0].payload.evictedId).toBe('arpg-animation');
    expect(events[0].payload.basis).toBe('no-observed-live-work');
    expect(events[0].payload.liveWork).toBe('none-observed');

    // Mounted, not merely "reported": the live pane is still in the DOM and the
    // one named in the report is gone.
    expect(container.querySelector('[data-module="arpg-character"]')).not.toBeNull();
    expect(container.querySelector('[data-module="arpg-animation"]')).toBeNull();
    expect(container.querySelectorAll('[data-module]')).toHaveLength(5);
  });

  it('still evicts when every mounted pane is live, and marks it forced', () => {
    useCLIPanelStore.setState({
      sessions: Object.fromEntries(
        MODULES.map((m, i) => [`t${i}`, runningSession(`t${i}`, m)]),
      ),
    });
    render(<ModuleRenderer />);

    for (const id of MODULES) visit(id);

    expect(events).toHaveLength(1);
    expect(events[0].payload.evictedId).toBe('arpg-character'); // the cap still holds
    expect(events[0].payload.basis).toBe('forced-over-live-work');
    expect(events[0].payload.liveWork).toBe('cli-session-running');
  });
});

// ── The channel has a registered consumer ──

describe('nav.module.evicted reaches a user-visible surface', () => {
  beforeEach(() => {
    useActivityFeedStore.setState({ events: [] });
  });

  it('has at least one registered consumer once the shell bridge is mounted', () => {
    // Before: the shell emitted onto a channel nothing in src/ subscribed to.
    const before = eventBus.activeChannels.includes('nav.module.evicted');
    const { unmount } = renderHook(() => useActivityFeedBridge());
    expect(eventBus.activeChannels).toContain('nav.module.evicted');
    unmount();
    expect(before).toBe(eventBus.activeChannels.includes('nav.module.evicted'));
  });

  it('publishes a forced eviction into the activity feed, naming what was torn down', () => {
    const { unmount } = renderHook(() => useActivityFeedBridge());

    act(() => {
      eventBus.emit(
        'nav.module.evicted',
        {
          evictedId: 'arpg-combat',
          label: 'Combat',
          scope: 'module',
          cap: 5,
          liveWork: 'cli-session-running',
          basis: 'forced-over-live-work',
        },
        'test',
      );
    });

    const feed = useActivityFeedStore.getState().events;
    expect(feed).toHaveLength(1);
    expect(feed[0].type).toBe('shell-eviction');
    expect(feed[0].title).toContain('Combat');
    expect(feed[0].moduleId).toBe('arpg-combat');
    expect(feed[0].dismissed).toBe(false);
    // The honesty carried through to the copy the user reads.
    expect(feed[0].description).toContain('invisible to the shell');
    unmount();
  });

  it('does not flood the feed with routine evictions that observed nothing', () => {
    const { unmount } = renderHook(() => useActivityFeedBridge());

    act(() => {
      eventBus.emit(
        'nav.module.evicted',
        {
          evictedId: 'arpg-loot',
          label: 'Loot',
          scope: 'module',
          cap: 5,
          liveWork: 'none-observed',
          basis: 'no-observed-live-work',
        },
        'test',
      );
    });

    expect(useActivityFeedStore.getState().events).toHaveLength(0);
    unmount();
  });
});
