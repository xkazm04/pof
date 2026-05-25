import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CombatMapDetailFacet } from '@/components/ecw/facets/combat-map/CombatMapDetailFacet';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const sample: StoredCatalogEntity = {
  id: 'combo-sword-light', catalogId: 'combat-map', name: 'Sword Light',
  categoryPath: ['Combat Map', 'Sword'], tags: ['Sword'], lifecycle: 'planned',
  data: {
    id: 'sword-light', name: 'Sword Light',
    weaponCategory: 'Sword', hits: 3, totalTime: '1.2s', dps: 45,
    chain: ['Slash', 'Slash', 'Stab'],
  },
};

describe('CombatMapDetailFacet', () => {
  afterEach(cleanup);

  it('renders weapon category + hits + dps', () => {
    render(<CombatMapDetailFacet entity={sample} />);
    expect(screen.getByText(/Sword/)).toBeTruthy();
    expect(screen.getByText(/3 hits/i)).toBeTruthy();
    expect(screen.getByText(/45 DPS/i)).toBeTruthy();
  });

  it('renders each chain step in order', () => {
    render(<CombatMapDetailFacet entity={sample} />);
    const steps = screen.getAllByTestId('combat-chain-step');
    expect(steps).toHaveLength(3);
    expect(steps[0].textContent).toContain('Slash');
    expect(steps[2].textContent).toContain('Stab');
  });

  it('shows empty-data fallback when no data', () => {
    render(<CombatMapDetailFacet entity={{ ...sample, data: undefined }} />);
    expect(screen.getByText(/no combo data/i)).toBeTruthy();
  });
});
