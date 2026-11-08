import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// The Weights pie and the Histogram glyph both label a rarity tier with a "%". That
// percent is the tier's SHARE of the total weight - the denominator the pie's slice
// angles already use. With weights that do not sum to 100, a raw weight printed with
// a % sign is a different number from the slice it labels.

vi.mock('@/components/modules/core-engine/sub_loot/_shared/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/modules/core-engine/sub_loot/_shared/data')>();
  const RARITY_TIERS = [
    { name: 'Common', color: actual.RARITY_TIERS[0].color, weight: 5 },
    { name: 'Rare', color: actual.RARITY_TIERS[2].color, weight: 3 },
    { name: 'Legendary', color: actual.RARITY_TIERS[4].color, weight: 2 },
  ];
  return { ...actual, RARITY_TIERS, TOTAL_WEIGHT: 10 };
});

const { WeightsMetric } = await import('@/components/modules/core-engine/sub_loot/metrics/WeightsMetric');
const { HistogramMetric } = await import('@/components/modules/core-engine/sub_loot/metrics/HistogramMetric');

afterEach(cleanup);

const titles = (root: HTMLElement) => Array.from(root.querySelectorAll('title')).map((t) => t.textContent ?? '');

describe('rarity weight glyph labels', () => {
  it('Weights pie labels each slice with its share of the total weight', () => {
    const { container } = render(<WeightsMetric />);
    expect(titles(container)).toEqual(['Common: 50%', 'Rare: 30%', 'Legendary: 20%']);
  });

  it('[control] Histogram already labels the same share', () => {
    const { container } = render(<HistogramMetric reading={{ value: 3, unit: 'brackets', basis: 'fixture' }} />);
    expect(titles(container)).toEqual(['Common: 50%', 'Rare: 30%', 'Legendary: 20%']);
  });
});
