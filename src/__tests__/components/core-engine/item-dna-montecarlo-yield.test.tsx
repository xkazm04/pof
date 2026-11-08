import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { createGenome, DEMO_AFFIX_POOL } from '@/components/modules/core-engine/sub_inventory/dna-genome/data';
import * as engine from '@/lib/item-dna/rolling-engine';
import { MonteCarloSimulator } from '@/components/modules/core-engine/sub_inventory/dna-genome/MonteCarloSimulator';

/**
 * scan-sweep inventory-genome-economy: simulateRolls ran synchronously inside the click
 * handler's startTransition, so "Simulating..." could never paint before a 10k batch blocked
 * the thread. The run must yield first: the pending label is on screen and simulateRolls has
 * not yet been called when the click handler returns.
 */

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Monte Carlo run yields before computing', () => {
  it('shows Simulating... with simulateRolls not yet called, then computes', () => {
    vi.useFakeTimers();
    const real = engine.simulateRolls;
    const spy = vi.spyOn(engine, 'simulateRolls').mockImplementation((...a) => real(...a));
    const genome = createGenome('Probe', ACCENT_VIOLET, {});
    render(<MonteCarloSimulator genome={genome} rarity="Rare" level={10} />);
    fireEvent.click(screen.getByRole('button', { name: /Run 1k Rolls/ }));
    expect(spy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Simulating/ })).not.toBeNull();
    act(() => { vi.runAllTimers(); });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Simulating/ })).toBeNull();
  });

  it('a 10k batch finishes well inside a generous ceiling (timing probe)', () => {
    const genome = createGenome('Probe', ACCENT_VIOLET, {});
    const t0 = performance.now();
    engine.simulateRolls(genome, 'Rare', 10, DEMO_AFFIX_POOL, 10000, 0.9);
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});
