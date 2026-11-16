import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { createGenome } from '@/components/modules/core-engine/sub_inventory/dna-genome/data';
import { MonteCarloSimulator } from '@/components/modules/core-engine/sub_inventory/dna-genome/MonteCarloSimulator';

/** scan-sweep inventory-genome-economy: unselected iteration chips follow the theme token, not a slate rgb() literal. */

afterEach(cleanup);

describe('Monte Carlo iteration chips', () => {
  it('colour unselected chips with var(--text-muted)', () => {
    render(<MonteCarloSimulator genome={createGenome('Probe', ACCENT_VIOLET, {})} rarity="Rare" level={10} />);
    const chip = screen.getByRole('button', { name: /2,500 iterations/ });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect(chip.style.color).toBe('var(--text-muted)');
  });
});
