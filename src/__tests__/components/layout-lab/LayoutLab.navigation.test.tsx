import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, renderHook, within } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

// Fully static framer-motion: AnimatePresence mode="wait" holds the entering view until
// an exit animation that never fires under jsdom, and real motion.* run rAF animations that
// can throw on detached nodes — both make cross-view swaps hang. Render plain elements.
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const strip = (p: Record<string, unknown>) => {
    const { initial, animate, exit, transition, whileHover, whileTap, whileInView, layout, variants, drag, ...rest } = p;
    void initial; void animate; void exit; void transition; void whileHover; void whileTap; void whileInView; void layout; void variants; void drag;
    return rest;
  };
  const motion = new Proxy({}, { get: (_t, tag: string) => (props: Record<string, unknown>) => React.createElement(tag, strip(props)) });
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion,
    useReducedMotion: () => true,
  };
});

// No server round-trips — keep the matrix/baseline artifact fetches deterministic (empty)
// so a view swap never awaits the network (which can hang under a leaked timer/env).
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn().mockResolvedValue([]),
  postArtifact: vi.fn().mockResolvedValue(undefined),
  drainGates: vi.fn().mockResolvedValue(null),
  drainCatalogGates: vi.fn().mockResolvedValue({ kind: 'ok', summary: { ran: 0, passed: 0, failed: 0, skipped: 0, results: [] } }),
  // RunnerChip in the lab shell polls the drain lease on mount → null = idle/unknown (no network in tests).
  fetchDrainLease: vi.fn().mockResolvedValue(null),
}));

import { LayoutLab } from '@/components/layout-lab/LayoutLab';
import { useLabDetail } from '@/components/layout-lab/useLabCatalogData';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';

const PREFS_KEY = 'pof-lab-prefs';
const readPrefs = () => JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
const pipeline = () => screen.getByRole('list', { name: /pipeline/i });

/**
 * Direction 1 — "the lab never forgets": navigation state is owned by LayoutLab (single
 * source of truth), so it survives the view toggles that remount Baseline, the matrix
 * dropdown writes through to the same catalogId, a jump is consumed exactly once (never
 * replayed stale), and every open persists last-location the same way a tree click does.
 */
// Each case renders the whole LayoutLab and swaps to the Matrix (a full entity×step grid) —
// legitimately heavy, and CPU-starved when the suite runs many files in parallel workers.
// A generous timeout keeps these deterministic under load (they pass in well under 1s solo).
describe('LayoutLab navigation state truth', { timeout: 20000 }, () => {
  afterEach(cleanup);
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} });
    localStorage.clear();
  });

  it('retains the step position across a catalogs → matrix → catalogs view toggle', () => {
    render(<LayoutLab />);
    // Jump to the Economy step (not the default step 0).
    fireEvent.click(within(pipeline()).getByRole('button', { name: /Economy/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Economy' })).toBeTruthy();
    // Toggle away to the Matrix and back — Baseline remounts, but the step must persist.
    fireEvent.click(screen.getByRole('button', { name: 'Matrix' }));
    fireEvent.click(screen.getByRole('button', { name: 'Catalogs' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Economy' })).toBeTruthy();
  });

  it('syncs the matrix catalog selection back to the single-source catalogId', () => {
    render(<LayoutLab />);
    fireEvent.click(screen.getByRole('button', { name: 'Matrix' }));
    const select = screen.getByLabelText('Catalog') as HTMLSelectElement;
    // Pick any catalog other than the default 'items'.
    const other = Array.from(select.options).map((o) => o.value).find((v) => v && v !== 'items')!;
    expect(other).toBeTruthy();
    fireEvent.change(select, { target: { value: other } });
    // The controlled select now reflects the single-source catalogId (write-through).
    expect(select.value).toBe(other);
    // Back on the Catalogs tab the composition view is on the SAME catalog, not the old fork.
    fireEvent.click(screen.getByRole('button', { name: 'Catalogs' }));
    expect(screen.getByText(`sheet · ${other}`)).toBeTruthy();
  });

  it('consumes a matrix jump exactly once — a later manual step change is not overwritten', () => {
    const { result } = renderHook(() => useLabDetail('items'));
    const firstId = result.current!.entities[0].id;
    const { container } = render(<LayoutLab />);
    // Jump from the first entity's Economy cell (a non-zero step).
    fireEvent.click(screen.getByRole('button', { name: 'Matrix' }));
    fireEvent.click(container.querySelector(`[data-cell="${firstId}::Economy"]`) as HTMLElement);
    expect(screen.getByRole('heading', { level: 2, name: 'Economy' })).toBeTruthy();
    // The user then manually selects step 0 (Concept Brief).
    fireEvent.click(within(pipeline()).getByRole('button', { name: /Concept Brief/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Concept Brief' })).toBeTruthy();
    // Toggle view and back: the stale jump must NOT replay (still Concept Brief).
    fireEvent.click(screen.getByRole('button', { name: 'Matrix' }));
    fireEvent.click(screen.getByRole('button', { name: 'Catalogs' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Concept Brief' })).toBeTruthy();
  });

  it('persists last-location on a matrix open the same way a tree click does', () => {
    const { result } = renderHook(() => useLabDetail('items'));
    const firstEntity = result.current!.entities[0];
    const { container } = render(<LayoutLab />);
    fireEvent.click(screen.getByRole('button', { name: 'Matrix' }));
    // Open the first entity from the matrix (row-name button → onOpenStep at step 0).
    fireEvent.click(within(container.querySelector(`[data-testid="matrix-progress-${firstEntity.id}"]`)!.closest('button')!).getByText(firstEntity.name));
    const prefs = readPrefs();
    expect(prefs.lastCatalogId).toBe('items');
    expect(prefs.lastEntityId).toBe(firstEntity.id);
  });
});
