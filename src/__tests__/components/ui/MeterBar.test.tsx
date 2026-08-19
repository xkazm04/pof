import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MeterBar, resolveMeterScale } from '@/components/ui/MeterBar';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import { STATUS_TOKENS } from '@/lib/status-token';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

/** JSDOM serializes inline `style` color values as `rgb(r, g, b)`; convert for matching. */
function hexToRgb(hex: string): string {
  const m = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
  if (!m) throw new Error(`Bad hex: ${hex}`);
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
}

/** The fill is the single child nested inside the track (track > fill). */
function fillEl(container: HTMLElement): HTMLElement {
  return container.firstElementChild!.firstElementChild as HTMLElement;
}

describe('MeterBar — shared progress meter primitive', () => {
  it('exposes a progressbar role with aria-valuenow/min/max and an accessible name', () => {
    render(<MeterBar value={64.6} color={STATUS_SUCCESS} ariaLabel="combat coverage" />);
    const bar = screen.getByRole('progressbar', { name: 'combat coverage' });
    expect(bar.getAttribute('aria-valuenow')).toBe('65'); // rounded
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('derives the fill percent from value / max', () => {
    const { container } = render(<MeterBar value={3} max={12} color={STATUS_SUCCESS} ariaLabel="findings" />);
    expect(fillEl(container).style.width).toBe('25%');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25');
  });

  it('treats value as an already-resolved percent when max is omitted (default 100)', () => {
    const { container } = render(<MeterBar value={72} color={STATUS_SUCCESS} ariaLabel="rate" />);
    expect(fillEl(container).style.width).toBe('72%');
  });

  it('paints the fill with a static token color', () => {
    const { container } = render(<MeterBar value={50} color={STATUS_SUCCESS} ariaLabel="rate" />);
    expect(fillEl(container).style.backgroundColor).toBe(hexToRgb(STATUS_SUCCESS));
  });

  it('resolves threshold coloring from a (pct) => color function', () => {
    const band = (pct: number) => (pct >= 80 ? STATUS_SUCCESS : pct >= 50 ? STATUS_WARNING : STATUS_ERROR);
    const { container: hi } = render(<MeterBar value={90} color={band} ariaLabel="hi" />);
    expect(fillEl(hi).style.backgroundColor).toBe(hexToRgb(STATUS_SUCCESS));
    const { container: lo } = render(<MeterBar value={20} color={band} ariaLabel="lo" />);
    expect(fillEl(lo).style.backgroundColor).toBe(hexToRgb(STATUS_ERROR));
  });

  it('clamps the fill and aria-valuenow to 0–100 when overflow is not opted into', () => {
    const { container, rerender } = render(<MeterBar value={150} color={STATUS_SUCCESS} ariaLabel="rate" />);
    expect(fillEl(container).style.width).toBe('100%');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    rerender(<MeterBar value={-20} color={STATUS_SUCCESS} ariaLabel="rate" />);
    expect(fillEl(container).style.width).toBe('0%');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('defaults aria-valuetext to the rounded percent but honors an explicit value text', () => {
    const { rerender } = render(<MeterBar value={3} max={12} color={STATUS_SUCCESS} ariaLabel="findings" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('25%');
    rerender(<MeterBar value={3} max={12} color={STATUS_SUCCESS} ariaLabel="findings" valueText="3 of 12" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('3 of 12');
  });

  it('guards against a zero or negative max', () => {
    const { container } = render(<MeterBar value={5} max={0} color={STATUS_SUCCESS} ariaLabel="rate" />);
    expect(fillEl(container).style.width).toBe('0%');
  });

  it('drives the grow-in via the shared CSS class so reduced motion is handled globally', () => {
    const { container } = render(<MeterBar value={40} color={STATUS_SUCCESS} ariaLabel="rate" delayMs={150} />);
    const fill = fillEl(container);
    expect(fill.className).toContain('meter-fill-grow');
    expect(fill.style.getPropertyValue('--meter-grow-delay')).toBe('150ms');
  });
});

// ---------------------------------------------------------------------------
// Over-budget honesty: a clamped meter renders 150-of-100 identically to
// 100-of-100 and announces "100%". Opt-in `overflow` rescales the track so the
// limit sits at a tick and the excess is a hatched segment (shape cue #2).
// ---------------------------------------------------------------------------

/** The overflow segment carries the ramp's hatch; the limit tick is a hairline. */
const overflowEl = (c: HTMLElement) => c.querySelector('[data-meter-overflow]') as HTMLElement | null;
const limitEl = (c: HTMLElement) => c.querySelector('[data-meter-limit]') as HTMLElement | null;

describe('MeterBar — over-budget honesty', () => {
  it('announces the TRUE ratio rather than a clamped 100%', () => {
    render(<MeterBar value={150} max={100} overflow color={STATUS_ERROR} ariaLabel="texture memory" />);
    const bar = screen.getByRole('progressbar', { name: 'texture memory' });
    expect(bar.getAttribute('aria-valuetext')).toContain('150');
    expect(bar.getAttribute('aria-valuetext')).toMatch(/over/i);
    // aria-valuenow may not exceed aria-valuemax, so the ceiling rises with it.
    expect(bar.getAttribute('aria-valuenow')).toBe('150');
    expect(bar.getAttribute('aria-valuemax')).toBe('150');
  });

  it('renders the excess as a hatched segment from STATUS_TOKENS.bad.pattern', () => {
    const { container } = render(
      <MeterBar value={150} max={100} overflow color={STATUS_ERROR} ariaLabel="samplers" />,
    );
    const over = overflowEl(container);
    expect(over).not.toBeNull();
    expect(over!.style.backgroundImage).toContain('repeating-linear-gradient');
    expect(STATUS_TOKENS.bad.pattern).toContain('repeating-linear-gradient');
  });

  it('is distinguishable from at-budget under grayscale — hatch present vs absent', () => {
    // The colourblind-safety assertion: strip hue and the two states must still
    // differ structurally, not just in fill colour.
    const { container: at } = render(
      <MeterBar value={100} max={100} overflow color={STATUS_ERROR} ariaLabel="at" />,
    );
    const { container: over } = render(
      <MeterBar value={150} max={100} overflow color={STATUS_ERROR} ariaLabel="over" />,
    );
    expect(overflowEl(at)).toBeNull();
    expect(overflowEl(over)).not.toBeNull();
    expect(limitEl(at)).toBeNull();
    expect(limitEl(over)).not.toBeNull();
  });

  it('rescales the track so the limit tick moves left as the overrun grows', () => {
    const { container: mild } = render(
      <MeterBar value={125} max={100} overflow color={STATUS_ERROR} ariaLabel="mild" />,
    );
    const { container: bad } = render(
      <MeterBar value={400} max={100} overflow color={STATUS_ERROR} ariaLabel="bad" />,
    );
    // 125% over → budget occupies 80% of the track; 400% over → 25%.
    expect(fillEl(mild).style.width).toBe('80%');
    expect(fillEl(bad).style.width).toBe('25%');
    // A 150%-over bar can therefore never look identical to an at-budget one.
    const { container: at } = render(
      <MeterBar value={100} max={100} overflow color={STATUS_ERROR} ariaLabel="at" />,
    );
    expect(fillEl(at).style.width).toBe('100%');
  });

  it('never announces an over value without saying so, even with a custom valueText', () => {
    render(
      <MeterBar value={18} max={16} overflow color={STATUS_ERROR} ariaLabel="samplers" valueText="18 / 16" />,
    );
    const text = screen.getByRole('progressbar').getAttribute('aria-valuetext')!;
    expect(text).toContain('18 / 16');
    expect(text).toMatch(/over/i);
  });

  it('leaves the under-budget path byte-identical (no tick, no overflow node)', () => {
    const { container } = render(
      <MeterBar value={40} max={100} overflow color={STATUS_SUCCESS} ariaLabel="rate" />,
    );
    expect(fillEl(container).style.width).toBe('40%');
    expect(fillEl(container).className).toContain('meter-fill-grow');
    expect(overflowEl(container)).toBeNull();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('40%');
  });

  it('positions reference marks against the same rescaled geometry', () => {
    const { container } = render(
      <MeterBar
        value={200}
        max={100}
        overflow
        color={STATUS_WARNING}
        ariaLabel="section budget"
        marks={[{ at: 0.8, color: STATUS_WARNING, label: '80%' }]}
      />,
    );
    // Budget occupies 50% of a 200%-over track, so its 80% line sits at 40%.
    const mark = container.querySelector('[data-meter-mark]') as HTMLElement;
    expect(mark.style.left).toBe('40%');
  });
});

describe('resolveMeterScale — the shared geometry both bar primitives use', () => {
  it('reports the true ratio while keeping the clamped fill for legacy callers', () => {
    const s = resolveMeterScale(150, 100, false);
    expect(s.over).toBe(false);
    expect(s.fillPct).toBe(100);
    expect(s.reportedPct).toBe(100);
  });

  it('rescales and reports honestly when overflow is enabled', () => {
    const s = resolveMeterScale(150, 100, true);
    expect(s.over).toBe(true);
    expect(s.ratio).toBeCloseTo(1.5);
    expect(s.fillPct).toBeCloseTo(100 / 1.5);
    expect(s.reportedPct).toBe(150);
  });

  it('guards a zero or negative max and a negative value', () => {
    expect(resolveMeterScale(5, 0, true).fillPct).toBe(0);
    expect(resolveMeterScale(-5, 100, true).fillPct).toBe(0);
    expect(resolveMeterScale(-5, 100, true).over).toBe(false);
  });
});
