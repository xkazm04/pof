import { describe, it, expect } from 'vitest';
import { COMBO_ABILITIES, PRESET_COMBOS } from '@/components/modules/core-engine/sub_ability/_shared/data';
import { sustainedCycle, rankCombos } from '@/components/modules/core-engine/sub_combat/combos/schedule';

// scan-sweep night 2026-11-08, combat-damage-pipeline: the reported sustained DPS must be
// the steady-state figure, not whatever a fixed 6-loop window happened to read.

/** mulberry32: a seeded PRNG so the probe is reproducible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHAINS = 3000;
const randomChains = (seed: number) => {
  const next = rng(seed);
  const ids = COMBO_ABILITIES.map(a => a.id);
  return Array.from({ length: CHAINS }, () => {
    const len = 1 + Math.floor(next() * 5);
    return Array.from({ length: len }, () => ids[Math.floor(next() * ids.length)]);
  });
};

describe('sustained DPS is the converged steady-state figure', () => {
  it('the default window and a 60-loop window agree within 1% on every random chain', () => {
    const off = randomChains(20261108).filter(chain => {
      const a = sustainedCycle(chain, 6).sustainedDps;
      const b = sustainedCycle(chain, 60).sustainedDps;
      return b > 0 && Math.abs(a - b) / b > 0.01;
    });
    expect(off.length).toBe(0);
  });

  it('the known transient chain reads its steady 14.40, not 15.00', () => {
    const chain = ['force-lightning', 'warcry', 'force-lightning', 'force-heal'];
    expect(sustainedCycle(chain, 6).sustainedDps).toBeCloseTo(14.4, 2);
  });

  it('no PRESET_COMBOS sustained figure moves more than 1% from its 60-loop value', () => {
    const ranked = rankCombos(PRESET_COMBOS, 'sustained');
    for (const r of ranked) {
      const steady = sustainedCycle(PRESET_COMBOS.find(c => c.id === r.id)!.abilities, 60).sustainedDps;
      expect(Math.abs(r.sustainedDps - steady) / steady).toBeLessThanOrEqual(0.01);
    }
  });
});
