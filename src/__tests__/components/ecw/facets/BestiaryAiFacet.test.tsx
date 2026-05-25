import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BestiaryAiFacet } from '@/components/ecw/facets/bestiary/BestiaryAiFacet';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

function entityWithBt(bt: Record<string, string> | undefined): StoredCatalogEntity {
  return {
    id: 'brute', catalogId: 'bestiary', name: 'Brute', categoryPath: ['Bestiary'], tags: [], lifecycle: 'planned',
    data: bt ? { id: 'brute', btSummary: bt } : { id: 'brute' },
  } as StoredCatalogEntity;
}

describe('BestiaryAiFacet', () => {
  afterEach(cleanup);

  it('renders the coverage summary count', () => {
    render(<BestiaryAiFacet entity={entityWithBt({ aggro: 'chase', attack: 'swing' })} />);
    expect(screen.getByText(/2 \/ 4 core behaviors/i)).toBeTruthy();
  });

  it('shows covered behaviors with their detail', () => {
    render(<BestiaryAiFacet entity={entityWithBt({ aggro: 'chase within 800uu' })} />);
    expect(screen.getByText(/chase within 800uu/i)).toBeTruthy();
  });

  it('shows "not defined" for missing behaviors', () => {
    render(<BestiaryAiFacet entity={entityWithBt({ aggro: 'chase' })} />);
    expect(screen.getAllByText(/not defined/i).length).toBeGreaterThan(0);
  });

  it('shows fallback when no btSummary', () => {
    render(<BestiaryAiFacet entity={entityWithBt(undefined)} />);
    expect(screen.getByText(/no AI behavior summary/i)).toBeTruthy();
  });
});
