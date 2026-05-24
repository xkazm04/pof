import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CatalogHubRoot } from '@/components/ecw/catalogs/CatalogHubRoot';
import { useEcwStore } from '@/stores/ecwStore';
import { useCatalogStore } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';

describe('CatalogHubRoot', () => {
  beforeEach(() => {
    useEcwStore.setState({ activeCatalogId: null, activeEntityId: null });
    // Reset catalog store to known-empty state across all 8 sections.
    const seeded: Record<string, Record<string, never>> = {};
    for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
    useCatalogStore.setState({ entitiesByCatalog: seeded });
  });
  afterEach(cleanup);

  it('renders 8 catalog rows', () => {
    render(<CatalogHubRoot />);
    for (const s of CATALOG_SECTIONS) {
      expect(screen.getByRole('button', { name: s.label })).toBeTruthy();
    }
  });

  it('clicking a row selects that catalog in ecwStore', () => {
    render(<CatalogHubRoot />);
    fireEvent.click(screen.getByRole('button', { name: 'Spellbook' }));
    expect(useEcwStore.getState().activeCatalogId).toBe('spellbook');
    expect(useEcwStore.getState().activeEntityId).toBeNull();
  });
});
