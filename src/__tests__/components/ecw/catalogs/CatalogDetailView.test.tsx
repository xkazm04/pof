import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CatalogDetailView } from '@/components/ecw/catalogs/CatalogDetailView';
import { useEcwStore } from '@/stores/ecwStore';
import { useCatalogStore } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { CatalogEntityBase } from '@/lib/catalog/types';

const sampleEntities: Record<string, CatalogEntityBase> = {
  a: { id: 'a', catalogId: 'spellbook', name: 'Fireball', categoryPath: ['Offensive'], tags: [], lifecycle: 'verified', ueAssets: ['/Script/PoF.GA_Fireball'] },
  b: { id: 'b', catalogId: 'spellbook', name: 'Heal', categoryPath: ['Support'], tags: [], lifecycle: 'planned' },
};

describe('CatalogDetailView', () => {
  beforeEach(() => {
    useEcwStore.setState({ activeCatalogId: 'spellbook', activeEntityId: null });
    const seeded: Record<string, Record<string, CatalogEntityBase>> = {};
    for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
    seeded.spellbook = sampleEntities;
    useCatalogStore.setState({ entitiesByCatalog: seeded });
  });
  afterEach(cleanup);

  it('renders the catalog label as header', () => {
    render(<CatalogDetailView catalogId="spellbook" />);
    expect(screen.getByRole('heading', { level: 1, name: /Spellbook/ })).toBeTruthy();
  });

  it('renders the back-to-hub button', () => {
    render(<CatalogDetailView catalogId="spellbook" />);
    expect(screen.getByRole('button', { name: /back to catalogs/i })).toBeTruthy();
  });

  it('back button clears selection in ecwStore', () => {
    render(<CatalogDetailView catalogId="spellbook" />);
    fireEvent.click(screen.getByRole('button', { name: /back to catalogs/i }));
    expect(useEcwStore.getState().activeCatalogId).toBeNull();
    expect(useEcwStore.getState().activeEntityId).toBeNull();
  });

  it('renders EmptyInspector if no entity selected', () => {
    render(<CatalogDetailView catalogId="spellbook" />);
    expect(screen.getByText(/Select an entity from a catalog/i)).toBeTruthy();
  });

  it('renders the EntityInspector for the selected entity', () => {
    useEcwStore.setState({ activeCatalogId: 'spellbook', activeEntityId: 'a' });
    render(<CatalogDetailView catalogId="spellbook" />);
    expect(screen.getByRole('heading', { level: 2, name: /Fireball/ })).toBeTruthy();
    expect(screen.getByText('/Script/PoF.GA_Fireball')).toBeTruthy();
  });

  it('renders the entity tree with all entities', () => {
    render(<CatalogDetailView catalogId="spellbook" />);
    expect(screen.getByText('Fireball')).toBeTruthy();
    expect(screen.getByText('Heal')).toBeTruthy();
  });
});
