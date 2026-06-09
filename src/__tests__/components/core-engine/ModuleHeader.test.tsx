import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ModuleHeader } from '@/components/modules/core-engine/unique-tabs/_shared';
import { Terminal, TrendingUp } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_IMPROVED } from '@/lib/chart-colors';

afterEach(cleanup);

// A non-green accent so the "tinted while incomplete" case is distinguishable
// from the "green when complete" case.
const ACCENT = STATUS_IMPROVED;

/** jsdom serializes inline hex colors to `rgb(...)`. */
function rgbOf(hex: string): string {
  const h = hex.replace('#', '');
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
}

describe('ModuleHeader — unified sibling header', () => {
  it('renders icon, title and the implemented/total progress chip (default variant)', () => {
    const { container } = render(
      <ModuleHeader icon={TrendingUp} title="Progression Curve" implemented={12} total={18} accent={ACCENT} />,
    );
    expect(screen.getByText('Progression Curve')).toBeTruthy();
    // Icon renders an SVG
    expect(container.querySelector('svg')).toBeTruthy();
    // Progress chip readout: "12 / 18 ready"
    const text = container.textContent ?? '';
    expect(text).toContain('12');
    expect(text).toContain('18');
    expect(text).toContain('ready');
  });

  it('uses the shared gap-3 pb-3 border-b skeleton', () => {
    const { container } = render(
      <ModuleHeader icon={TrendingUp} title="Progression Curve" implemented={1} total={2} accent={ACCENT} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('gap-3');
    expect(root.className).toContain('pb-3');
    expect(root.className).toContain('border-b');
  });

  it('preserves terminal identity (mono uppercase title + blinking cursor) without jargon', () => {
    const { container } = render(
      <ModuleHeader icon={Terminal} title="Save Data Schema" implemented={5} total={9} accent={ACCENT} variant="terminal" />,
    );
    const title = screen.getByText('Save Data Schema');
    expect(title.className).toContain('font-mono');
    expect(title.className).toContain('uppercase');
    // Decorative blinking cursor is present and hidden from assistive tech
    expect(container.querySelector('[aria-hidden]')).toBeTruthy();
    // Cryptic jargon is gone
    const text = container.textContent ?? '';
    expect(text).not.toContain('Save.Data_Schema');
    expect(text).not.toContain('Protocol');
    expect(text).not.toContain('UARPG_SYS');
  });

  it('renders the identical progress chip in the terminal variant', () => {
    const { container } = render(
      <ModuleHeader icon={Terminal} title="Save Data Schema" implemented={5} total={9} accent={ACCENT} variant="terminal" />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('5');
    expect(text).toContain('9');
    expect(text).toContain('ready');
  });

  it('tints the count with the accent while incomplete and green once complete', () => {
    const partial = render(
      <ModuleHeader icon={TrendingUp} title="Curve" implemented={3} total={10} accent={ACCENT} />,
    );
    const partialCount = partial.container.querySelector('.tabular-nums') as HTMLElement;
    expect(partialCount.style.color).toBe(rgbOf(ACCENT));
    cleanup();

    const done = render(
      <ModuleHeader icon={TrendingUp} title="Curve" implemented={10} total={10} accent={ACCENT} />,
    );
    const doneCount = done.container.querySelector('.tabular-nums') as HTMLElement;
    expect(doneCount.style.color).toBe(rgbOf(STATUS_SUCCESS));
  });
});
