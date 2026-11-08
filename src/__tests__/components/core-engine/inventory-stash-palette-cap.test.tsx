import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SpatialStashPalette } from '@/components/modules/core-engine/sub_inventory/catalog/spatial-stash/SpatialStashPalette';
import { getInventoryItems } from '@/components/modules/core-engine/sub_inventory/_shared/useInventoryItems';

afterEach(cleanup);

/**
 * The stash palette renders at most 40 rows. With the seeded catalog (well over 40
 * items) the rest were silently unreachable unless the designer guessed a search;
 * the cap must say so.
 */
describe('stash palette row cap is announced', () => {
  it('says how many matches are hidden when the list is capped', () => {
    const total = getInventoryItems().length;
    expect(total).toBeGreaterThan(40); // the seed catalog trips the cap today
    const { container } = render(<SpatialStashPalette accent="currentColor" />);
    expect(container.textContent).toContain(`Showing 40 of ${total}`);
  });

  it('says nothing once the matches fit', () => {
    const { container } = render(<SpatialStashPalette accent="currentColor" />);
    fireEvent.change(container.querySelector('input')!, { target: { value: 'zzzz-no-such-item' } });
    expect(container.textContent).not.toContain('Showing 40 of');
  });
});
