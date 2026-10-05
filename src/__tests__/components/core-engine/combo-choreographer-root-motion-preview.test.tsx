/**
 * RootMotionPreview divides each section's cumulative distance by the total
 * root-motion distance to position it on the path. With zero total distance
 * that division is 0/0 — guarded by an early-return empty state instead of
 * letting every x-position collapse to NaN.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { RootMotionPreview } from '@/components/modules/content/animations/AIComboChoreographer/RootMotionPreview';
import type { ComboSection } from '@/components/modules/content/animations/AIComboChoreographer/types';

afterEach(cleanup);

function section(overrides: Partial<ComboSection> = {}): ComboSection {
  return {
    label: 'Slash 1',
    duration: 0.3,
    damage: 10,
    windows: [],
    rootMotionDistance: 0,
    motionWarpTarget: false,
    description: '',
    ...overrides,
  };
}

describe('RootMotionPreview', () => {
  it('shows the "no root motion" empty state instead of NaN positions when every section has 0 distance', () => {
    const sections = [section(), section({ label: 'Slash 2' })];
    const { container, getByText } = render(<RootMotionPreview sections={sections} />);

    expect(getByText('No root motion (0cm)')).toBeTruthy();
    // No NaN ever reaches an SVG attribute.
    const svg = container.querySelector('svg');
    expect(svg?.innerHTML.includes('NaN')).toBe(false);
  });

  it('positions sections proportionally along the path when distance is real', () => {
    const sections = [
      section({ label: 'Slash 1', rootMotionDistance: 100 }),
      section({ label: 'Slash 2', rootMotionDistance: 300 }),
    ];
    const { container, getByText } = render(<RootMotionPreview sections={sections} />);

    expect(getByText('Total: 400cm')).toBeTruthy();
    const lines = container.querySelectorAll('g line');
    expect(lines.length).toBe(2);
    // First segment spans 1/4 of the usable width (15..185), second spans the remaining 3/4.
    const [first, second] = Array.from(lines);
    const firstW = Number(second.getAttribute('x1')) - Number(first.getAttribute('x1'));
    const secondW = Number(second.getAttribute('x2')) - Number(second.getAttribute('x1'));
    expect(secondW).toBeGreaterThan(firstW * 2);
  });
});
