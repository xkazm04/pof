import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PRESET_GENOMES } from '@/components/modules/core-engine/sub_inventory/dna-genome/data';
import { MonteCarloSimulator } from '@/components/modules/core-engine/sub_inventory/dna-genome/MonteCarloSimulator';

/**
 * scan-sweep inventory-genome-economy: Monte Carlo stats describe the genome, rarity
 * and level they were simulated with. The simulator kept its last stats when any of
 * those props changed, so a designer saw genome A's coherence and god-roll odds
 * presented as genome B's.
 */

afterEach(cleanup);

const [blade, staff] = PRESET_GENOMES;

describe('Monte Carlo results are scoped to their inputs', () => {
  it('hides stats once the genome changes, and says why', async () => {
    const { rerender } = render(<MonteCarloSimulator genome={blade} rarity="Rare" level={10} />);
    fireEvent.click(screen.getByRole('button', { name: /Run 1k Rolls/ }));
    // The run yields one macrotask before computing, so results arrive asynchronously.
    expect(await screen.findByText('Avg Coherence')).not.toBeNull();

    rerender(<MonteCarloSimulator genome={staff} rarity="Rare" level={10} />);
    expect(screen.queryByText('Avg Coherence')).toBeNull();
    expect(screen.queryByText(/inputs changed/i)).not.toBeNull();
  });

  it('hides stats once the rarity or level changes', async () => {
    const { rerender } = render(<MonteCarloSimulator genome={blade} rarity="Rare" level={10} />);
    fireEvent.click(screen.getByRole('button', { name: /Run 1k Rolls/ }));
    await screen.findByText('Avg Coherence');
    rerender(<MonteCarloSimulator genome={blade} rarity="Epic" level={10} />);
    expect(screen.queryByText('Avg Coherence')).toBeNull();

    rerender(<MonteCarloSimulator genome={blade} rarity="Rare" level={10} />);
    expect(screen.queryByText('Avg Coherence')).not.toBeNull();
    rerender(<MonteCarloSimulator genome={blade} rarity="Rare" level={40} />);
    expect(screen.queryByText('Avg Coherence')).toBeNull();
  });
});
