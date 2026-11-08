import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ImpactMetric } from '@/components/modules/core-engine/sub_loot/metrics/ImpactMetric';
import type { MetricReading } from '@/components/modules/core-engine/sub_loot/metrics/lootMetricsView';

// The Impact glyph prints the tuned-roster EV delta at one decimal. A real delta
// under 0.05 g/kill must not print a signed zero ("+0.0" / "-0.0"): that reads as
// "a direction, of zero size", which is neither the untuned +-0 nor the truth.

afterEach(cleanup);

const reading = (value: number | null): MetricReading => ({ value, unit: 'g/kill', basis: 'tuned', label: 'vs shipped' });
const printed = (value: number | null) => {
  const { container } = render(<ImpactMetric reading={reading(value)} />);
  return container.querySelector('.font-bold')?.textContent ?? '';
};

describe('ImpactMetric', () => {
  it('prints a sub-0.05 delta as a bounded magnitude with its sign, never a signed zero', () => {
    expect(printed(0.03)).toBe('+<0.1');
    expect(printed(-0.04)).toBe('-<0.1');
    for (const v of [0.03, -0.04, 0.049, -0.0001]) expect(printed(v)).not.toMatch(/^[+-]0\.0$/);
  });

  it('keeps exact zero as +-0 and ordinary deltas at one decimal', () => {
    expect(printed(0)).toBe('±0');
    expect(printed(2.46)).toBe('+2.5');
    expect(printed(-1.25)).toBe('-1.3');
    expect(printed(0.05)).toBe('+0.1');
  });
});
