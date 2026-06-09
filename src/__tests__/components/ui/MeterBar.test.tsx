import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MeterBar } from '@/components/ui/MeterBar';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';

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

  it('clamps the fill and aria-valuenow to 0–100', () => {
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
