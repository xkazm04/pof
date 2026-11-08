import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import { ItemComparisonPanel } from '@/components/modules/core-engine/sub_inventory/catalog/ItemComparisonPanel';
import { SpatialStashPalette } from '@/components/modules/core-engine/sub_inventory/catalog/spatial-stash/SpatialStashPalette';

afterEach(cleanup);

/**
 * Every form control in the Catalog & Gear tab has an accessible name (WCAG 4.1.2).
 * The filter bar and Add Item form already label theirs; a placeholder or a
 * "— Slot A —" empty option is not a name.
 */
const ITEMS: ItemData[] = ['a', 'b'].map((id) => ({
  id, name: id.toUpperCase(), type: 'Weapon', subtype: 'Sword', rarity: 'Rare',
  stats: [{ label: 'Damage', value: '1', numericValue: 1, maxValue: 5 }], description: '',
}));

describe('catalog form controls are named', () => {
  it('comparison slot selects', () => {
    render(<ItemComparisonPanel items={ITEMS} />);
    fireEvent.click(screen.getByText('Weapon'));
    fireEvent.click(screen.getByText('Add Slot'));
    const names = Array.from(document.querySelectorAll('select')).map((s) => s.getAttribute('aria-label'));
    expect(names).toEqual(['Comparison slot A', 'Comparison slot B', 'Comparison slot C']);
  });

  it('stash palette search input', () => {
    render(<SpatialStashPalette accent="currentColor" />);
    const input = document.querySelector('input')!;
    expect(input.getAttribute('aria-label')).toBe('Search stash palette items');
  });
});
