import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RegressionBanner } from '@/components/modules/evaluator/RegressionBanner';
import type { RegressionDiff } from '@/lib/evaluator/regression-diff';

afterEach(() => cleanup());

function makeDiff(over: Partial<RegressionDiff['summary']> & { hasPrevious?: boolean }): RegressionDiff {
  const { hasPrevious = true, ...summary } = over;
  return {
    hasPrevious,
    tagged: [],
    resolved: [],
    statusById: {},
    summary: {
      new: { critical: 0, high: 0, medium: 0, low: 0 },
      resolved: { critical: 0, high: 0, medium: 0, low: 0 },
      persisting: { critical: 0, high: 0, medium: 0, low: 0 },
      newTotal: 0,
      resolvedTotal: 0,
      persistingTotal: 0,
      ...summary,
    },
  };
}

describe('RegressionBanner', () => {
  it('shows a baseline message when there is no previous scan', () => {
    const diff = makeDiff({ hasPrevious: false });
    render(<RegressionBanner diff={diff} view="all" onViewChange={() => {}} totalFindings={5} />);
    expect(screen.getByText(/baseline/i)).toBeTruthy();
  });

  it('renders new severity deltas and a resolved count', () => {
    const diff = makeDiff({
      new: { critical: 3, high: 0, medium: 0, low: 0 },
      newTotal: 3,
      resolved: { critical: 0, high: 0, medium: 0, low: 0 },
      resolvedTotal: 5,
    });
    const { container } = render(
      <RegressionBanner diff={diff} view="new" onViewChange={() => {}} totalFindings={10} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('3');
    expect(text.toLowerCase()).toContain('critical');
    expect(text).toContain('5');
    expect(text.toLowerCase()).toContain('resolved');
  });

  it('shows a no-change message when nothing changed since the last scan', () => {
    const diff = makeDiff({ newTotal: 0, resolvedTotal: 0 });
    render(<RegressionBanner diff={diff} view="all" onViewChange={() => {}} totalFindings={4} />);
    expect(screen.getByText(/no change/i)).toBeTruthy();
  });

  it('fires onViewChange when toggling between New and All', () => {
    const onViewChange = vi.fn();
    const diff = makeDiff({ newTotal: 2, resolvedTotal: 0 });
    render(<RegressionBanner diff={diff} view="new" onViewChange={onViewChange} totalFindings={9} />);

    fireEvent.click(screen.getByTestId('pof-regression-view-all'));
    expect(onViewChange).toHaveBeenCalledWith('all');

    fireEvent.click(screen.getByTestId('pof-regression-view-new'));
    expect(onViewChange).toHaveBeenCalledWith('new');
  });
});
