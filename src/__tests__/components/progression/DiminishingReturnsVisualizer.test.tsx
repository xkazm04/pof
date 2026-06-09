import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { DiminishingReturnsVisualizer } from '@/components/modules/core-engine/sub_progression/analysis/DiminishingReturnsVisualizer';
import { STATUS_ERROR } from '@/lib/chart-colors';
import type { DRAttribute } from '@/components/modules/core-engine/sub_progression/_shared/data';

afterEach(cleanup);

const flat = (marginal: number): DRAttribute => ({
  name: 'Flat', color: STATUS_ERROR, softCap: 50,
  curve: [
    { points: 10, marginalValue: marginal },
    { points: 20, marginalValue: marginal },
  ],
});

const empty: DRAttribute = { name: 'Empty', color: STATUS_ERROR, softCap: 50, curve: [] };

describe('DiminishingReturnsVisualizer', () => {
  it('renders the real-data chart with a polyline and no NaN coordinates', () => {
    const { container } = render(<DiminishingReturnsVisualizer />);
    expect(container.querySelector('polyline')).toBeTruthy();
    expect(container.innerHTML).not.toContain('NaN');
  });

  it('shows an empty state (no polyline) for an all-zero, no-spread curve', () => {
    const { container } = render(<DiminishingReturnsVisualizer attributes={[flat(0)]} />);
    expect(container.querySelector('[role="status"]')).toBeTruthy();
    expect(container.querySelector('polyline')).toBeNull();
    expect(container.innerHTML).not.toContain('NaN');
  });

  it('shows an empty state for an empty series', () => {
    const { container } = render(<DiminishingReturnsVisualizer attributes={[empty]} />);
    expect(container.querySelector('[role="status"]')).toBeTruthy();
    expect(container.querySelector('polyline')).toBeNull();
    expect(container.innerHTML).not.toContain('NaN');
  });

  it('still plots a flat but non-zero curve (real spread against its own max)', () => {
    const { container } = render(<DiminishingReturnsVisualizer attributes={[flat(5)]} />);
    expect(container.querySelector('polyline')).toBeTruthy();
    expect(container.innerHTML).not.toContain('NaN');
  });
});
