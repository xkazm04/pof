import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ParamCue, ALL_CUE_KINDS } from '@/components/modules/evaluator/ParamCue';
import { ACCENT_VIOLET } from '@/lib/chart-colors';

// Test setup has no global afterEach(cleanup) — scope it here.
afterEach(cleanup);

describe('ParamCue', () => {
  it('renders every cue kind across the value range without crashing', () => {
    for (const kind of ALL_CUE_KINDS) {
      for (const value of [0, 0.5, 1]) {
        const { container } = render(
          <ParamCue kind={kind} value={value} accent={ACCENT_VIOLET} />,
        );
        const cue = container.querySelector(`[data-cue="${kind}"]`);
        expect(cue, `${kind} @ ${value}`).toBeTruthy();
        cleanup();
      }
    }
  });

  it('exposes an accessible image role and label', () => {
    const { getByRole } = render(
      <ParamCue kind="glow" value={0.5} accent={ACCENT_VIOLET} title="Glow Strength" />,
    );
    const img = getByRole('img');
    expect(img.getAttribute('aria-label')).toBe('Glow Strength');
  });

  it('clamps out-of-range and NaN values without throwing', () => {
    for (const value of [5, -3, Number.NaN]) {
      expect(() =>
        render(<ParamCue kind="level" value={value} accent={ACCENT_VIOLET} />),
      ).not.toThrow();
      cleanup();
    }
  });
});
