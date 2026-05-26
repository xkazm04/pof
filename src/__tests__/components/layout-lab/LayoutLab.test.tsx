import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, renderHook } from '@testing-library/react';

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

  it('renders the Light/Dark theme toggle', () => {
    render(<LayoutLab />);
    expect(screen.getByRole('button', { name: 'Blueprint' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Studio Dark' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Forge' })).toBeNull();
  });

  it('opens on the Items pipeline with header stats', () => {
    render(<LayoutLab />);
    expect(screen.getByText('Attributes')).toBeTruthy(); // a pipeline step in the sidebar
    expect(screen.getAllByText('lifecycle').length).toBeGreaterThan(0); // moved title-block stat
  });

  it('opens directly on the Concept Brief step (Acceptance gate + Produce panel)', () => {
    render(<LayoutLab />);
    // stepIdx defaults to 0 → Concept Brief renders without a click
    expect(screen.getByText(/at least 300 characters/)).toBeTruthy();
    expect(screen.getByText('Current brief')).toBeTruthy();   // a View panel label
    expect(screen.getByText('Produce')).toBeTruthy();          // the Produce panel label
    expect(screen.getByText(/Generate with CLI/)).toBeTruthy();
  });

  it('Economy step renders charts + power-score acceptance', () => {
    render(<LayoutLab />);
    fireEvent.click(screen.getByText('Economy'));
    expect(screen.getByText(/Stat budget vs tier/)).toBeTruthy();
    expect(screen.getByText(/Tune within budget/)).toBeTruthy();
    expect(screen.getByText(/Power within ±10%/)).toBeTruthy();
  });

  it('the full Items pipeline is prototyped (later steps render their step UI)', () => {
    render(<LayoutLab />);
    // a late step has a real V/P/A component, not the placeholder
    fireEvent.click(screen.getByText('Test Gate'));
    expect(screen.getByText(/Run functional test/)).toBeTruthy();
    expect(screen.getByText(/All gate checks pass/)).toBeTruthy();
    fireEvent.click(screen.getByText('UE Packaging'));
    expect(screen.getByText('Asset manifest')).toBeTruthy();
  });

  it('a step Produce persists real data and derives Acceptance from it', () => {
    render(<LayoutLab />);
    // Concept Brief is the default step; before Produce its gate is pending.
    expect(screen.getByText('0 / 300 chars')).toBeTruthy();
    expect(screen.getByText('No brief yet — run Produce to generate one.')).toBeTruthy();
    // run the step's CLI produce → data is persisted, gate flips to PASS, View shows the brief.
    fireEvent.click(screen.getByText(/Generate with CLI/));
    expect(screen.queryByText('No brief yet — run Produce to generate one.')).toBeNull();
    expect(screen.getByText(/mid-tier martial weapon/)).toBeTruthy();
    expect(screen.getAllByText('PASS').length).toBeGreaterThan(0);
  });

  it('"Populate demo" drives one item through all 13 steps with real persisted data', () => {
    render(<LayoutLab />);
    fireEvent.click(screen.getByText('Populate demo')); // runs every Items step for Iron Longsword (item-1)
    // pipeline progress is derived from the store, not faked.
    expect(screen.getAllByText('13/13').length).toBeGreaterThan(0);
    // persisted attribute data renders in the Attributes View.
    fireEvent.click(screen.getByText('Attributes'));
    expect(screen.getByText('34 hp')).toBeTruthy();
    // persisted UE asset paths render in the Packaging manifest (slug = IronLongsword).
    fireEvent.click(screen.getByText('UE Packaging'));
    expect(screen.getByText('T_IronLongsword_Icon')).toBeTruthy();
    // resetting clears the persisted state back to pending.
    fireEvent.click(screen.getByText('Reset'));
    expect(screen.getAllByText('0/13').length).toBeGreaterThan(0);
  });
});
