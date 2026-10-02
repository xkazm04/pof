/**
 * The affix workbench has ONE crafting kernel (`affix-workbench/craftingKernel.ts`):
 * a pure, seeded reducer that owns eligibility, the weighted pick, affix
 * instantiation, item-level scaling, the craft actions and the lock model. The
 * React hooks only hold its state and pass `Math.random`.
 *
 * These cases pin the four crafting defects the old closure-over-useState
 * engine had (a refused augment still charged; Divine Roll ignored locks;
 * lock_prefix charged and badged an item with no prefixes; the prefixLocked
 * boolean drifted from the per-affix locks reforge honours) plus the export /
 * inject divergence (the C++ export scaled by the base's item level while the
 * inject and the budget used the slider's).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderHook, act, cleanup } from '@testing-library/react';
import { createRNG as seeded } from '@/lib/seeded-rng';
import { cppFloat } from '@/lib/genome/codegen';
import {
  applyCraft, addAffix, deriveLocks, eligiblePool, instantiateAffix,
  initialCraftState, rollItem, scaledMagnitude,
} from '@/components/modules/core-engine/sub_loot/affix-workbench/craftingKernel';
import type { CraftState } from '@/components/modules/core-engine/sub_loot/affix-workbench/craftingKernel';
import {
  AFFIX_POOL, ITEM_BASES, RARITIES, RARITY_AFFIX_COUNTS, SYNERGY_COLORS,
} from '@/components/modules/core-engine/sub_loot/affix-workbench/data';
import { generateExportCode } from '@/components/modules/core-engine/sub_loot/affix-workbench/codegen';
import { useExportActions } from '@/components/modules/core-engine/sub_loot/affix-workbench/useExportActions';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const WB = 'src/components/modules/core-engine/sub_loot/affix-workbench';
const pool = (id: string) => {
  const e = AFFIX_POOL.find((a) => a.id === id);
  if (!e) throw new Error(`no pool entry ${id}`);
  return e;
};
const BLAZING = pool('aff-blazing');
const STRENGTH = pool('aff-strength');
const BRUTAL = pool('aff-brutal');

function stateWith(affixes: CraftState['affixes']): CraftState {
  return { ...initialCraftState(), affixes };
}

describe('craftingKernel — the four crafting defects', () => {
  it('divine_roll honours locks: a locked affix keeps its magnitude, an unlocked one re-rolls', () => {
    const s = stateWith([
      { ...instantiateAffix(BLAZING, 10), locked: true },
      instantiateAffix(STRENGTH, 5),
    ]);
    const out = applyCraft(s, 'divine_roll', { rarity: 'Rare', rng: () => 0.99 });
    expect(out.refused).toBeUndefined();
    const byTag = Object.fromEntries(out.state.affixes.map((a) => [a.tag, a.magnitude]));
    expect(byTag['Affix.FireDmg']).toBe(10);
    expect(byTag['Affix.Strength']).toBe(9.9);
  });

  it('a refused augment (no open slot) charges nothing and logs nothing', () => {
    const full = stateWith([
      instantiateAffix(BLAZING, 10), instantiateAffix(STRENGTH, 5),
      instantiateAffix(pool('aff-swift'), 10), instantiateAffix(pool('aff-vicious'), 20),
    ]);
    expect(full.affixes).toHaveLength(RARITY_AFFIX_COUNTS.Rare.max);
    const walletBefore = structuredClone(full.wallet);
    const out = applyCraft(full, 'augment', { rarity: 'Rare', rng: () => 0 });
    expect(out).toMatchObject({ refused: 'no open slot' });
    expect(out.state.wallet).toEqual(walletBefore);
    expect(out.state.totalSpent).toEqual(full.totalSpent);
    expect(out.state.craftCount).toBe(full.craftCount);
    expect(out.state.log).toEqual(full.log);
    // The input state is never mutated, even by a successful craft.
    const open = stateWith([instantiateAffix(BLAZING, 10)]);
    const openWallet = structuredClone(open.wallet);
    const ok = applyCraft(open, 'augment', { rarity: 'Rare', rng: () => 0 });
    expect(ok.refused).toBeUndefined();
    expect(open.wallet).toEqual(openWallet);
    expect(ok.state.wallet.exalted).toBe(openWallet.exalted - 1);
  });

  it('lock_prefix on an item with no prefixes is refused, free, and no badge claims a lock', () => {
    const s = stateWith([instantiateAffix(STRENGTH, 5)]);
    const out = applyCraft(s, 'lock_prefix', { rarity: 'Rare', rng: () => 0 });
    expect(out).toMatchObject({ refused: 'no prefixes to lock' });
    expect(out.state.wallet).toEqual(s.wallet);
    expect(out.state.craftCount).toBe(0);
    expect(deriveLocks(out.state).prefixLocked).toBe(false);
  });

  it('the lock badge is derived from per-affix locks, and reforge keeps exactly the locked affixes', () => {
    const s0 = stateWith([instantiateAffix(BLAZING, 10), instantiateAffix(STRENGTH, 5)]);
    const s1 = applyCraft(s0, 'lock_prefix', { rarity: 'Rare', rng: () => 0 });
    expect(s1.refused).toBeUndefined();
    expect(deriveLocks(s1.state).prefixLocked).toBe(true);
    const s2 = addAffix(s1.state, BRUTAL);
    expect(s2.affixes.map((a) => a.tag)).toContain('Affix.PhysDmg');
    // Brutal is an unlocked prefix: the badge can no longer claim "prefixes locked".
    expect(deriveLocks(s2).prefixLocked).toBe(false);
    expect(deriveLocks(s2.affixes).prefixLocked).toBe(false);

    const lockedBefore = s2.affixes.filter((a) => a.locked);
    const unlockedBefore = s2.affixes.filter((a) => !a.locked);
    expect(lockedBefore.map((a) => a.tag)).toEqual(['Affix.FireDmg']);
    const r = applyCraft(s2, 'reforge', { rarity: 'Rare', rng: seeded(3) });
    expect(r.refused).toBeUndefined();
    // Every locked affix survives with its tuned magnitude ...
    for (const l of lockedBefore) {
      expect(r.state.affixes.find((a) => a.tag === l.tag)).toMatchObject({ tag: l.tag, magnitude: l.magnitude });
    }
    // ... and no unlocked affix survives (anything with its tag is a fresh roll).
    for (const u of unlockedBefore) expect(r.state.affixes).not.toContain(u);
    const { min, max } = RARITY_AFFIX_COUNTS.Rare;
    expect(r.state.affixes.length).toBeGreaterThanOrEqual(min);
    expect(r.state.affixes.length).toBeLessThanOrEqual(max);
    expect(new Set(r.state.affixes.map((a) => a.tag)).size).toBe(r.state.affixes.length);
  });
});

describe('craftingKernel — one item-level authority for export and inject', () => {
  it('the C++ export and the inject body carry the slider item level and the same scaled magnitude', async () => {
    const mithril = ITEM_BASES.find((b) => b.name === 'Mithril Blade')!;
    expect(mithril.itemLevel).toBe(25);
    const blazing = instantiateAffix(BLAZING, 10);
    expect(scaledMagnitude(blazing, 60)).toBe(70);

    const code = generateExportCode(mithril, [blazing], 60);
    expect(code).toContain('Item->ItemLevel = 60;');
    expect(code).toContain(`Affix.Magnitude = ${cppFloat(70)};`);
    expect(code).not.toContain('Item->ItemLevel = 25;');
    // Every float literal is valid C++ (cppFloat, never `${n}f`).
    expect(code).not.toMatch(/=\s*\d+f;/);

    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ success: true, data: {} })));
    vi.stubGlobal('fetch', fetchSpy);
    const { result } = renderHook(() => useExportActions(mithril, [blazing], 60));
    await act(async () => { await result.current.handleInjectToUE5(); });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = (fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = JSON.parse(String(init.body));
    expect(body.itemLevel).toBe(60);
    expect(body.affixes[0].magnitude).toBe(scaledMagnitude(blazing, 60));
  });
});

describe('craftingKernel — guards', () => {
  it('[guard] rollItem is deterministic under a seed and always legal', () => {
    expect(rollItem(AFFIX_POOL, 'Legendary', seeded(42))).toEqual(rollItem(AFFIX_POOL, 'Legendary', seeded(42)));
    const rng = seeded(42);
    const { min, max } = RARITY_AFFIX_COUNTS.Legendary;
    for (let i = 0; i < 500; i++) {
      const item = rollItem(AFFIX_POOL, 'Legendary', rng);
      expect(new Set(item.map((a) => a.tag)).size).toBe(item.length);
      expect(item.length).toBeGreaterThanOrEqual(min);
      expect(item.length).toBeLessThanOrEqual(max);
      for (const a of item) {
        const entry = pool(a.poolEntryId);
        expect(RARITIES.indexOf(entry.minRarity)).toBeLessThanOrEqual(RARITIES.indexOf('Legendary'));
        expect(a.magnitude).toBeGreaterThanOrEqual(entry.minValue);
        expect(a.magnitude).toBeLessThanOrEqual(entry.maxValue);
      }
    }
  });

  it('[guard] eligiblePool is the one minRarity predicate in the workbench', () => {
    expect(eligiblePool(AFFIX_POOL, 'Rare')).toHaveLength(16);
    const hits = fs.readdirSync(WB)
      .filter((f) => /\.tsx?$/.test(f))
      .flatMap((f) => fs.readFileSync(path.join(WB, f), 'utf8').split(/\r?\n/)
        .filter((l) => l.includes('RARITIES.indexOf(a.minRarity)'))
        .map((l) => `${f}: ${l.trim()}`));
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(/^craftingKernel\.ts:/);
    for (const f of ['archetypes.ts', 'hooks.ts', 'BreakpointTable.tsx']) {
      expect(fs.readFileSync(path.join(WB, f), 'utf8')).toContain('eligiblePool(');
    }
  });

  it('the _orphan data fork is gone; its components render the workbench data', () => {
    const orphan = 'src/components/modules/core-engine/sub_loot/_orphan';
    expect(fs.existsSync(path.join(orphan, 'data.ts'))).toBe(false);
    for (const f of ['SynergyDetector.tsx', 'ArchetypeSuggestionGrid.tsx']) {
      const src = fs.readFileSync(path.join(orphan, f), 'utf8');
      expect(src).toContain("from '@/components/modules/core-engine/sub_loot/affix-workbench/data'");
      expect(src).not.toMatch(/from '\.\/data'/);
    }
    expect(SYNERGY_COLORS.broken).toBeTruthy();
  });
});
