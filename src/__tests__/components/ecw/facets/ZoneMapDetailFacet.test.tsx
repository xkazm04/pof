import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ZoneMapDetailFacet } from '@/components/ecw/facets/zone-map/ZoneMapDetailFacet';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const sample: StoredCatalogEntity = {
  id: 'zone-arena', catalogId: 'zone-map', name: 'Arena',
  categoryPath: ['Zones', 'Combat'], tags: ['combat'], lifecycle: 'planned',
  data: {
    id: 'arena', displayName: 'Combat Arena',
    type: 'combat', status: 'active',
    levelRange: '5-10', levelMin: 5, levelMax: 10,
    connections: ['hub', 'boss-lair'],
  },
};

describe('ZoneMapDetailFacet', () => {
  afterEach(cleanup);

  it('renders zone type + status + level range', () => {
    render(<ZoneMapDetailFacet entity={sample} />);
    expect(screen.getByText(/combat/i)).toBeTruthy();
    expect(screen.getByText(/active/i)).toBeTruthy();
    expect(screen.getByText(/5-10/)).toBeTruthy();
  });

  it('renders each connection', () => {
    render(<ZoneMapDetailFacet entity={sample} />);
    expect(screen.getByText('hub')).toBeTruthy();
    expect(screen.getByText('boss-lair')).toBeTruthy();
  });

  it('shows empty-data fallback', () => {
    render(<ZoneMapDetailFacet entity={{ ...sample, data: undefined }} />);
    expect(screen.getByText(/no zone data/i)).toBeTruthy();
  });
});
