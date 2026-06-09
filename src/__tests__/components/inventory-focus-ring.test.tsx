/**
 * Regression guard for "Unify form focus states on the .focus-ring token".
 * Every form field across the inventory catalog / genome / economy UIs must use
 * the shared `.focus-ring-inset` utility (reading `--focus-accent`) — never a
 * hardcoded `focus:border-blue-500/50` / `focus:border-text-muted/50` snippet.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AddItemForm, type NewItemState } from '@/components/modules/core-engine/sub_inventory/catalog/AddItemForm';
import { CatalogFiltersBar } from '@/components/modules/core-engine/sub_inventory/catalog/CatalogFiltersBar';
import { TraitSlider } from '@/components/modules/core-engine/sub_inventory/dna-genome/TraitSlider';
import { AXIS_CONFIGS } from '@/components/modules/core-engine/sub_inventory/dna-genome/data';
import { ALL_ITEM_TYPES } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import type { TraitGene } from '@/types/item-genome';

afterEach(cleanup);

/** Class strings the requirement explicitly removes. */
const BANNED = ['border-blue-500', 'focus:border-text-muted'];

function expectNoHardcodedFocus(html: string) {
  for (const token of BANNED) expect(html).not.toContain(token);
}

describe('inventory form focus states are unified on .focus-ring token', () => {
  it('AddItemForm: every field uses focus-ring-inset under a --focus-accent region', () => {
    const newItem: NewItemState = { name: '', type: ALL_ITEM_TYPES[0], rarity: 'Common', description: '' };
    const { container } = render(
      <AddItemForm newItem={newItem} setNewItem={vi.fn()} isCliRunning={false} onCreate={vi.fn()} />,
    );
    // 1 text input + 2 selects + 1 textarea = 4 unified fields.
    expect(container.querySelectorAll('.focus-ring-inset').length).toBe(4);
    expect(container.querySelector('[style*="--focus-accent"]')).not.toBeNull();
    expectNoHardcodedFocus(container.innerHTML);
  });

  it('CatalogFiltersBar: search input + all selects use focus-ring-inset', () => {
    const { container } = render(
      <CatalogFiltersBar
        searchQuery="" setSearchQuery={vi.fn()}
        categoryFilter="all" setCategoryFilter={vi.fn()}
        subtypeFilter="all" setSubtypeFilter={vi.fn()}
        rarityFilter="all" setRarityFilter={vi.fn()}
        sortBy="name" setSortBy={vi.fn()}
        availableSubtypes={['Helmet']}
        filteredCount={0}
        showAddForm={false} setShowAddForm={vi.fn()}
        resetPage={vi.fn()}
      />,
    );
    // 1 search input + 4 selects.
    expect(container.querySelectorAll('.focus-ring-inset').length).toBe(5);
    expect(container.querySelector('[style*="--focus-accent"]')).not.toBeNull();
    expectNoHardcodedFocus(container.innerHTML);
  });

  it('TraitSlider: number input uses focus-ring-inset and the row sets --focus-accent', () => {
    const gene: TraitGene = { axis: 'offensive', weight: 0.5, affinityTags: ['Stat.Strength'] };
    const { container } = render(
      <TraitSlider gene={gene} config={AXIS_CONFIGS[0]} onChange={vi.fn()} />,
    );
    expect(container.querySelectorAll('.focus-ring-inset').length).toBe(1);
    expect(container.querySelector('[style*="--focus-accent"]')).not.toBeNull();
    expectNoHardcodedFocus(container.innerHTML);
  });
});
