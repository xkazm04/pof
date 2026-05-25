import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, renderHook } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { LayoutLab } from '@/components/layout-lab/LayoutLab';
import { useLabDetail } from '@/components/layout-lab/useLabCatalogData';

describe('UI identity lab (Blueprint baseline · Items example)', () => {
  afterEach(cleanup);

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
});
