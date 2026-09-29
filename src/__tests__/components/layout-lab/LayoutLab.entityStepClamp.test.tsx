/**
 * scan-sweep --challenge catalog-browser-ui/A — the shell clamps the step index against the
 * OPEN ENTITY's own step list, not the catalog-wide one. A PoF bestiary entity has 12 steps
 * (the diablo1-only 'Sprite Render' is not its step) while the catalog lists 13, so a stored
 * index of 12 passed the old clamp and the canvas rendered no step at all.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

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
  const motion = new Proxy({}, { get: (_t, tag: string) => (props: Record<string, unknown>) => React.createElement(tag, strip(props)) });
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
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { resolveCatalogSteps } from '@/components/layout-lab/catalogManifest';
import { useCatalogStore } from '@/stores/catalogStore';

describe('LayoutLab clamps the step index against the open entity\'s own list', { timeout: 20000 }, () => {
  afterEach(cleanup);
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });

  it('a PoF bestiary entity reopened at step index 12 falls back to step 01, never an empty pane', () => {
    const pofId = 'bestiary-melee-grunt';
    const stored = useCatalogStore.getState().entitiesByCatalog['bestiary']?.[pofId];
    expect(stored && !stored.provenance).toBe(true); // fixture guard: a seeded, authored (pof) entity
    expect(resolveCatalogSteps('bestiary')).toHaveLength(13); // 12 is a valid CATALOG index
    localStorage.setItem('pof-lab-prefs', JSON.stringify({ themeId: 'light', lastCatalogId: 'bestiary', lastEntityId: pofId, lastStepIdx: 12 }));

    render(<LayoutLab />);
    expect(screen.queryByText(/Select a pipeline step/)).toBeNull();
    expect(screen.getByText(/^Step 01 \//)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: resolveCatalogSteps('bestiary')[0] })).toBeTruthy();
  });
});
