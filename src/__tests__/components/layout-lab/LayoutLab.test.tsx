import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, renderHook } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { Oswald: f, IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { LayoutLab } from '@/components/layout-lab/LayoutLab';
import { useLabCatalogData, useLabDetail } from '@/components/layout-lab/useLabCatalogData';

describe('UI identity lab', () => {
  afterEach(cleanup);

  it('useLabCatalogData groups catalogs by category with counts', () => {
    const { result } = renderHook(() => useLabCatalogData());
    const groups = result.current;
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.find((g) => g.category === 'Economy / Meta')?.catalogs.some((c) => c.catalogId === 'currencies')).toBe(true);
  });

  it('useLabDetail returns entities + the fine pipeline steps for spellbook', () => {
    const { result } = renderHook(() => useLabDetail('spellbook'));
    expect(result.current?.entities.length).toBeGreaterThan(0);
    expect(result.current?.steps).toContain('Concept Brief & Fantasy');
    expect(result.current?.steps).toContain('UE Ability Asset Packaging');
  });

  it('renders the three tabs (Atelier + Soft removed)', () => {
    render(<LayoutLab />);
    for (const t of ['Forge', 'Blueprint', 'Studio']) {
      expect(screen.getByRole('button', { name: t })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: 'Atelier' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Soft' })).toBeNull();
  });

  it('selecting a catalog opens the detail screen with the pipeline', () => {
    render(<LayoutLab />);
    // default variant = Studio; hub shows catalog cards
    expect(screen.getByText('Asset Studio')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Spellbook/ }));
    // detail renders the fine pipeline steps
    expect(screen.getByText('Concept Brief & Fantasy')).toBeTruthy();
    expect(screen.getAllByText('Pipeline').length).toBeGreaterThan(0);
  });
});
