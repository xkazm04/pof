import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AffixSunburst } from '@/components/modules/core-engine/sub_inventory/catalog/AffixSunburst';
import { AFFIX_PROB_TREE } from '@/components/modules/core-engine/sub_inventory/_shared/data';

afterEach(cleanup);

const arcLabels = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('svg g[role="img"]')).map((g) => g.getAttribute('aria-label') ?? '');
const pct = (label: string) => Number(/\((\d+)%/.exec(label)![1]);

/**
 * Arcs are normalised per sibling group, so the printed percentages must be the normalised
 * shares (they sum to 100 per group), and a ring-2 share must say which parent it is of.
 */
describe('AffixSunburst labels match the drawn arcs', () => {
  const tree = {
    id: 'r', label: 'R', probability: 1,
    children: [
      {
        id: 'a', label: 'A', probability: 0.6,
        children: [
          { id: 'a1', label: 'A1', probability: 0.3 },
          { id: 'a2', label: 'A2', probability: 0.3 },
        ],
      },
      { id: 'b', label: 'B', probability: 0.6 },
    ],
  };

  it('prints normalised shares on an unnormalised tree (children summing to 1.2)', () => {
    const { container } = render(<AffixSunburst tree={tree} size={260} />);
    const labels = arcLabels(container);
    const ring1 = labels.filter((l) => l.startsWith('A (') || l.startsWith('B ('));
    expect(ring1.map(pct)).toEqual([50, 50]);
    const ring2 = labels.filter((l) => l.startsWith('A1') || l.startsWith('A2'));
    expect(ring2.map(pct)).toEqual([50, 50]);
  });

  it('says which parent a ring-2 share is of', () => {
    const { container } = render(<AffixSunburst tree={tree} size={260} />);
    const labels = arcLabels(container);
    expect(labels.filter((l) => l.startsWith('A1') || l.startsWith('A2'))).toEqual([
      'A1 (50% of A)',
      'A2 (50% of A)',
    ]);
  });

  it('labels every shipped ring-2 arc as a share of its parent', () => {
    const { container } = render(<AffixSunburst tree={AFFIX_PROB_TREE} size={260} />);
    const ring2Count = (AFFIX_PROB_TREE.children ?? []).reduce((n, c) => n + (c.children?.length ?? 0), 0);
    const ofParent = arcLabels(container).filter((l) => / of [^)]+\)$/.test(l));
    expect(ofParent).toHaveLength(ring2Count);
  });
});
