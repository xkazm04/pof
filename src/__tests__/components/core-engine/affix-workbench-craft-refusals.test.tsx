/**
 * A craft that cannot change the item is a refusal (charged nothing), never a
 * paid no-op: the kernel's refusal rule is the one authority.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  applyCraft, craftRefusal, initialCraftState, instantiateAffix,
} from '@/components/modules/core-engine/sub_loot/affix-workbench/craftingKernel';
import { AFFIX_POOL } from '@/components/modules/core-engine/sub_loot/affix-workbench/data';
import type { CraftedAffix, Rarity } from '@/components/modules/core-engine/sub_loot/affix-workbench/data';
import { CRAFTING_ACTIONS } from '@/components/modules/core-engine/sub_loot/affix-workbench/constants';
import { CraftingStation } from '@/components/modules/core-engine/sub_loot/affix-workbench/CraftingStation';

const pool = (id: string) => {
  const e = AFFIX_POOL.find((a) => a.id === id);
  if (!e) throw new Error(`no pool entry ${id}`);
  return e;
};

describe('craftingKernel — reforge that cannot roll anything is refused', () => {
  it('reforging a Common base (0 affix slots) charges nothing', () => {
    const s = initialCraftState([]);
    const out = applyCraft(s, 'reforge', { rarity: 'Common', rng: () => 0.5 });
    expect(out.refused).toBeTruthy();
    expect(out.state.wallet).toEqual(s.wallet);
    expect(out.state.craftCount).toBe(0);
  });

  it('reforging a Rare item whose every slot is locked charges nothing', () => {
    const locked = ['aff-blazing', 'aff-strength', 'aff-swift', 'aff-vicious']
      .map((id) => ({ ...instantiateAffix(pool(id)), locked: true }));
    const s = initialCraftState(locked);
    const out = applyCraft(s, 'reforge', { rarity: 'Rare', rng: () => 0.5 });
    expect(out.refused).toBeTruthy();
    expect(out.state.wallet).toEqual(s.wallet);
  });

  it('a reforge with an unlocked slot still runs and charges', () => {
    const s = initialCraftState([{ ...instantiateAffix(pool('aff-blazing')), locked: true }]);
    const out = applyCraft(s, 'reforge', { rarity: 'Rare', rng: () => 0.5 });
    expect(out.refused).toBeUndefined();
    expect(out.state.craftCount).toBe(1);
  });
});

describe('CraftingStation — a craft button is live exactly when the kernel would run it', () => {
  afterEach(() => cleanup());

  const cases: { name: string; rarity: Rarity; affixes: CraftedAffix[] }[] = [
    { name: 'Rare, two unlocked prefixes, no suffix', rarity: 'Rare',
      affixes: [instantiateAffix(pool('aff-blazing')), instantiateAffix(pool('aff-brutal'))] },
    { name: 'Rare, prefixes already locked', rarity: 'Rare',
      affixes: [{ ...instantiateAffix(pool('aff-blazing')), locked: true }, instantiateAffix(pool('aff-strength'))] },
    { name: 'Common base, empty', rarity: 'Common', affixes: [] },
  ];

  for (const c of cases) {
    it(`${c.name}: every button's disabled state matches craftRefusal`, () => {
      const wallet = initialCraftState().wallet;
      const { container } = render(
        <CraftingStation showCraftPanel onToggleCraftPanel={() => {}} prefixLocked={false} suffixLocked={false}
          craftCount={0} wallet={wallet}
          craftFlash={null} craftLog={[]} avgCraftCost={null} onExecuteCraft={() => {}} onResetWallet={() => {}}
          refusalFor={(id) => craftRefusal({ affixes: c.affixes, wallet }, id, c.rarity)} />,
      );
      const mismatches = CRAFTING_ACTIONS.filter((a) => {
        const btn = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(a.name));
        if (!btn) throw new Error(`no button for ${a.name}`);
        const kernelRuns = craftRefusal({ affixes: c.affixes, wallet }, a.id, c.rarity) === null;
        return (btn as HTMLButtonElement).disabled === kernelRuns;
      }).map((a) => a.id);
      expect(mismatches).toEqual([]);
    });
  }
});
