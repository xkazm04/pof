import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EntityCrossLinksPanel } from '@/components/ecw/inspector/EntityCrossLinksPanel';
import { useEcwStore } from '@/stores/ecwStore';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const base: StoredCatalogEntity = {
  id: 'brute', catalogId: 'bestiary', name: 'Brute',
  categoryPath: ['Brute'], tags: [], lifecycle: 'planned',
};

describe('EntityCrossLinksPanel', () => {
  beforeEach(() => useEcwStore.setState({ activeCatalogId: null, activeEntityId: null }));
  afterEach(cleanup);

  it('renders "No cross-catalog links" when entity has no links', () => {
    render(<EntityCrossLinksPanel entity={base} />);
    expect(screen.getByText(/no cross-catalog links/i)).toBeTruthy();
  });

  it('renders a row per link with role/catalog/entity', () => {
    const entity = {
      ...base,
      links: [
        { catalogId: 'spellbook', entityId: 'ga-fireball', role: 'ability' },
        { catalogId: 'loot-tables', entityId: 'lt-Brute', role: 'loot' },
      ],
    };
    render(<EntityCrossLinksPanel entity={entity} />);
    expect(screen.getByText('ability')).toBeTruthy();
    expect(screen.getByText(/ga-fireball/)).toBeTruthy();
    expect(screen.getByText('loot')).toBeTruthy();
    expect(screen.getByText(/lt-Brute/)).toBeTruthy();
  });

  it('clicking a link selects the entity via ecwStore', () => {
    const entity = {
      ...base,
      links: [{ catalogId: 'spellbook', entityId: 'ga-fireball', role: 'ability' }],
    };
    render(<EntityCrossLinksPanel entity={entity} />);
    fireEvent.click(screen.getByRole('button', { name: /jump to spellbook ga-fireball/i }));
    expect(useEcwStore.getState().activeCatalogId).toBe('spellbook');
    expect(useEcwStore.getState().activeEntityId).toBe('ga-fireball');
  });
});
