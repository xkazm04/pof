import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, renderHook, within, waitFor } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { LayoutLab } from '@/components/layout-lab/LayoutLab';
import { useLabDetail } from '@/components/layout-lab/useLabCatalogData';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';

describe('UI identity lab (Blueprint baseline · Items example)', () => {
  afterEach(cleanup);
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} }); // isolate the persisted pipeline store between tests
    localStorage.clear();
  });

  it('useLabDetail exposes the Items example pipeline steps', () => {
    const { result } = renderHook(() => useLabDetail('items'));
    expect(result.current?.entities.length).toBeGreaterThan(0);
    for (const s of ['Concept Brief', 'Attributes', 'Economy']) expect(result.current?.steps).toContain(s);
  });

  it('renders a single icon theme toggle (no per-theme text buttons)', () => {
    render(<LayoutLab />);
    // One icon button that names the theme it switches to; the old text buttons are gone.
    expect(screen.getByRole('button', { name: /switch to studio dark theme/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Studio Dark' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Forge' })).toBeNull();
  });

  it('opens on the Items pipeline with header stats', () => {
    render(<LayoutLab />);
    const pipeline = screen.getByRole('list', { name: /pipeline/i });
    expect(within(pipeline).getByRole('button', { name: /Attributes/ })).toBeTruthy(); // a pipeline step in the sidebar
    expect(screen.getAllByText('lifecycle').length).toBeGreaterThan(0); // moved title-block stat
  });

  // The six labels BOTH items specs declare (Concept Brief, Economy, Icon 2D Art, Tooltip /
  // Compare, Test Gate, UE Packaging) are REGISTRY-owned since 2026-09-29 (itemsLabelOwner): they
  // render through ArchetypeStep with the registered StepSpec — the spec the server grades.
  it('opens directly on the Concept Brief step (registered Acceptance gate + Produce panel)', () => {
    render(<LayoutLab />);
    // stepIdx defaults to 0 → Concept Brief renders without a click
    expect(screen.getAllByText(/Brief ≥ 300 characters/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Produce').length).toBeGreaterThan(0); // the Produce panel label
    expect(screen.getByText(/Produce Concept Brief/)).toBeTruthy();
  });

  it('Economy step renders the registered economy record and its canon-band acceptance', () => {
    render(<LayoutLab />);
    const pipeline = screen.getByRole('list', { name: /pipeline/i });
    fireEvent.click(within(pipeline).getByRole('button', { name: /Economy/ }));
    expect(screen.getByText(/Produce Economy/)).toBeTruthy();
    expect(screen.getAllByText(/0.8–1.2× band/).length).toBeGreaterThan(0);
  });

  it('the full Items pipeline is built (later steps render their step UI)', () => {
    render(<LayoutLab />);
    const pipeline = screen.getByRole('list', { name: /pipeline/i });
    // a late bespoke-owned step keeps its own V/P/A component, not the placeholder…
    fireEvent.click(within(pipeline).getByRole('button', { name: /Inventory UI Integration/ }));
    expect(screen.getByTestId('inventory-grid-provenance')).toBeTruthy();
    // …and the registry-owned late steps render the registered spec through ArchetypeStep.
    fireEvent.click(within(pipeline).getByRole('button', { name: /Test Gate/ }));
    expect(screen.getByText(/Produce Test Gate/)).toBeTruthy();
    fireEvent.click(within(pipeline).getByRole('button', { name: /UE Packaging/ }));
    expect(screen.getByText('Package on disk')).toBeTruthy();
  });

  it('a step Produce persists real data and derives Acceptance from it', () => {
    render(<LayoutLab />);
    const gate = () => screen.getByTestId('acceptance-banner').getAttribute('data-status');
    // Concept Brief is the default step; before Produce its gate is not passing.
    expect(gate()).not.toBe('pass');
    // run the step's CLI produce → data is persisted, gate flips to PASS, View shows the brief.
    fireEvent.click(screen.getByText(/Produce Concept Brief/));
    expect(screen.getAllByText(/is an equippable item in PoF/).length).toBeGreaterThan(0);
    expect(gate()).toBe('pass');
  });

  it('"Populate demo" drives one item through all 13 ON-SCREEN spec labels with real persisted data', async () => {
    // Reset now deletes the SERVER artifacts too (add-only hydration would otherwise
    // re-adopt them), so the round-trip has to resolve for the reset to land.
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init?: RequestInit) => Promise.resolve({
      ok: true,
      status: 200,
      // DELETE → the reset envelope; anything else (the artifact GET/POST) → an empty list.
      json: async () => ({ success: true, data: init?.method === 'DELETE' ? { deleted: 13 } : [] }),
    })));
    render(<LayoutLab />);
    fireEvent.click(screen.getByText('Populate demo')); // runs every ITEM_STEP_NAMES label for Iron Longsword (item-1), each through its owner's produce
    // Pipeline progress is derived from the store, not faked — and the denominator is the
    // full rendered UNION (13 bespoke + 5 registry-only labels, see ITEMS_SPEC_DUALITY).
    // "Populate demo" only drives the 13 bespoke specs, so 13/18 is the honest reading: the
    // registry-only steps are produced from their own StepSpec, not by this button.
    expect(screen.getAllByText('13/18').length).toBeGreaterThan(0);
    // persisted attribute data renders in the Attributes View.
    const pipeline = screen.getByRole('list', { name: /pipeline/i });
    fireEvent.click(within(pipeline).getByRole('button', { name: /Attributes/ }));
    expect(screen.getByText('34 hp')).toBeTruthy();
    // UE Packaging is registry-owned: the registered package manifest renders (slug = IronLongsword).
    fireEvent.click(within(pipeline).getByRole('button', { name: /UE Packaging/ }));
    expect(screen.getAllByText(/DA_IronLongsword/).length).toBeGreaterThan(0);
    // resetting clears the persisted state back to pending — after confirming, because
    // it is destructive on both sides (local store + persisted server artifacts).
    fireEvent.click(screen.getByTestId('entity-reset'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset everywhere' }));
    await waitFor(() => expect(screen.getAllByText('0/18').length).toBeGreaterThan(0));
    vi.unstubAllGlobals();
  });
});
