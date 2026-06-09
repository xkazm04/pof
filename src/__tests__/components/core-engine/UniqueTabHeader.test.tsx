import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { UniqueTabHeader } from '@/components/modules/core-engine/unique-tabs/_design';
import { Dna } from 'lucide-react';
import { STATUS_IMPROVED } from '@/lib/chart-colors';

// The shared `__tests__/setup.ts` has no afterEach(cleanup) — multi-render
// tests must clean up themselves or stale nodes leak across cases.
afterEach(cleanup);

const ACCENT = STATUS_IMPROVED;

/** jsdom serializes inline hex colors to `rgb(...)`. */
function rgbOf(hex: string): string {
  const h = hex.replace('#', '');
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
}

describe('UniqueTabHeader — unified genome/progression tab signature', () => {
  it('renders the icon chip, title and mono-uppercase subtitle', () => {
    render(
      <UniqueTabHeader icon={Dna} title="Item DNA Genome System" subtitle="5 genomes defined" color={ACCENT} />,
    );
    expect(screen.getByText('Item DNA Genome System')).toBeTruthy();

    // Subtitle line carries the fixed mono-uppercase metric styling.
    const subtitle = screen.getByText('5 genomes defined');
    expect(subtitle.className).toContain('font-mono');
    expect(subtitle.className).toContain('uppercase');
  });

  it('standardizes the icon chip (p-1.5 rounded-md, accent-tinted glow)', () => {
    const { container } = render(
      <UniqueTabHeader icon={Dna} title="Character Genome" color={ACCENT} />,
    );
    const icon = container.querySelector('svg') as SVGElement;
    expect(icon).toBeTruthy();
    // The chip is the icon's parent: fixed p-1.5 rounded-md shape.
    const chip = icon.parentElement as HTMLElement;
    expect(chip.className).toContain('p-1.5');
    expect(chip.className).toContain('rounded-md');
    // Icon is tinted with the accent color (drives the drop-shadow glow too).
    expect(icon.style.color).toBe(rgbOf(ACCENT));
  });

  it('uses the shared pb-3 border-b skeleton so siblings align', () => {
    const { container } = render(
      <UniqueTabHeader icon={Dna} title="Attribute Optimizer" color={ACCENT} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('pb-3');
    expect(root.className).toContain('border-b');
    expect(root.className).toContain('justify-between');
  });

  it('renders the right-aligned action slot when provided', () => {
    render(
      <UniqueTabHeader
        icon={Dna}
        title="Attribute Optimizer"
        color={ACCENT}
        action={<button type="button">98% efficient</button>}
      />,
    );
    expect(screen.getByRole('button', { name: '98% efficient' })).toBeTruthy();
  });

  it('omits the subtitle line when no subtitle is given', () => {
    const { container } = render(
      <UniqueTabHeader icon={Dna} title="Bare" color={ACCENT} />,
    );
    expect(container.querySelector('.font-mono.uppercase')).toBeNull();
  });
});
