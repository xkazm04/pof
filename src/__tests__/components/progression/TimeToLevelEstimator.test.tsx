import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { TimeToLevelEstimator } from '@/components/modules/core-engine/sub_progression/rewards/TimeToLevelEstimator';

afterEach(cleanup);

const width = (el: HTMLElement) => parseFloat(el.style.width);

describe('TimeToLevelEstimator derives from the live curve', () => {
  it('case 2: casual and hardcore rows differ; the hardcore bar is 12.5% of the casual bar', () => {
    render(<TimeToLevelEstimator baseXp={100} curveExp={1.5} />);
    expect(screen.getByTestId('ttl-row-casual').textContent).toContain('7.97 days to max');
    expect(screen.getByTestId('ttl-row-hardcore').textContent).toContain('1.00 days to max');
    const cBar = screen.getByTestId('ttl-bar-casual');
    const hBar = screen.getByTestId('ttl-bar-hardcore');
    expect(width(cBar)).toBeCloseTo(100, 6);
    expect(width(hBar) / width(cBar)).toBeCloseTo(0.125, 6);
  });

  it('case 3: casual days-to-max follows the curve exponent (7.97 at 1.5 -> 42.50 at 2.0)', () => {
    const { unmount } = render(<TimeToLevelEstimator baseXp={100} curveExp={1.5} />);
    const at15 = screen.getByTestId('ttl-row-casual').textContent;
    unmount();
    render(<TimeToLevelEstimator baseXp={100} curveExp={2.0} />);
    const at20 = screen.getByTestId('ttl-row-casual').textContent;
    expect(at15).toContain('7.97 days');
    expect(at20).toContain('42.50 days');
    expect(at20).not.toEqual(at15);
    // the rate basis is stated next to the figure
    expect(screen.getByTestId('ttl-rate-basis').textContent).toContain('100 XP/min');
  });
});
