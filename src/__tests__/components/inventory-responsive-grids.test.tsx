/**
 * Regression guard for "Responsive collapse for fixed multi-column grids".
 * The DNA EditorTab (was an unconditional `grid-cols-2`) and the catalog
 * AddItemForm field row (was `grid-cols-3`) must stack to a single column on
 * narrow viewports and only expand to multiple columns at the `md:` breakpoint
 * — consistent with the already-responsive catalog grid (`grid-cols-1 md:…`).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AddItemForm, type NewItemState } from '@/components/modules/core-engine/sub_inventory/catalog/AddItemForm';
import { EditorTab } from '@/components/modules/core-engine/sub_inventory/dna-genome/EditorTab';
import { PRESET_GENOMES, genomeToRadar } from '@/components/modules/core-engine/sub_inventory/dna-genome/data';
import { ALL_ITEM_TYPES } from '@/components/modules/core-engine/sub_inventory/_shared/data';

afterEach(cleanup);

describe('inventory multi-column grids collapse responsively', () => {
  it('AddItemForm: name/type/rarity row stacks (grid-cols-1) and expands at md (md:grid-cols-3)', () => {
    const newItem: NewItemState = { name: '', type: ALL_ITEM_TYPES[0], rarity: 'Common', description: '' };
    const { container } = render(
      <AddItemForm newItem={newItem} setNewItem={vi.fn()} isCliRunning={false} onCreate={vi.fn()} />,
    );
    const row = container.querySelector('[class*="md:grid-cols-3"]');
    expect(row).not.toBeNull();
    // Stacks on narrow screens — never a bare unconditional 3-column grid.
    expect(row!.className).toContain('grid-cols-1');
  });

  it('EditorTab: two-column layout stacks (grid-cols-1) and expands at md (md:grid-cols-2)', () => {
    const selected = PRESET_GENOMES[0];
    const { container } = render(
      <EditorTab
        selected={selected}
        radarData={genomeToRadar(selected)}
        genomeCount={2}
        updateGenome={vi.fn()}
        updateTrait={vi.fn()}
        deleteGenome={vi.fn()}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('grid-cols-1');
    expect(root.className).toContain('md:grid-cols-2');
  });
});
