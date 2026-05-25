import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CombatBaselineFacet } from '@/components/ecw/facets/combat-map/CombatBaselineFacet';
import { useBaselineStore } from '@/stores/baselineStore';
import type { CatalogEntityBase } from '@/lib/catalog/types';
import type { BalanceBaseline } from '@/lib/balance/baseline';

function comboEntity(id: string, dps: number): CatalogEntityBase {
  return {
    id, catalogId: 'combat-map', name: id, categoryPath: ['Combat Map', 'Sword'], tags: ['Sword'], lifecycle: 'planned',
    data: { id, name: id, weaponCategory: 'Sword', hits: 3, totalTime: '1.5s', dps, chain: ['a', 'b', 'c'] },
  } as CatalogEntityBase;
}

describe('CombatBaselineFacet', () => {
  beforeEach(() => {
    useBaselineStore.setState({ baselineByEntity: {} });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ success: true, data: null }) })));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('prompts to capture a DPS baseline when none exists', () => {
    render(<CombatBaselineFacet entity={comboEntity('cb-sw', 245)} />);
    expect(screen.getByText(/DPS Baseline/i)).toBeTruthy();
    expect(screen.getByText(/No baseline captured/i)).toBeTruthy();
  });

  it('shows DPS drift when a baseline is loaded', () => {
    const baseline: BalanceBaseline = {
      catalogId: 'combat-map', entityId: 'cb-sw', threatScore: 200,
      stats: [{ label: 'Hits', value: 3 }, { label: 'Total dmg', value: 300 }],
    };
    useBaselineStore.getState().loadBaseline('combat-map', 'cb-sw', baseline);
    render(<CombatBaselineFacet entity={comboEntity('cb-sw', 245)} />);
    // current DPS 245 vs baseline 200 → +45
    expect(screen.getByText(/\+45/)).toBeTruthy();
    expect(screen.getByText(/Recapture/i)).toBeTruthy();
  });

  it('shows a fallback for non-combo data', () => {
    const bad = { id: 'x', catalogId: 'combat-map', name: 'x', categoryPath: [], tags: [], lifecycle: 'planned', data: { id: 'x' } } as CatalogEntityBase;
    render(<CombatBaselineFacet entity={bad} />);
    expect(screen.getByText(/no combo data to baseline/i)).toBeTruthy();
  });
});
