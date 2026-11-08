// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const kills = Array.from({ length: 97 }, (_, i) => i + 1);
const cohort = { kills, rate: 0.1, threshold: null, capped: false };

vi.mock('@/components/modules/core-engine/sub_loot/pity/usePityCohort', () => ({
  usePityCohort: () => ({
    pending: false,
    result: {
      pity: cohort,
      noPity: cohort,
      percentiles: [50, 95, 97],
      drift: { ok: true, observedP95: 95, analyticP95: 95 },
      benefit: { playersHelpedPct: 0, p99Saved: 0, worstCaseSaved: 0 },
    },
  }),
}));

import { PityCohortChart } from '@/components/modules/core-engine/sub_loot/pity/PityCohortChart';

afterEach(cleanup);

describe('PityCohortChart x domain', () => {
  it('max kill 97 (binW 3, 33 bins): each percentile marker sits inside the bar holding its kill', () => {
    const { container } = render(<PityCohortChart rate={0.1} threshold={null} color="currentColor" />);
    const rects = [...container.querySelectorAll('svg rect')].map((r) => ({
      x: Number(r.getAttribute('x')), w: Number(r.getAttribute('width')),
    }));
    expect(rects).toHaveLength(33);
    const binW = 3;
    const markers = [...container.querySelectorAll('svg line[stroke-dasharray]')].map((l) => Number(l.getAttribute('x1')));
    expect(markers).toHaveLength(3);
    [50, 95, 97].forEach((kill, i) => {
      const bar = rects[Math.floor((kill - 1) / binW)];
      // The bar is drawn bw-1 wide inside a bw slot; the marker may sit anywhere in the slot.
      expect(markers[i]).toBeGreaterThanOrEqual(bar.x);
      expect(markers[i]).toBeLessThanOrEqual(bar.x + bar.w + 1);
    });
  });
});
