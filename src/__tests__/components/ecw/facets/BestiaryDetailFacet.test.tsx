import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BestiaryDetailFacet } from '@/components/ecw/facets/bestiary/BestiaryDetailFacet';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const sample: StoredCatalogEntity = {
  id: 'brute', catalogId: 'bestiary', name: 'Brute',
  categoryPath: ['Brute'], tags: [], lifecycle: 'verified',
  data: {
    id: 'brute', label: 'Brute',
    role: 'bruiser', tier: 'major', class: 'Tank', category: 'Standard',
    stats: [{ label: 'HP', value: 200 }, { label: 'DMG', value: 25 }],
    abilities: ['Charge', 'Smash'],
    color: '#f00',
  },
};

describe('BestiaryDetailFacet', () => {
  afterEach(cleanup);

  it('renders the archetype role + tier + class', () => {
    render(<BestiaryDetailFacet entity={sample} />);
    expect(screen.getByText(/bruiser/i)).toBeTruthy();
    expect(screen.getByText(/major/i)).toBeTruthy();
    expect(screen.getByText(/Tank/)).toBeTruthy();
  });

  it('renders each ability', () => {
    render(<BestiaryDetailFacet entity={sample} />);
    expect(screen.getByText('Charge')).toBeTruthy();
    expect(screen.getByText('Smash')).toBeTruthy();
  });

  it('renders each stat row', () => {
    render(<BestiaryDetailFacet entity={sample} />);
    expect(screen.getByText('HP')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText('DMG')).toBeTruthy();
    expect(screen.getByText('25')).toBeTruthy();
  });

  it('renders an empty-data fallback when entity.data is missing', () => {
    render(<BestiaryDetailFacet entity={{ ...sample, data: undefined }} />);
    expect(screen.getByText(/no archetype data/i)).toBeTruthy();
  });
});
