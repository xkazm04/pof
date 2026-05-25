import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CatalogLiveGrid } from '@/components/ecw/live/CatalogLiveGrid';
import { useCatalogStore } from '@/stores/catalogStore';

describe('CatalogLiveGrid', () => {
  afterEach(cleanup);

  it('groups catalogs by category and shows the new catalogs', () => {
    render(<CatalogLiveGrid />);
    expect(screen.getByRole('heading', { name: 'Quests & Narrative' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Economy / Meta' })).toBeTruthy();
    expect(screen.getAllByText('Currencies').length).toBeGreaterThan(0);
  });

  it('reflects an entity lifecycle from the store', () => {
    useCatalogStore.setState((s) => ({
      entitiesByCatalog: {
        ...s.entitiesByCatalog,
        currencies: { 'currency-gold': { id: 'currency-gold', catalogId: 'currencies', name: 'Gold', categoryPath: [], tags: [], lifecycle: 'verified' } },
      },
    }));
    render(<CatalogLiveGrid />);
    expect(screen.getAllByText('Gold').length).toBeGreaterThan(0);
  });
});
