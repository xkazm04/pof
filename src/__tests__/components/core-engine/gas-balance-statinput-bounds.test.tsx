/**
 * StatInput's slider must never silently clamp an out-of-curated-range value
 * that arrived from outside the component (an imported scenario, validated
 * only against data.ts's much wider STAT_BOUNDS). A native <input
 * type="range"> clamps its displayed value to [min, max] on its own, so
 * without widening the effective bounds, touching the slider at all would
 * commit the clamped endpoint instead of the imported value.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StatInput } from '@/components/modules/core-engine/sub_ability/gas-balance/StatInput';

afterEach(cleanup);

describe('StatInput bounds', () => {
  it('widens max to the current value when it exceeds the curated range', () => {
    const { container } = render(
      <StatInput label="Strength" value={5000} onChange={vi.fn()} min={1} max={100} color="#fff" />,
    );
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(Number(input.max)).toBeGreaterThanOrEqual(5000);
    expect(input.value).toBe('5000');
  });

  it('widens min to the current value when it is below the curated range', () => {
    const { container } = render(
      <StatInput label="Armor" value={-50} onChange={vi.fn()} min={0} max={200} color="#fff" />,
    );
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(Number(input.min)).toBeLessThanOrEqual(-50);
    expect(input.value).toBe('-50');
  });

  it('keeps the curated range untouched for an in-range value', () => {
    const { container } = render(
      <StatInput label="Strength" value={30} onChange={vi.fn()} min={1} max={100} color="#fff" />,
    );
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(Number(input.min)).toBe(1);
    expect(Number(input.max)).toBe(100);
  });
});
