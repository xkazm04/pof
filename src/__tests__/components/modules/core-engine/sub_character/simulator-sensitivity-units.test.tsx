import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SensitivityChart } from '@/components/modules/core-engine/sub_character/simulator/predictive/SensitivityChart';
import type { SensitivityCurve } from '@/components/modules/core-engine/sub_character/simulator/predictive/data';

afterEach(cleanup);

const curve = (attribute: string, values: number[]): SensitivityCurve => ({
  attribute,
  points: values.map((value, i) => ({ value, survivalRate: 0.5 + i * 0.1, avgTTK: 10 })),
  diminishingAt: null,
} as unknown as SensitivityCurve);

/** Hover the first point: jsdom's rect is all zeros, so clientX = svg x, and point 0 sits at pad.l = 36. */
const tooltipOf = (c: SensitivityCurve) => {
  const { container } = render(<SensitivityChart curve={c} width={220} height={120} color="var(--text)" />);
  fireEvent.mouseMove(container.querySelector('svg')!, { clientX: 36 });
  return container.querySelector('foreignObject')?.textContent ?? '';
};

describe('SensitivityChart — the tooltip states a value in the same unit as its axis', () => {
  it('shows critChance as a percent in the tooltip, as the axis does', () => {
    const c = curve('critChance', [0.05, 0.15, 0.25]);
    const { container } = render(<SensitivityChart curve={c} width={220} height={120} color="var(--text)" />);
    const axis = [...container.querySelectorAll('svg > text')].map(t => t.textContent).join(' ');
    expect(axis).toContain('5%');
    cleanup();
    const tip = tooltipOf(c);
    expect(tip).toContain('critChance: 5%');
    expect(tip).not.toContain('0.05');
  });

  it('keeps whole numbers for flat attributes', () => {
    expect(tooltipOf(curve('armor', [12, 40, 80]))).toContain('armor: 12');
  });
});
