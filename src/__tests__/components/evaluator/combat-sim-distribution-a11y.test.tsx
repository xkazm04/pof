import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DistributionChart } from '@/components/modules/evaluator/CombatSimulatorView/DistributionChart';

afterEach(() => cleanup());

const buckets = [
  { min: 0, max: 10, count: 2 },
  { min: 10, max: 20, count: 6 },
  { min: 20, max: 30, count: 2 },
];

describe('DistributionChart — non-pointer text alternative', () => {
  it('exposes the chart as a labelled image carrying range, sample size, p50, p95 and the peak bucket', () => {
    const { container } = render(<DistributionChart title="Fight Duration" buckets={buckets} color="blue" unit="s" />);
    const img = container.querySelector('[role="img"]');
    expect(img).not.toBeNull();
    const label = img!.getAttribute('aria-label') ?? '';
    expect(label).toContain('Fight Duration');
    expect(label).toContain('10 fights');
    expect(label).toContain('0s to 30s');
    expect(label).toMatch(/median \(p50\) 15s/);
    expect(label).toMatch(/p95 \d+s/);
    expect(label).toContain('most common 10s-20s (6)');
  });

  it('keeps the bucket values in the accessibility tree rather than hover-only', () => {
    const { container } = render(<DistributionChart title="Damage Dealt" buckets={buckets} color="emerald" />);
    // Every bucket's value must be reachable from a labelled element — not only a hover tooltip.
    const label = container.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '';
    for (const b of buckets) expect(label).toContain(`${b.min}-${b.max}: ${b.count}`);
  });
});
