import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, act, waitFor } from '@testing-library/react';
import { useLabRouteSync } from '@/components/layout-lab/hooks/useLabRouteSync';
import { parseLabRoute, type LabRoute } from '@/lib/shell/labRoute';

/**
 * scan-sweep --challenge lab-shell-and-navigation/B — the lab location and the address stay in
 * step. Section moves (open / catalog / entity / view) PUSH one entry, a rail step move
 * REPLACES, and Back/Forward re-apply the entry through the one navigate door without ever
 * growing history. Before: nothing under layout-lab touched window.history, so Back after a
 * matrix-cell jump left the lab entirely.
 */

const A: LabRoute = { catalogId: 'items', entityId: 'item-a', step: 'Concept Brief', view: 'catalogs' };
const urlOf = (u: unknown) => new URL(String(u), 'http://localhost');
const parsedOf = (u: unknown) => parseLabRoute(urlOf(u).search);

/** Real jsdom traversal: resolves once its popstate has been dispatched. */
function traverse(dir: 'back' | 'forward'): Promise<void> {
  return new Promise((resolve) => {
    window.addEventListener('popstate', () => resolve(), { once: true });
    act(() => { window.history[dir](); });
  });
}

beforeEach(() => { window.history.replaceState({}, '', '/layout'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function mount(apply = vi.fn()) {
  const hook = renderHook(({ loc }: { loc: LabRoute | null }) => useLabRouteSync(loc, apply), { initialProps: { loc: A } });
  return { ...hook, apply };
}

describe('useLabRouteSync — lab moves are history entries', () => {
  it('open / catalog / entity / view moves push exactly one entry naming the new location; a step move replaces', () => {
    const { rerender } = mount();
    const push = vi.spyOn(window.history, 'pushState');
    const replace = vi.spyOn(window.history, 'replaceState');

    const moves: LabRoute[] = [
      { catalogId: 'items', entityId: 'item-b', step: 'Economy', view: 'catalogs' },          // open
      { catalogId: 'spellbook', entityId: 'spell-a', step: 'Concept Brief', view: 'catalogs' }, // catalog
      { catalogId: 'spellbook', entityId: 'spell-b', step: 'Concept Brief', view: 'catalogs' }, // entity
      { catalogId: 'spellbook', entityId: 'spell-b', step: 'Concept Brief', view: 'matrix' },   // view
    ];
    for (const loc of moves) {
      push.mockClear();
      rerender({ loc });
      expect(push).toHaveBeenCalledTimes(1);
      expect(parsedOf(push.mock.calls[0][2])).toEqual(loc);
    }

    push.mockClear();
    replace.mockClear();
    const before = window.history.length;
    rerender({ loc: { ...moves[3], step: 'Lore' } });
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(urlOf(replace.mock.calls[0][2]).searchParams.get('s')).toBe('Lore');
    expect(window.history.length).toBe(before);
  });

  it('popstate after two pushed moves applies the entry once and pushes nothing', async () => {
    const { rerender, apply } = mount();
    const B: LabRoute = { ...A, entityId: 'item-b' };
    const C: LabRoute = { ...A, entityId: 'item-c' };
    rerender({ loc: B });
    rerender({ loc: C });
    const push = vi.spyOn(window.history, 'pushState');

    await traverse('back');
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(apply).toHaveBeenCalledWith(B);
    expect(push).not.toHaveBeenCalled();
  });

  it('an entity change landing with a new entity universe is the reconcile — replaced, not pushed', () => {
    const apply = vi.fn();
    const { rerender } = renderHook(
      ({ loc, universe }: { loc: LabRoute; universe: unknown }) => useLabRouteSync(loc, apply, universe),
      { initialProps: { loc: A, universe: ['item-a'] as unknown } },
    );
    const push = vi.spyOn(window.history, 'pushState');
    const replace = vi.spyOn(window.history, 'replaceState');
    rerender({ loc: { ...A, entityId: 'item-x' }, universe: ['item-x', 'item-a'] });
    expect(push).not.toHaveBeenCalled();
    expect(parsedOf(replace.mock.calls[0][2])?.entityId).toBe('item-x');
  });

  it('keeps the /layout pathname — a synced move never navigates away from the lab route', () => {
    const { rerender } = mount();
    expect(window.location.pathname).toBe('/layout');
    const push = vi.spyOn(window.history, 'pushState');
    rerender({ loc: { ...A, entityId: 'item-b' } });
    expect(urlOf(push.mock.calls[0][2]).pathname).toBe('/layout');
    expect(window.location.pathname).toBe('/layout');
    expect(parseLabRoute(window.location.search)).toEqual({ ...A, entityId: 'item-b' });
  });
});
