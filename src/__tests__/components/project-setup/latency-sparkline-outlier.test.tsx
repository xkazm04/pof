/** One timed-out probe must not flatten the healthy samples, and the dropout stays marked. */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { LatencySparkline } from '@/components/modules/project-setup/BridgeEndpointHealth/LatencySparkline';

afterEach(() => cleanup());

const HEALTHY = [5, 9, 5, 12, 6, 5];

function ys(samples: number[]): number[] {
  const { container } = render(<LatencySparkline samples={samples} gradientId="g" />);
  const pts = container.querySelector('polyline')!.getAttribute('points')!.split(' ');
  return pts.map((p) => Number(p.split(',')[1]));
}
const spread = (v: number[]) => Math.max(...v) - Math.min(...v);

describe('LatencySparkline after a timeout', () => {
  it('healthy samples keep at least half of their pre-timeout y spread', () => {
    const before = spread(ys(HEALTHY));
    cleanup();
    const afterTimeout = ys([...HEALTHY, 3000]).slice(0, HEALTHY.length);
    expect(spread(afterTimeout)).toBeGreaterThanOrEqual(before * 0.5);
  });

  it('the timeout point is still drawn at the top and marked as a dropout', () => {
    const all = ys([...HEALTHY, 3000]);
    expect(all[all.length - 1]).toBe(Math.min(...all));
    const { container } = render(<LatencySparkline samples={[...HEALTHY, 3000]} gradientId="g2" />);
    expect(container.querySelectorAll('[data-dropout]').length).toBe(1);
  });

  it('a healthy-only series draws no dropout marker', () => {
    const { container } = render(<LatencySparkline samples={HEALTHY} gradientId="g3" />);
    expect(container.querySelectorAll('[data-dropout]').length).toBe(0);
  });
});
