import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, renderHook } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

// No server round-trips in this test.
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn().mockResolvedValue([]),
  postArtifact: vi.fn().mockResolvedValue(undefined),
  drainGates: vi.fn().mockResolvedValue(null),
}));

// Synthetic catalog → no bespoke step UI; the placeholder canvas renders.
vi.mock('@/components/layout-lab/steps', () => ({
  getStepComponent: vi.fn().mockReturnValue(null),
}));

// Drive the viewport width per test (hoisted so the mock factory can see it).
const { widthRef } = vi.hoisted(() => ({ widthRef: { current: 1440 } }));
vi.mock('@/hooks/useViewportWidth', () => ({
  useViewportWidth: () => widthRef.current,
  WIDE_FALLBACK_WIDTH: 1440,
}));

import { Baseline } from '@/components/layout-lab/Baseline';
import { LIGHT } from '@/components/layout-lab/theme';

const groups = [{ category: 'Test', catalogs: [{ catalogId: 'fixtures', label: 'Fixtures', description: '', verified: 0, total: 1 }] }];
const detail = {
  catalog: { catalogId: 'fixtures', label: 'Fixtures', description: 'A synthetic catalog', total: 1, verified: 0 },
  entities: [{ id: 'fix-1', name: 'Fixture One', lifecycle: 'planned' as const, data: {} }],
  steps: ['Alpha', 'Beta', 'Gamma'],
};

const renderBaseline = () =>
  render(<Baseline theme={LIGHT} groups={groups} detail={detail} onSelectCatalog={() => {}} entityId="fix-1" onSelectEntity={() => {}} />);

afterEach(cleanup);

describe('Baseline responsive shell', () => {
  it('wide: renders the catalog + pipeline columns inline, with no drawer toggles', () => {
    widthRef.current = 1440;
    const { container } = renderBaseline();
    // The collapsed-shell toggles are absent; "Catalogs" is just a section label, not a button.
    expect(screen.queryByRole('button', { name: 'Catalogs' })).toBeNull();
    // The pipeline timeline renders inline inside an <aside> column.
    expect(container.querySelector('aside [data-step-status]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Alpha: pending' })).toBeTruthy();
  });

  it('narrow: collapses both columns to persistent header toggles', () => {
    widthRef.current = 800;
    const { container } = renderBaseline();
    expect(screen.getByRole('button', { name: 'Catalogs' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Pipeline/ })).toBeTruthy();
    // No inline columns, and the timeline isn't mounted until its drawer opens.
    expect(container.querySelector('aside [data-step-status]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Step 01: Alpha — pending' })).toBeNull();
    // The work canvas (main) still renders the selected step.
    expect(screen.getByRole('heading', { name: 'Alpha' })).toBeTruthy();
  });

  it('narrow: opening the Pipeline toggle reveals the step timeline in a dialog', () => {
    widthRef.current = 800;
    renderBaseline();
    fireEvent.click(screen.getByRole('button', { name: /^Pipeline/ }));
    expect(screen.getByRole('dialog', { name: /Pipeline/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Alpha: pending' })).toBeTruthy();
  });

  it('narrow: opening the Catalogs toggle reveals the catalog tree in a dialog', () => {
    widthRef.current = 800;
    renderBaseline();
    fireEvent.click(screen.getByRole('button', { name: 'Catalogs' }));
    expect(screen.getByRole('dialog', { name: 'Catalogs' })).toBeTruthy();
  });

  it('narrow: picking a step updates the canvas heading', () => {
    widthRef.current = 800;
    renderBaseline();
    fireEvent.click(screen.getByRole('button', { name: /^Pipeline/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Beta: pending' }));
    expect(screen.getByRole('heading', { name: 'Beta' })).toBeTruthy();
  });
});

describe('useViewportWidth (real hook)', () => {
  it('defaults to the wide fallback when ResizeObserver is unavailable (SSR/jsdom)', async () => {
    const actual = await vi.importActual<typeof import('@/hooks/useViewportWidth')>('@/hooks/useViewportWidth');
    const { result } = renderHook(() => actual.useViewportWidth());
    expect(result.current).toBe(actual.WIDE_FALLBACK_WIDTH);
  });
});
