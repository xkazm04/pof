import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LootBaselineFacet } from '@/components/ecw/facets/loot/LootBaselineFacet';
import { useBaselineStore } from '@/stores/baselineStore';
import type { CatalogEntityBase } from '@/lib/catalog/types';
import type { BalanceBaseline } from '@/lib/balance/baseline';

function lootEntity(id: string): CatalogEntityBase {
  return {
    id, catalogId: 'loot-tables', name: id, categoryPath: ['Loot Tables'], tags: [], lifecycle: 'planned',
    data: { lootTableName: id, dropChance: 0.3, rarityWeights: [60, 25, 10, 4, 1], bonusGold: 15 },
  } as CatalogEntityBase; // EV = 24
}

describe('LootBaselineFacet', () => {
  beforeEach(() => {
    useBaselineStore.setState({ baselineByEntity: {} });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ success: true, data: null }) })));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('prompts to capture an EV baseline when none exists', () => {
    render(<LootBaselineFacet entity={lootEntity('LT_Grunt')} />);
    expect(screen.getByText(/EV Baseline/i)).toBeTruthy();
    expect(screen.getByText(/No baseline captured/i)).toBeTruthy();
  });

  it('shows EV drift when a baseline is loaded', () => {
    const baseline: BalanceBaseline = {
      catalogId: 'loot-tables', entityId: 'LT_Grunt', threatScore: 20,
      stats: [{ label: 'Common', value: 1 }],
    };
    useBaselineStore.getState().loadBaseline('loot-tables', 'LT_Grunt', baseline);
    render(<LootBaselineFacet entity={lootEntity('LT_Grunt')} />);
    // current EV 24 vs baseline 20 → +4
    expect(screen.getByText(/\+4/)).toBeTruthy();
    expect(screen.getByText(/Recapture/i)).toBeTruthy();
  });

  it('shows a fallback for an entity without a loot binding', () => {
    const bad = { id: 'x', catalogId: 'loot-tables', name: 'x', categoryPath: [], tags: [], lifecycle: 'planned', data: { id: 'x' } } as CatalogEntityBase;
    render(<LootBaselineFacet entity={bad} />);
    expect(screen.getByText(/no loot binding to baseline/i)).toBeTruthy();
  });
});
