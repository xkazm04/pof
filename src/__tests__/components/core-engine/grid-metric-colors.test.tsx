import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DUMMY_ITEMS, ALL_ITEM_TYPES } from '@/components/modules/core-engine/sub_inventory/_shared/data';

vi.mock('@/components/modules/core-engine/sub_inventory/_shared/useInventoryItems', () => ({
  useInventoryItems: () => DUMMY_ITEMS,
}));

import { GridMetric } from '@/components/modules/core-engine/sub_inventory/metrics/GridMetric';

afterEach(cleanup);

describe('GridMetric type bar', () => {
  it('gives every item type present in the catalog its own segment colour', () => {
    const { container } = render(<GridMetric />);
    const segments = Array.from(container.querySelectorAll('[aria-hidden="true"] > div')) as HTMLElement[];
    const typesPresent = new Set(DUMMY_ITEMS.map((i) => i.type));
    expect(typesPresent.size).toBe(ALL_ITEM_TYPES.length);
    expect(segments).toHaveLength(typesPresent.size);
    expect(new Set(segments.map((s) => s.style.backgroundColor)).size).toBe(typesPresent.size);
  });
});
