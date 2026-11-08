import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AffixSunburst } from '@/components/modules/core-engine/sub_inventory/catalog/AffixSunburst';
import { AFFIX_PROB_TREE } from '@/components/modules/core-engine/sub_inventory/_shared/data';

afterEach(cleanup);

/**
 * The inner-ring text labels must name the inner-ring arcs. Arcs are pushed
 * child-then-its-grandchildren, so "the first N arcs" is NOT the N children as
 * soon as any child has grandchildren.
 */
function ringLabels(container: HTMLElement): string[] {
  // Ring labels are the pointer-events-none <text> nodes outside the tooltip group.
  return Array.from(container.querySelectorAll('svg > text.pointer-events-none')).map((t) => t.textContent ?? '');
}

describe('AffixSunburst inner-ring labels', () => {
  it('labels exactly the children of the root on the shipped tree', () => {
    const { container } = render(<AffixSunburst tree={AFFIX_PROB_TREE} size={260} />);
    expect(ringLabels(container)).toEqual(['0 Prefixes', '1 Prefix', '2 Prefixes']);
  });

  it('never labels a grandchild on the inner ring', () => {
    const tree = {
      id: 'r', label: 'R', probability: 1,
      children: [
        { id: 'a', label: 'A', probability: 0.5, children: [{ id: 'a1', label: 'A1', probability: 1 }] },
        { id: 'b', label: 'B', probability: 0.5 },
      ],
    };
    const { container } = render(<AffixSunburst tree={tree} size={260} />);
    expect(ringLabels(container)).toEqual(['A', 'B']);
  });
});
