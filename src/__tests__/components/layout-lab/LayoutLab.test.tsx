import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, renderHook } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { Fraunces: f, Oswald: f, IBM_Plex_Mono: f, Nunito: f, Inter: f, JetBrains_Mono: f };
});

import { LayoutLab } from '@/components/layout-lab/LayoutLab';
import { useLabCatalogData } from '@/components/layout-lab/useLabCatalogData';

describe('UI identity lab', () => {
  afterEach(cleanup);

  it('useLabCatalogData groups catalogs by category with counts', () => {
    const { result } = renderHook(() => useLabCatalogData());
    const groups = result.current;
    expect(groups.length).toBeGreaterThan(0);
    const econ = groups.find((g) => g.category === 'Economy / Meta');
    expect(econ?.catalogs.some((c) => c.catalogId === 'currencies')).toBe(true);
    // every catalog row carries label + numeric counts
    for (const g of groups) for (const c of g.catalogs) {
      expect(c.label).toBeTruthy();
      expect(typeof c.total).toBe('number');
    }
  });

  it('LayoutLab renders all five tabs and switches the active variant', () => {
    render(<LayoutLab />);
    for (const t of ['Atelier', 'Forge', 'Blueprint', 'Soft', 'Studio']) {
      expect(screen.getByRole('button', { name: t })).toBeTruthy();
    }
    // default = Atelier (its editorial title)
    expect(screen.getByText('The Catalog')).toBeTruthy();
    // switch to Forge → its variant mounts (its eyebrow), Atelier title gone
    fireEvent.click(screen.getByRole('button', { name: 'Forge' }));
    expect(screen.queryByText('The Catalog')).toBeNull();
    expect(screen.getByText(/Pillars of Fortune/)).toBeTruthy(); // Forge eyebrow
    // a real catalog label renders in the active variant
    expect(screen.getAllByText('Currencies').length).toBeGreaterThan(0);
  });
});
