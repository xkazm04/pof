import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CatalogsTab } from '@/components/ecw/catalogs/CatalogsTab';
import { useEcwStore } from '@/stores/ecwStore';
import { useCatalogStore } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';

describe('CatalogsTab', () => {
  beforeEach(() => {
    useEcwStore.setState({ activeCatalogId: null, activeEntityId: null });
    const seeded: Record<string, Record<string, never>> = {};
    for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
    useCatalogStore.setState({ entitiesByCatalog: seeded });
  });
  afterEach(cleanup);

  it('renders the hub root when no catalog selected', () => {
    render(<CatalogsTab />);
    expect(screen.getByRole('heading', { level: 1, name: /^Catalogs$/ })).toBeTruthy();
  });

  it('renders the catalog detail when a catalog is selected', () => {
    useEcwStore.setState({ activeCatalogId: 'spellbook', activeEntityId: null });
    render(<CatalogsTab />);
    expect(screen.getByRole('heading', { level: 1, name: /Spellbook/ })).toBeTruthy();
  });
});
