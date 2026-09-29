import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, act, cleanup, renderHook } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});

// Each stub names its module in the DOM and, when the test lists a reason for it,
// declares a pane hold exactly as a real module would (through `usePaneHold`, with
// no knowledge of its own pane id). `unmounted` records every stub cleanup, so a
// test can prove a held pane was never torn down.
const paneStubs = vi.hoisted(() => ({
  reasons: {} as Record<string, string>,
  unmounted: [] as string[],
}));

vi.mock('@/components/layout/ModuleRenderer/registry', async () => {
  const { usePaneHold } = await import('@/hooks/usePaneHold');
  const { useEffect: useEff } = await import('react');
  const stubs = new Map<string, React.ComponentType>();
  const make = (key: string) =>
    function Stub() {
      const reason = paneStubs.reasons[key];
      usePaneHold(Boolean(reason), reason ?? '');
      useEff(() => () => { paneStubs.unmounted.push(key); }, []);
      return <div data-module={key}>module</div>;
    };
  return {
    MODULE_COMPONENTS: new Proxy({} as Record<string, React.ComponentType>, {
      get: (_t, key: string) => {
        if (!stubs.has(key)) stubs.set(key, make(key));
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
  lruTouchedAll,
  observedLiveKey,
  observedLiveProbe,
  describeEviction,
  tearsDownObservedWork,
} from '@/components/layout/ModuleRenderer/helpers';
import { getPaneHolds } from '@/hooks/usePaneHold';
import { useNavigationStore } from '@/stores/navigationStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import { useActivityFeedBridge } from '@/hooks/useActivityFeedBridge';
import { eventBus } from '@/lib/event-bus';
import type { BusEvent } from '@/types/event-bus';

const COOK = 'UE cook running';
const NAV = ['packaging', 'audio', 'models', 'materials', 'physics', 'ui-hud'];

// ── The observation: a hold is positive evidence, like a running CLI session ──

describe('observedLiveKey folds pane holds into the liveness key', () => {
  it('flags a held pane with no CLI session at all', () => {
    const key = observedLiveKey({}, { packaging: [COOK] });
    expect(key).toContain('m:packaging');
    expect(observedLiveProbe(key, 'module')('packaging')).toBe(true);
  });
});

describe('the LRU keeps a held pane and evicts the next un-held one', () => {
  it('folds the real nav order through the probe: audio goes, packaging stays', () => {
    const isLive = observedLiveProbe(observedLiveKey({}, { packaging: [COOK] }), 'module');
    let list: string[] = [];
    const evicted: string[] = [];
    const forced: string[] = [];
    for (const id of NAV) {
      const touch = lruTouchedAll(list, [id], 5, isLive);
      if (!touch) continue;
      list = touch.next;
      evicted.push(...touch.evicted);
      forced.push(...touch.forced);
    }
    expect(evicted).toEqual(['audio']); // exactly one pane per overflow past 5
    expect(forced).toEqual([]); // basis no-observed-live-work, not forced
    expect(list).toContain('packaging');
    expect(list).toHaveLength(5);
  });
});

describe('describeEviction names the hold it tore down', () => {
  it('reports liveWork pane-hold with the hold reason, and counts as observed loss', () => {
    const signal = describeEviction('packaging', 'module', 5, {}, 'forced-over-live-work', {
      packaging: [COOK],
    });
    expect(signal.liveWork).toBe('pane-hold');
    expect(signal.holdReason).toBe(COOK);
    expect(tearsDownObservedWork(signal)).toBe(true);
  });
});

// ── End to end through the real shell ──

describe('ModuleRenderer honours pane holds', () => {
  let events: BusEvent<'nav.module.evicted'>[] = [];
  let unsub: () => void;

  beforeEach(() => {
    events = [];
    paneStubs.reasons = {};
    paneStubs.unmounted = [];
    unsub = eventBus.on('nav.module.evicted', (e) => events.push(e));
    useNavigationStore.setState({ activeCategory: 'game-systems', activeSubModule: null });
    useCLIPanelStore.setState({ sessions: {}, maximizedTabId: null });
  });

  afterEach(() => unsub());

  const visit = (id: string) =>
    act(() => {
      useNavigationStore.setState({ activeSubModule: id as never });
    });

  it('hiding a pane and showing it again never remounts its module (the keep-alive holds rely on)', () => {
    render(<ModuleRenderer />);
    visit('packaging');
    visit('audio');
    visit('packaging');
    visit('audio');
    expect(paneStubs.unmounted).toEqual([]);
  });

  it('keeps a held packaging pane mounted across 5 further navigations', () => {
    paneStubs.reasons = { packaging: COOK };
    const { container } = render(<ModuleRenderer />);

    for (const id of NAV) visit(id);

    expect(container.querySelector('[data-module="packaging"]')).not.toBeNull();
    expect(paneStubs.unmounted).not.toContain('packaging');
    expect(paneStubs.unmounted).toEqual(['audio']);
    expect(events).toHaveLength(1);
    expect(events[0].payload.evictedId).toBe('audio');
    expect(events[0].payload.basis).toBe('no-observed-live-work');
    expect(getPaneHolds()).toEqual({ packaging: [COOK] });
  });

  it('forced over five held panes: reports the victim\'s own hold reason even though its cleanup already released it', () => {
    const six = ['arpg-character', 'arpg-animation', 'arpg-gas', 'arpg-combat', 'arpg-enemy-ai', 'arpg-inventory'];
    paneStubs.reasons = Object.fromEntries(six.slice(0, 5).map((m, i) => [m, `r${i + 1}`]));
    render(<ModuleRenderer />);

    for (const id of six) visit(id);

    expect(events).toHaveLength(1);
    expect(events[0].payload.evictedId).toBe('arpg-character');
    expect(events[0].payload.basis).toBe('forced-over-live-work');
    expect(events[0].payload.liveWork).toBe('pane-hold');
    expect(events[0].payload.holdReason).toBe('r1');
    // The victim's unmount cleanup ran and released its hold — memory stays bounded.
    expect(paneStubs.unmounted).toEqual(['arpg-character']);
    expect(getPaneHolds()['arpg-character']).toBeUndefined();
  });
});

// ── The report reaches the user with its reason ──

describe('useActivityFeedBridge surfaces a torn-down hold with its reason', () => {
  beforeEach(() => {
    useActivityFeedStore.setState({ events: [] });
  });

  it('publishes one shell-eviction event whose description names the hold', () => {
    const { unmount } = renderHook(() => useActivityFeedBridge());
    act(() => {
      eventBus.emit(
        'nav.module.evicted',
        {
          evictedId: 'packaging',
          label: 'Packaging',
          scope: 'module',
          cap: 5,
          liveWork: 'pane-hold',
          holdReason: COOK,
          basis: 'forced-over-live-work',
        },
        'test',
      );
    });
    const feed = useActivityFeedStore.getState().events;
    expect(feed).toHaveLength(1);
    expect(feed[0].type).toBe('shell-eviction');
    expect(feed[0].description).toContain(COOK);
    unmount();
  });
});
