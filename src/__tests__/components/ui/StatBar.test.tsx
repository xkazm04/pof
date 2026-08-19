import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StatBar } from '@/components/ui/StatBar';
import { STATUS_SUCCESS } from '@/lib/chart-colors';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

/** JSDOM serializes inline `style` color values as `rgb(r, g, b)`; convert for matching. */
function hexToRgb(hex: string): string {
  const m = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
  if (!m) throw new Error(`Bad hex: ${hex}`);
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
}

/** The fill is the single child nested inside the track (container > track > fill). */
function fillEl(container: HTMLElement): HTMLElement {
  return container.firstElementChild!.firstElementChild as HTMLElement;
}

describe('StatBar — shared meter primitive', () => {
  it('fills to the value with the given token color when animated', () => {
    const { container } = render(<StatBar value={72} color={STATUS_SUCCESS} animate />);
    const fill = fillEl(container);
    expect(fill.style.width).toBe('72%');
    // Color comes from the passed token, never a hardcoded hex.
    expect(fill.style.backgroundColor).toBe(hexToRgb(STATUS_SUCCESS));
  });

  it('renders an empty track before the grow-in (animate=false)', () => {
    const { container } = render(<StatBar value={72} color={STATUS_SUCCESS} animate={false} />);
    expect(fillEl(container).style.width).toBe('0%');
  });

  it('clamps the fill to 0–100 when overflow is not opted into', () => {
    const { container, rerender } = render(<StatBar value={150} color={STATUS_SUCCESS} animate />);
    expect(fillEl(container).style.width).toBe('100%');
    rerender(<StatBar value={-20} color={STATUS_SUCCESS} animate />);
    expect(fillEl(container).style.width).toBe('0%');
  });

  it('exposes a progressbar role with aria values when given an ariaLabel', () => {
    render(<StatBar value={64.6} color={STATUS_SUCCESS} ariaLabel="combat success rate" animate />);
    const bar = screen.getByRole('progressbar', { name: 'combat success rate' });
    expect(bar.getAttribute('aria-valuenow')).toBe('65');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('stays out of the a11y tree when decorative (no ariaLabel)', () => {
    render(<StatBar value={50} color={STATUS_SUCCESS} animate />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  // The same clamp lie MeterBar carried: 150 rendered identically to 100 with
  // hue as the sole cue. `overflow` opts into the shared honest geometry so the
  // two bar primitives cannot diverge on the rule.
  it('renders an over-100 value honestly when overflow is opted into', () => {
    const { container } = render(
      <StatBar value={150} color={STATUS_SUCCESS} animate overflow ariaLabel="texture memory" />,
    );
    expect(parseFloat(fillEl(container).style.width)).toBeCloseTo(100 / 1.5, 2);
    expect(container.querySelector('[data-meter-overflow]')).not.toBeNull();
    const bar = screen.getByRole('progressbar', { name: 'texture memory' });
    expect(bar.getAttribute('aria-valuenow')).toBe('150');
    expect(bar.getAttribute('aria-valuemax')).toBe('150');
    expect(bar.getAttribute('aria-valuetext')).toMatch(/over/i);
  });

  it('leaves the under-100 overflow path identical to the clamped one', () => {
    const { container } = render(
      <StatBar value={72} color={STATUS_SUCCESS} animate overflow />,
    );
    expect(fillEl(container).style.width).toBe('72%');
    expect(container.querySelector('[data-meter-overflow]')).toBeNull();
  });
});
