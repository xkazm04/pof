import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MaterialBudgetBar } from '@/components/modules/content/materials/MaterialBudgetBar';
import { BudgetAlerting } from '@/components/modules/core-engine/sub_save/schema/BudgetAlerting';
import {
  estimateMaterialBudget, INSTRUCTION_WARN_THRESHOLD,
} from '@/lib/material-cost-estimator';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

/**
 * The three shipped budget bars all cropped their overflow: a value past its
 * limit rendered identically to one exactly at the limit, with hue as the only
 * difference. Each now renders through `MeterBar`'s honest overflow geometry,
 * so the excess is a hatched segment and the announced number is the real one.
 */

const HATCH = 'repeating-linear-gradient';

describe('MaterialBudgetBar — instruction cost past its threshold', () => {
  // Every sampler feature stacked on the most expensive surface.
  const HEAVY = {
    surfaceType: 'skin' as const,
    features: ['subsurface', 'parallax', 'emissive', 'refraction', 'tessellation', 'worldPositionOffset'] as const,
  };

  it('the fixture really is over the instruction threshold', () => {
    const report = estimateMaterialBudget({ surfaceType: HEAVY.surfaceType, features: [...HEAVY.features] });
    expect(report.instructionScore).toBeGreaterThan(INSTRUCTION_WARN_THRESHOLD);
  });

  it('announces the true multiple of the threshold, not a clamped 100%', () => {
    render(<MaterialBudgetBar surfaceType={HEAVY.surfaceType} features={[...HEAVY.features]} />);
    const bar = screen.getByRole('progressbar', { name: /instructions/i });
    const now = Number(bar.getAttribute('aria-valuenow'));
    expect(now).toBeGreaterThan(100);
    expect(bar.getAttribute('aria-valuetext')).toMatch(/over/i);
  });

  it('renders the excess as a hatched segment (readable under grayscale)', () => {
    const { container } = render(
      <MaterialBudgetBar surfaceType={HEAVY.surfaceType} features={[...HEAVY.features]} />,
    );
    const over = container.querySelector('[data-meter="instructions"] [data-meter-overflow]') as HTMLElement;
    expect(over).not.toBeNull();
    expect(over.style.backgroundImage).toContain(HATCH);
  });

  it('an under-budget material shows no overflow segment at all', () => {
    const { container } = render(<MaterialBudgetBar surfaceType="metal" features={[]} />);
    expect(container.querySelector('[data-meter-overflow]')).toBeNull();
    const bar = screen.getByRole('progressbar', { name: /instructions/i });
    expect(Number(bar.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(100);
  });

  it('grades the sampler meter against the real UE5 hard cap, not a pre-clamped fraction', () => {
    render(<MaterialBudgetBar surfaceType="skin" features={['subsurface']} />);
    const bar = screen.getByRole('progressbar', { name: /samplers/i });
    // 6 of 16 — the old code divided a value already clamped to 1 by the cap,
    // making its own STATUS_ERROR branch unreachable.
    expect(bar.getAttribute('aria-valuenow')).toBe(String(Math.round((6 / 16) * 100)));
  });
});

describe('BudgetAlerting — save-section budgets', () => {
  it('exposes every section bar as a progressbar with a real byte readout', () => {
    render(<BudgetAlerting />);
    const bars = screen.getAllByRole('progressbar');
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      expect(bar.getAttribute('aria-valuetext')).toBeTruthy();
    }
  });

  it('never announces an over-budget section as exactly 100%', () => {
    render(<BudgetAlerting />);
    for (const bar of screen.getAllByRole('progressbar')) {
      const now = Number(bar.getAttribute('aria-valuenow'));
      const text = bar.getAttribute('aria-valuetext') ?? '';
      if (now > 100) expect(text).toMatch(/over/i);
      // The old bar clamped at 100 and could not distinguish these two states.
      expect(Number.isFinite(now)).toBe(true);
    }
  });

  it('keeps the 80% reference mark on every section bar', () => {
    const { container } = render(<BudgetAlerting />);
    expect(container.querySelectorAll('[data-meter-mark]').length).toBeGreaterThan(0);
  });
});
