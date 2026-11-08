import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

/**
 * scan-sweep inventory-genome-economy: the Inventory Capacity Planner sits on the live
 * spatial stash, but Total Value printed the constant 2450g even for an empty stash.
 */

vi.mock('@/stores/spatialInventoryStore', () => ({
  useAllStashTabs: () => [],
  spatialItemLookup: () => undefined,
}));

import { EconomySourcingTab } from '@/components/modules/core-engine/sub_inventory/economy/EconomySourcingTab';

afterEach(cleanup);

describe('Total Value in the capacity planner', () => {
  it('an empty stash does not report the static 2450g', () => {
    const { container } = render(<EconomySourcingTab />);
    const line = Array.from(container.querySelectorAll('p')).find((p) => /Total Value/.test(p.textContent ?? ''));
    expect(line).toBeTruthy();
    const text = line!.textContent ?? '';
    expect(text.includes('2450')).toBe(false);
    expect(/0g/.test(text)).toBe(true);
  });
});
