import { describe, it, expect, afterEach, beforeEach, beforeAll, vi } from 'vitest';
import { createElement, forwardRef, type ReactNode } from 'react';
import { render, cleanup } from '@testing-library/react';

const flag = vi.hoisted(() => ({ reduced: true }));

// Every motion.<tag> renders a plain element carrying its animation props as data attributes.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  const cache = new Map<string, unknown>();
  const make = (tag: string) => {
    if (!cache.has(tag)) {
      const Comp = forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
        const { initial, animate, exit, transition, whileHover, whileFocus, whileTap, layout, layoutId, variants, style, ...rest } = props;
        void animate; void whileHover; void whileFocus; void whileTap; void layout; void layoutId; void variants; void style;
        return createElement(tag, {
          ...rest, ref,
          'data-exit': exit === undefined ? undefined : JSON.stringify(exit),
          'data-initial': initial === undefined ? undefined : JSON.stringify(initial),
          'data-transition': transition === undefined ? undefined : JSON.stringify(transition),
        });
      });
      Comp.displayName = `motion.${tag}`;
      cache.set(tag, Comp);
    }
    return cache.get(tag);
  };
  return {
    ...actual,
    useReducedMotion: () => flag.reduced,
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: new Proxy({}, { get: (_t, tag: string) => make(tag) }),
  };
});

vi.mock('@/hooks/useTabFeatures', () => ({
  useTabFeatures: () => ({ featureMap: new Map(), stats: { total: 0, implemented: 0, partial: 0, missing: 0 }, features: [], defs: [], isLoading: false }),
}));
vi.mock('@/components/modules/core-engine/sub_inventory/catalog/CatalogGearTab', () => ({ CatalogGearTab: () => <div>gear-stub</div> }));

import { ItemCatalog } from '@/components/modules/core-engine/sub_inventory';
import { ItemEconomySimulator } from '@/components/modules/core-engine/sub_inventory/economy-simulator';
import { useItemEconomySessionStore } from '@/stores/itemEconomySessionStore';

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  }
});
afterEach(cleanup);
beforeEach(() => { flag.reduced = true; useItemEconomySessionStore.getState().reset(); });

/** Transition wrappers: the motion elements that declare an exit. */
function transitionSites(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-exit]')).map((el) => ({
    initialY: (JSON.parse(el.getAttribute('data-initial') ?? '{}') as { y?: number }).y ?? 0,
    exitY: (JSON.parse(el.getAttribute('data-exit') ?? '{}') as { y?: number }).y ?? 0,
    duration: (JSON.parse(el.getAttribute('data-transition') ?? '{}') as { duration?: number }).duration,
  }));
}

describe('Item Catalog and simulator transitions honour reduced motion', () => {
  it('with prefers-reduced-motion, all five transition sites drop the y offset and use a zero duration', () => {
    // Snapshot per render: cleanup() between renders empties the container, so read as we go.
    flag.reduced = true;
    const sites: ReturnType<typeof transitionSites> = [];
    const s = useItemEconomySessionStore.getState();
    let c = render(<ItemCatalog moduleId="arpg-inventory" />).container; sites.push(...transitionSites(c)); cleanup();
    c = render(<ItemEconomySimulator moduleId="arpg-inventory" />).container; sites.push(...transitionSites(c)); cleanup();
    s.updateConfig('playerCount', 30); s.start();
    c = render(<ItemEconomySimulator moduleId="arpg-inventory" />).container; sites.push(...transitionSites(c)); cleanup();
    useItemEconomySessionStore.getState().reset();
    useItemEconomySessionStore.getState().updateConfig('playerCount', 30);
    useItemEconomySessionStore.getState().run();
    c = render(<ItemEconomySimulator moduleId="arpg-inventory" />).container; sites.push(...transitionSites(c));
    expect(sites).toHaveLength(5); // catalog, empty, skeleton, results, results tab swap
    for (const site of sites) {
      expect(site.initialY).toBe(0);
      expect(site.exitY).toBe(0);
      expect(site.duration).toBe(0);
    }
  });

  it('without reduced motion the same sites still slide (the instrument sees real offsets)', () => {
    flag.reduced = false;
    const c = render(<ItemCatalog moduleId="arpg-inventory" />).container;
    const [site] = transitionSites(c);
    expect(site.initialY).toBe(16);
    expect(site.duration).toBeGreaterThan(0);
  });
});
