/**
 * "Price this item": the affix set the designer built by hand becomes a craft
 * goal, and a seeded Monte Carlo over the ONE crafting kernel (`applyCraft`)
 * answers what it costs to obtain — success rate within a wallet, spend per
 * currency (Forging Potential as the headline), crafts — or says why the goal
 * is unreachable. Pricing spends a copy of a wallet, never the live one.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { createRNG as seeded } from '@/lib/seeded-rng';
import {
  nextCraftAction, priceCraftGoal,
} from '@/components/modules/core-engine/sub_loot/affix-workbench/craftGoal';
import type { CraftGoalReport } from '@/components/modules/core-engine/sub_loot/affix-workbench/craftGoal';
import {
  applyCraft, defaultWallet, eligiblePool, initialCraftState, instantiateAffix, zeroWallet,
} from '@/components/modules/core-engine/sub_loot/affix-workbench/craftingKernel';
import type { CraftState } from '@/components/modules/core-engine/sub_loot/affix-workbench/craftingKernel';
import { AFFIX_POOL } from '@/components/modules/core-engine/sub_loot/affix-workbench/data';
import { CURRENCIES } from '@/components/modules/core-engine/sub_loot/affix-workbench/constants';
import { useAffixWorkbench } from '@/components/modules/core-engine/sub_loot/affix-workbench/hooks';

afterEach(() => cleanup());

const pool = (id: string) => {
  const e = AFFIX_POOL.find((a) => a.id === id);
  if (!e) throw new Error(`no pool entry ${id}`);
  return e;
};
const BLAZING = pool('aff-blazing');
const STRENGTH = pool('aff-strength');

function priced(r: CraftGoalReport) {
  if (r.status !== 'priced') throw new Error(`expected priced, got unreachable: ${r.reason}`);
  return r;
}

describe('priceCraftGoal — a seeded cost distribution over the real crafting rules', () => {
  it('prices a Rare FireDmg + Strength item deterministically under a seed', () => {
    const args = { rarity: 'Rare' as const, targetTags: ['Affix.FireDmg', 'Affix.Strength'], start: [], wallet: defaultWallet(), runs: 400 };
    const first = priced(priceCraftGoal({ ...args, rng: seeded(7) }));
    expect(first.successRate).toBeGreaterThan(0);
    expect(first.successRate).toBeLessThanOrEqual(1);
    expect(first.spend).not.toBeNull();
    expect(first.spend!.exalted.mean).toBeGreaterThanOrEqual(2);
    expect(first.spend!.forging.p90).toBeGreaterThanOrEqual(first.spend!.forging.p50);
    const second = priceCraftGoal({ ...args, rng: seeded(7) });
    expect(second).toEqual(first);
  });

  it('a Celestial target on a Rare base is unreachable, names why, and never steps the kernel', () => {
    const step = vi.fn(applyCraft);
    const r = priceCraftGoal({
      rarity: 'Rare', targetTags: ['Affix.FireDmg', 'Affix.AllDmg'], start: [],
      wallet: defaultWallet(), runs: 400, rng: seeded(7), step,
    });
    expect(r.status).toBe('unreachable');
    if (r.status !== 'unreachable') return;
    expect(r.reason).toMatch(/Celestial/);
    expect(r.reason).toMatch(/Legendary/);
    expect(step).toHaveBeenCalledTimes(0);
  });

  it('more targets than the rarity has slots is unreachable', () => {
    const r = priceCraftGoal({
      rarity: 'Rare',
      targetTags: ['Affix.FireDmg', 'Affix.Strength', 'Affix.IceDmg', 'Affix.Armor', 'Affix.Vitality'],
      start: [], wallet: defaultWallet(), runs: 50, rng: seeded(1),
    });
    expect(r.status).toBe('unreachable');
    if (r.status !== 'unreachable') return;
    expect(r.reason).toMatch(/5 targets.*4 slots/);
  });

  it('a wallet with no Exalted, Chaos or Annulment exhausts on every run', () => {
    const runs = 60;
    const r = priced(priceCraftGoal({
      rarity: 'Rare', targetTags: ['Affix.FireDmg', 'Affix.Strength'], start: [],
      wallet: { ...defaultWallet(), exalted: 0, chaos: 0, annulment: 0 }, runs, rng: seeded(3),
    }));
    expect(r.successRate).toBe(0);
    expect(r.failures.walletExhausted).toBe(runs);
  });

  it('an item that already carries every target costs nothing', () => {
    const r = priced(priceCraftGoal({
      rarity: 'Rare', targetTags: ['Affix.FireDmg', 'Affix.Strength'],
      start: [instantiateAffix(BLAZING), instantiateAffix(STRENGTH)],
      wallet: defaultWallet(), runs: 40, rng: seeded(5),
    }));
    expect(r.successRate).toBe(1);
    expect(r.crafts!.p50).toBe(0);
    for (const c of CURRENCIES) expect(r.spend![c.id].mean).toBe(0);
  });

  it('[coordinator] one affordable augment on an Uncommon base matches the closed form 0.85 x w(T)/W', () => {
    const T = STRENGTH;
    const eligible = eligiblePool(AFFIX_POOL, 'Uncommon');
    expect(eligible.some((a) => a.tag === T.tag)).toBe(true);
    const expected = 0.85 * T.weight / eligible.reduce((s, a) => s + a.weight, 0);
    const runs = 4000;
    const r = priced(priceCraftGoal({
      rarity: 'Uncommon', targetTags: [T.tag], start: [],
      wallet: { ...zeroWallet(), exalted: 1, forging: 5 }, runs, rng: seeded(11),
    }));
    expect(Math.abs(r.successRate - expected)).toBeLessThanOrEqual(0.03);
    // Only one augment is affordable, so every miss ends with an empty wallet.
    expect(r.failures.walletExhausted).toBe(runs - Math.round(r.successRate * runs));
  });
});

describe('nextCraftAction — the pricer\'s craft policy', () => {
  const goal = { rarity: 'Rare' as const, targetTags: ['Affix.FireDmg', 'Affix.Strength'] };
  const withAffixes = (affixes: CraftState['affixes']): CraftState => ({ ...initialCraftState(), affixes });

  it('augments into an open slot, annuls a stray on a full item, and stops when the targets are held', () => {
    expect(nextCraftAction(withAffixes([instantiateAffix(BLAZING)]), goal)).toBe('augment');
    // Full Rare item missing Strength, no side made only of targets: a stray must go.
    const full = withAffixes([
      instantiateAffix(BLAZING), instantiateAffix(pool('aff-frozen')),
      instantiateAffix(pool('aff-fortitude')), instantiateAffix(pool('aff-endurance')),
    ]);
    expect(nextCraftAction(full, goal)).toBe('remove_add');
    // A side holding only targets is locked first (wallet affords an Eternal Lock).
    const guarded = withAffixes([
      instantiateAffix(BLAZING), instantiateAffix(pool('aff-fortitude')),
      instantiateAffix(pool('aff-endurance')), instantiateAffix(pool('aff-haste')),
    ]);
    expect(nextCraftAction(guarded, goal)).toBe('lock_prefix');
    expect(nextCraftAction(withAffixes([instantiateAffix(BLAZING), instantiateAffix(STRENGTH)]), goal)).toBeNull();
  });
});

describe('useAffixWorkbench — priceCurrentItem never touches the live wallet', () => {
  it('prices the hand-built affix set as the goal and leaves wallet, log and count alone', () => {
    const { result } = renderHook(() => useAffixWorkbench());
    act(() => { result.current.addAffix(BLAZING); });
    act(() => { result.current.addAffix(STRENGTH); });
    const wallet = structuredClone(result.current.wallet);
    const craftLog = result.current.craftLog;
    const craftCount = result.current.craftCount;
    expect(result.current.goalReport).toBeNull();
    act(() => { result.current.priceCurrentItem(); });
    expect(result.current.goalReport).not.toBeNull();
    expect(result.current.goalReport!.targetTags).toEqual(['Affix.FireDmg', 'Affix.Strength']);
    expect(result.current.wallet).toEqual(wallet);
    expect(result.current.craftLog).toBe(craftLog);
    expect(result.current.craftCount).toBe(craftCount);
  });
});
