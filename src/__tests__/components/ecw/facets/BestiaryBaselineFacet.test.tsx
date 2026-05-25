import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BestiaryBaselineFacet } from '@/components/ecw/facets/bestiary/BestiaryBaselineFacet';
import { useBaselineStore } from '@/stores/baselineStore';
import type { CatalogEntityBase } from '@/lib/catalog/types';
import type { BalanceBaseline } from '@/lib/balance/baseline';

function archEntity(id: string, hp: number, dmg: number): CatalogEntityBase {
  return {
    id, catalogId: 'bestiary', name: id, categoryPath: ['Bestiary'], tags: [], lifecycle: 'planned',
    data: { id, tier: 'major', stats: [{ label: 'Health', value: hp }, { label: 'Damage', value: dmg }], abilities: ['Hit'] },
  } as CatalogEntityBase;
}

describe('BestiaryBaselineFacet', () => {
  beforeEach(() => {
    useBaselineStore.setState({ baselineByEntity: {} });
    // The mount effect fetches; resolve it to "no baseline" so it never touches the network.
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ success: true, data: null }) })));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('prompts to capture when no baseline exists', () => {
    const e = archEntity('brute', 200, 50);
    render(<BestiaryBaselineFacet entity={e} />);
    expect(screen.getByText(/Capture baseline/i)).toBeTruthy();
    expect(screen.getByText(/No baseline captured/i)).toBeTruthy();
  });

  it('shows threat drift when a baseline is loaded', () => {
    const e = archEntity('brute', 200, 50); // current threat = 200*0.3 + 50*0.5 = 85
    const baseline: BalanceBaseline = {
      catalogId: 'bestiary', entityId: 'brute', threatScore: 70,
      stats: [{ label: 'Health', value: 200 }, { label: 'Damage', value: 20 }],
    };
    useBaselineStore.getState().loadBaseline('bestiary', 'brute', baseline);
    render(<BestiaryBaselineFacet entity={e} />);
    // delta = 85 - 70 = +15
    expect(screen.getByText(/\+15/)).toBeTruthy();
    expect(screen.getByText(/Recapture/i)).toBeTruthy();
    // Damage changed 20 → 50, so it appears in the stat-drift list.
    expect(screen.getByText('Damage')).toBeTruthy();
  });

  it('shows fallback when the entity has no stats', () => {
    const bad = { id: 'x', catalogId: 'bestiary', name: 'x', categoryPath: [], tags: [], lifecycle: 'planned', data: { id: 'x' } } as CatalogEntityBase;
    render(<BestiaryBaselineFacet entity={bad} />);
    expect(screen.getByText(/no stat data/i)).toBeTruthy();
  });
});
