import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import { ChartLegend, type ChartLegendItem } from '@/components/ui/ChartLegend';

// setup.ts has no global afterEach(cleanup) — register our own.
afterEach(() => cleanup());

const ITEMS: ChartLegendItem[] = [
  { color: '#f87171', label: 'Kill share', description: '% of deaths' },
  { color: '#fbbf24', label: 'Damage share', description: '% of damage taken' },
];

describe('ChartLegend', () => {
  it('renders every encoded color as a labeled list item (non color-only)', () => {
    render(<ChartLegend items={ITEMS} />);
    const list = screen.getByRole('list', { name: 'Chart legend' });
    const labels = within(list).getAllByRole('listitem').map((li) => li.textContent);
    expect(labels[0]).toContain('Kill share');
    expect(labels[0]).toContain('% of deaths');
    expect(labels[1]).toContain('Damage share');
  });

  it('paints each swatch with its color and hides it from the a11y tree', () => {
    const { container } = render(<ChartLegend items={ITEMS} />);
    const markers = container.querySelectorAll('[data-testid="legend-marker"]');
    expect(markers).toHaveLength(2);
    expect((markers[0] as HTMLElement).style.backgroundColor).toBe('rgb(248, 113, 113)');
    expect(markers[0].getAttribute('aria-hidden')).toBe('true');
  });

  it('applies a custom aria-label', () => {
    render(<ChartLegend items={ITEMS} ariaLabel="Threat bar legend" />);
    expect(screen.getByRole('list', { name: 'Threat bar legend' })).toBeTruthy();
  });

  it('renders line vs dashed markers with distinct border styles (shape redundancy)', () => {
    const { container } = render(
      <ChartLegend
        items={[
          { color: '#f87171', label: 'Dead', shape: 'line' },
          { color: '#4ade80', label: 'Alive', shape: 'dashed' },
        ]}
      />,
    );
    const markers = container.querySelectorAll('[data-testid="legend-marker"]');
    expect((markers[0] as HTMLElement).style.borderTopStyle).toBe('solid');
    expect((markers[1] as HTMLElement).style.borderTopStyle).toBe('dashed');
  });
});
