import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { createStashTab, type StashTab } from '@/lib/spatial-inventory';
import { SpatialStashGrid } from '@/components/modules/core-engine/sub_inventory/catalog/spatial-stash/SpatialStashGrid';
import { getInventoryItems } from '@/components/modules/core-engine/sub_inventory/_shared/useInventoryItems';

afterEach(cleanup);

/**
 * A placed stash tile's Rotate / Remove buttons are reachable by Tab, so they must
 * (a) become visible when focused, not only on mouse hover (WCAG 2.4.7), and
 * (b) say WHICH item they act on — a grid of identical "Rotate"/"Remove" names
 * is indistinguishable to a screen reader.
 */
function tabWith(itemIds: string[]): StashTab {
  return {
    ...createStashTab('t', 'T', 8, 8),
    items: itemIds.map((itemId, i) => ({ id: `p${i}`, itemId, x: i * 2, y: 0, w: 1, h: 1, rotated: false })),
  };
}

describe('stash tile controls', () => {
  it('name the item they act on', () => {
    const [a, b] = getInventoryItems();
    render(<SpatialStashGrid tab={tabWith([a.id, b.id])} accent="currentColor" />);
    const labels = Array.from(document.querySelectorAll('button')).map((el) => el.getAttribute('aria-label'));
    expect(labels).toEqual([`Rotate ${a.name}`, `Remove ${a.name}`, `Rotate ${b.name}`, `Remove ${b.name}`]);
  });

  it('are revealed on keyboard focus, not only on hover', () => {
    const [a] = getInventoryItems();
    render(<SpatialStashGrid tab={tabWith([a.id])} accent="currentColor" />);
    const bar = document.querySelector('button')!.parentElement!;
    expect(bar.className).toContain('group-hover:opacity-100');
    expect(bar.className).toContain('group-focus-within:opacity-100');
  });
});
