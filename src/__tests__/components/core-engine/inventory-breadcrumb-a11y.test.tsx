import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useTabFeatures', () => ({
  useTabFeatures: () => ({ featureMap: new Map(), stats: { total: 0, implemented: 0, partial: 0, missing: 0 }, features: [], defs: [], isLoading: false }),
}));
vi.mock('@/components/modules/core-engine/sub_inventory/catalog/CatalogGearTab', () => ({ CatalogGearTab: () => <div>gear-stub</div> }));
vi.mock('@/components/modules/core-engine/sub_inventory/economy/EconomySourcingTab', () => ({ EconomySourcingTab: () => <div>sourcing-stub</div> }));

import { ItemCatalog } from '@/components/modules/core-engine/sub_inventory';
import { SUBTABS } from '@/components/modules/core-engine/sub_inventory/_shared/data';

afterEach(cleanup);

/** The breadcrumb buttons: those whose text is a narrative label. */
function breadcrumb(container: HTMLElement) {
  const labels = new Set(['Catalog', ...SUBTABS.map((t) => t.narrative)]);
  return Array.from(container.querySelectorAll('button')).filter((b) => labels.has(b.textContent ?? '') && b.className.includes('px-1.5'));
}

describe('Item Catalog narrative breadcrumb', () => {
  it('exposes exactly one current step and does not fade future steps with opacity', () => {
    const { container } = render(<ItemCatalog moduleId="arpg-inventory" />);
    const crumbs = breadcrumb(container);
    expect(crumbs.length).toBe(1 + SUBTABS.length);
    expect(crumbs.filter((b) => b.getAttribute('aria-current') === 'step')).toHaveLength(1);
    const future = crumbs.filter((b) => b.getAttribute('aria-current') === null && b.style.color === 'var(--text-subtle)');
    expect(future.length).toBeGreaterThan(0);
    for (const b of crumbs) expect(b.style.opacity).toBe('');
  });

  it('moves aria-current when the step changes', () => {
    const { container } = render(<ItemCatalog moduleId="arpg-inventory" />);
    const target = breadcrumb(container).find((b) => b.getAttribute('aria-current') === null)!;
    fireEvent.click(target);
    const now = breadcrumb(container);
    expect(now.filter((b) => b.getAttribute('aria-current') === 'step')).toEqual([now.find((b) => b.textContent === target.textContent)]);
  });
});
