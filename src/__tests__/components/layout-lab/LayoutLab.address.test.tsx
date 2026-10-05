/**
 * scan-sweep --challenge lab-shell-and-navigation/B — the lab has addresses. Arriving on a lab
 * address opens that entity at that step (it outranks the persisted last location, and the
 * arrival REPLACES the entry), and lab moves are history entries, so Back undoes a view switch
 * instead of leaving the app. With no address, the persisted location is restored as before.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, renderHook, act } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
// Static framer-motion (see LayoutLab.navigation.test): AnimatePresence never settles under jsdom.
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const strip = (p: Record<string, unknown>) => {
    const { initial, animate, exit, transition, whileHover, whileTap, whileInView, layout, variants, drag, ...rest } = p;
    void initial; void animate; void exit; void transition; void whileHover; void whileTap; void whileInView; void layout; void variants; void drag;
    return rest;
  };
  const byTag = new Map<string, (props: Record<string, unknown>) => React.ReactElement>();
  const motion = new Proxy({}, {
    get: (_t, tag: string) => {
      if (!byTag.has(tag)) byTag.set(tag, (props: Record<string, unknown>) => React.createElement(tag, strip(props)));
      return byTag.get(tag);
    },
  });
  return { AnimatePresence: ({ children }: { children: React.ReactNode }) => children, motion, useReducedMotion: () => true };
});
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn().mockResolvedValue([]),
  fetchArtifactsResult: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  fetchStepSummaryResult: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  postArtifact: vi.fn().mockResolvedValue(undefined),
  drainGates: vi.fn().mockResolvedValue(null),
  drainCatalogGates: vi.fn().mockResolvedValue({ kind: 'ok', summary: { ran: 0, passed: 0, failed: 0, skipped: 0, results: [] } }),
  fetchDrainLease: vi.fn().mockResolvedValue(null),
}));

import { LayoutLab } from '@/components/layout-lab/LayoutLab';
import { useLabDetail } from '@/components/layout-lab/useLabCatalogData';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';
import { labHref, parseLabRoute } from '@/lib/shell/labRoute';

const PREFS_KEY = 'pof-lab-prefs';
const readPrefs = () => JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
const items = () => renderHook(() => useLabDetail('items')).result.current!;

/** Real jsdom traversal: resolves once its popstate has been dispatched. */
function traverse(dir: 'back' | 'forward'): Promise<void> {
  return new Promise((resolve) => {
    window.addEventListener('popstate', () => resolve(), { once: true });
    act(() => { window.history[dir](); });
  });
}

describe('LayoutLab — lab locations have addresses', () => {
  afterEach(cleanup);
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} });
    _resetArtifactCache();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('arrival on a lab address opens that entity at that step over the persisted location, replacing the entry', () => {
    const { entities } = items();
    localStorage.setItem(PREFS_KEY, JSON.stringify({ themeId: 'light', lastCatalogId: 'items', lastEntityId: entities[0].id, lastStepIdx: 0 }));
    window.history.replaceState(null, '', labHref({ catalogId: 'items', entityId: entities[1].id, step: 'Economy' }));
    const before = window.history.length;

    render(<LayoutLab />);
    expect(screen.getByRole('heading', { level: 1, name: entities[1].name })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Economy' })).toBeTruthy();
    expect(window.history.length).toBe(before);
  });

  it('[guard] with no lab params the persisted step is restored exactly as today', () => {
    const target = items().steps.indexOf('Economy');
    localStorage.setItem(PREFS_KEY, JSON.stringify({ themeId: 'light', lastCatalogId: 'items', lastStepIdx: target }));
    render(<LayoutLab />);
    expect(screen.getByRole('heading', { level: 2, name: 'Economy' })).toBeTruthy();
  });

  it('a view switch is one entry, and Back returns to the Catalogs view on the same step', async () => {
    const { entities } = items();
    window.history.replaceState(null, '', labHref({ catalogId: 'items', entityId: entities[1].id, step: 'Economy', view: 'catalogs' }));
    render(<LayoutLab />);
    const before = window.history.length;

    fireEvent.click(screen.getByRole('button', { name: 'Canon' }));
    expect(window.history.length).toBe(before + 1);
    expect(parseLabRoute(window.location.search)?.view).toBe('canon');

    await traverse('back');
    expect(screen.getByRole('heading', { level: 2, name: 'Economy' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: entities[1].name })).toBeTruthy();
    expect(readPrefs().lastView).toBe('catalogs');
  });
});
