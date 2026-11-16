import { describe, it, expect } from 'vitest';
import { normalizeSimulationConfig } from '@/lib/economy/normalize-config';

describe('normalizeSimulationConfig — philosophy', () => {
  it('keeps every known philosophy', () => {
    for (const p of ['loot-driven', 'scarcity-based', 'balanced']) {
      expect(normalizeSimulationConfig({ philosophy: p }).philosophy).toBe(p);
    }
  });

  it('maps an unknown / non-string philosophy to the default so label == mechanics', () => {
    expect(normalizeSimulationConfig({ philosophy: 'xyz' }).philosophy).toBe('loot-driven');
    expect(normalizeSimulationConfig({ philosophy: 42 }).philosophy).toBe('loot-driven');
    expect(normalizeSimulationConfig({}).philosophy).toBe('loot-driven');
  });
});
