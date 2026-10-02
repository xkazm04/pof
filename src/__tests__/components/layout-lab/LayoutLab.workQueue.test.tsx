/**
 * scan-sweep --challenge catalog-browser-ui/B — the work queue walked THROUGH the shell (the
 * coordinator's binding revision): open a 3-item queue from the Matrix, Next lands the canvas on
 * item 2 (entity AND step), the strip counts it, and a tree click outside the queue ends it.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

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
// Three zone-map entities hold one produced step each, at DIFFERENT steps; the rest are unproduced.
vi.mock('@/components/layout-lab/labArtifactClient', () => {
  const a = (entityId: string, step: string) =>
    ({ catalogId: 'zone-map', entityId, step, data: {}, ueAssets: [], status: 'deferred', tier: 'L3', updatedAt: '2026-09-01T00:00:00.000Z' });
  const arts = [a('zone-z5', 'Test Gate'), a('zone-z2', 'Area Level & Density'), a('zone-z4', 'Material')];
  const forCatalog = (c: string) => (c === 'zone-map' ? arts : []);
  return {
    fetchArtifacts: vi.fn(async (c: string) => forCatalog(c)),
    fetchArtifactsResult: vi.fn(async (c: string) => ({ ok: true, data: forCatalog(c) })),
    fetchStepSummaryResult: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    postArtifact: vi.fn().mockResolvedValue(undefined),
    drainGates: vi.fn().mockResolvedValue(null),
    drainCatalogGates: vi.fn().mockResolvedValue({ kind: 'ok', summary: { ran: 0, passed: 0, failed: 0, skipped: 0, results: [] } }),
    fetchDrainLease: vi.fn().mockResolvedValue(null),
  };
});
// Deterministic grading: every produced zone-map step is a deferred L3 gate (awaiting a live run).
vi.mock('@/components/layout-lab/labAcceptance', async (orig) => {
  const actual = await orig<typeof import('@/components/layout-lab/labAcceptance')>();
  return {
    ...actual,
    resolveAccept: (c: string, step: string) => (c === 'zone-map'
      ? () => ({ label: step, status: 'deferred', tier: 'L3', detail: '', reason: 'awaiting a live run' })
      : actual.resolveAccept(c, step)),
  };
});

import { LayoutLab } from '@/components/layout-lab/LayoutLab';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';

const labEntity = () => document.querySelector('[data-lab-root]')?.getAttribute('data-lab-entity');
const position = () => screen.getByTestId('work-queue-position').textContent;
const stepHeading = (name: string) => screen.getByRole('heading', { level: 2, name });

describe('LayoutLab walks a Matrix work queue through the canvas', { timeout: 60000 }, () => {
  afterEach(cleanup);
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} });
    _resetArtifactCache();
    localStorage.clear();
    localStorage.setItem('pof-lab-prefs', JSON.stringify({ themeId: 'light', lastCatalogId: 'zone-map', lastView: 'matrix' }));
  });

  it('Next opens item 2 (entity + step) and reads "2 of 3"; a tree click outside the queue unmounts the strip', async () => {
    render(<LayoutLab />);
    const chip = await waitFor(() => {
      const el = screen.getByTestId('triage-chip-deferred');
      expect(el.textContent).toContain('3');
      return el;
    });
    fireEvent.click(chip);
    fireEvent.click(screen.getByTestId('matrix-work-queue'));

    // Item 1: the canvas opens zone-z2 at its deferred step (ranked by ladder, then id).
    expect(labEntity()).toBe('zone-z2');
    expect(position()).toBe('1 of 3');
    expect(stepHeading('Area Level & Density')).toBeTruthy();

    fireEvent.click(screen.getByTestId('work-queue-next'));
    expect(labEntity()).toBe('zone-z4');
    expect(stepHeading('Material')).toBeTruthy();
    expect(screen.getByText(/^Step 07 \//)).toBeTruthy();
    expect(position()).toBe('2 of 3');

    // A tree click on an entity outside the queue ends it.
    fireEvent.click(screen.getByRole('button', { name: /^Crystal Caves:/ }));
    expect(labEntity()).toBe('zone-z3');
    expect(screen.queryByTestId('work-queue-strip')).toBeNull();
  });
});
