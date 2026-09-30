/**
 * scan-sweep --challenge lab-shell-and-navigation/A — every "open this entity" path goes
 * through ONE door that also lands on the Catalogs view. The one-shot completion toast's
 * "Open" (and the coach jump) write `pendingNavigation`; toasts are global, so pressed while
 * the Canon or Matrix view was up it used to move the location but leave that view on
 * screen — the highlight moved, the content did not.
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
  // One stable component per tag (like the real `motion.div`), so a re-render never remounts the view.
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
import { useOneShotLabStore } from '@/stores/oneShotLabStore';

const readPrefs = () => JSON.parse(localStorage.getItem('pof-lab-prefs') ?? '{}');

describe('LayoutLab — the pendingNavigation door lands on the Catalogs view', { timeout: 20000 }, () => {
  afterEach(cleanup);
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} });
    useOneShotLabStore.setState({ pendingNavigation: null });
    _resetArtifactCache();
    localStorage.clear();
  });

  it('a toast "Open" pressed from the Canon view opens the entity on the Catalogs view', () => {
    const target = renderHook(() => useLabDetail('items')).result.current!.entities[1];
    render(<LayoutLab />);
    fireEvent.click(screen.getByRole('button', { name: 'Canon' }));
    expect(readPrefs().lastView).toBe('canon');

    // What toastHandler's `Open` action does.
    act(() => { useOneShotLabStore.getState().setPendingNavigation({ catalogId: 'items', entityId: target.id }); });

    expect(readPrefs().lastView).toBe('catalogs');
    expect(screen.getByRole('heading', { level: 1, name: target.name })).toBeTruthy();
    expect(readPrefs().lastEntityId).toBe(target.id);
    // Consumed exactly once.
    expect(useOneShotLabStore.getState().pendingNavigation).toBeNull();
  });
});
