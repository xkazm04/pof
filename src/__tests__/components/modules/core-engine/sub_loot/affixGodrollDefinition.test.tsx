import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { AFFIX_DEFS } from '@/components/modules/core-engine/sub_loot/_shared/data';

vi.mock('framer-motion', async (orig) => ({
  ...(await orig<typeof import('framer-motion')>()),
  useReducedMotion: () => true,
}));

import { useAffixRollSimulator } from '@/components/modules/core-engine/sub_loot/affix/AffixRollSimulator/useAffixRollSimulator';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('affix roll simulator: one godroll definition for the odds line and the win cue', () => {
  it('the printed odds match the empirical win-cue rate (seeded Monte Carlo)', () => {
    const rng = mulberry32(20261108);
    vi.spyOn(Math, 'random').mockImplementation(rng);
    const { result } = renderHook(() => useAffixRollSimulator());
    // A pool where godrolls are common enough to sample: every tier-3 affix plus two commons.
    const ids = AFFIX_DEFS.filter((a) => a.tier === 3).map((a) => a.id).concat(['keen', 'savage']);
    act(() => result.current.setSelectedAffixIds(ids));
    const odds = result.current.godrollPct / 100;

    const SPINS = 3000;
    let cues = 0;
    for (let i = 0; i < SPINS; i++) {
      act(() => result.current.spinAffixes());
      if (result.current.winSlots.some(Boolean)) cues++;
    }
    const rate = cues / SPINS;
    expect(Math.abs(rate - odds)).toBeLessThan(0.04);
  });

  it('a win cue lights all three slots together or none', () => {
    const rng = mulberry32(7);
    vi.spyOn(Math, 'random').mockImplementation(rng);
    const { result } = renderHook(() => useAffixRollSimulator());
    for (let i = 0; i < 300; i++) {
      act(() => result.current.spinAffixes());
      const n = result.current.winSlots.filter(Boolean).length;
      expect([0, 3]).toContain(n);
    }
  });

  it('full pool odds are (tier-3 weight / total weight)^3', () => {
    const { result } = renderHook(() => useAffixRollSimulator());
    const total = AFFIX_DEFS.reduce((s, a) => s + a.weight, 0);
    const t3 = AFFIX_DEFS.filter((a) => a.tier === 3).reduce((s, a) => s + a.weight, 0);
    expect(result.current.godrollPct).toBeCloseTo(Math.pow(t3 / total, 3) * 100, 6);
  });
});
