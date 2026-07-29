import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';

/**
 * Lab search is MOUNTED for the whole session but open for seconds of it. Its index spans
 * every catalog, every seeded entity and every step of every registered pipeline, and it
 * used to be built (and rebuilt on every entity change) while the overlay was closed.
 * These pin that the build is deferred to the first open — and that reopening reuses it.
 */

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

const h = vi.hoisted(() => ({ steps: 0 }));

vi.mock('@/components/layout-lab/catalogManifest', async (orig) => {
  const actual = await orig<typeof import('@/components/layout-lab/catalogManifest')>();
  return {
    ...actual,
    resolveCatalogSteps: (id: string) => { h.steps++; return actual.resolveCatalogSteps(id); },
  };
});

import { LabSearch } from '@/components/layout-lab/LabSearch';

const noop = () => {};

function renderSearch(open: boolean) {
  return render(
    <LabSearch open={open} onClose={noop} currentEntityId={null} onSelectCatalog={noop} onNavigate={noop} />,
  );
}

beforeEach(() => { h.steps = 0; });
afterEach(cleanup);

describe('<LabSearch /> — index is built on first open, not while closed', () => {
  it('builds NOTHING while closed', () => {
    renderSearch(false);
    expect(h.steps).toBe(0);
  });

  it('builds the index the moment it opens, and searches over it', () => {
    const { rerender } = renderSearch(false);
    expect(h.steps).toBe(0);

    rerender(<LabSearch open onClose={noop} currentEntityId={null} onSelectCatalog={noop} onNavigate={noop} />);
    expect(h.steps).toBeGreaterThan(0);

    fireEvent.change(screen.getByTestId('lab-search-input'), { target: { value: 'items' } });
    expect(screen.queryAllByTestId('lab-search-option').length).toBeGreaterThan(0);
  });

  it('keeps the built index across a close/reopen (reopening is instant)', () => {
    const { rerender } = renderSearch(true);
    const afterFirstOpen = h.steps;
    expect(afterFirstOpen).toBeGreaterThan(0);

    rerender(<LabSearch open={false} onClose={noop} currentEntityId={null} onSelectCatalog={noop} onNavigate={noop} />);
    rerender(<LabSearch open onClose={noop} currentEntityId={null} onSelectCatalog={noop} onNavigate={noop} />);
    expect(h.steps).toBe(afterFirstOpen);
  });
});
