/**
 * The crafting copy a designer reads must describe what the kernel does.
 * Each case asserts the kernel behaviour first, then that the copy does not
 * claim the opposite.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { applyCraft, initialCraftState, instantiateAffix } from '@/components/modules/core-engine/sub_loot/affix-workbench/craftingKernel';
import { AFFIX_POOL } from '@/components/modules/core-engine/sub_loot/affix-workbench/data';
import { CRAFTING_ACTIONS, CURRENCIES } from '@/components/modules/core-engine/sub_loot/affix-workbench/constants';

const pool = (id: string) => AFFIX_POOL.find((a) => a.id === id)!;
const action = (id: string) => CRAFTING_ACTIONS.find((a) => a.id === id)!;
const STATION = 'src/components/modules/core-engine/sub_loot/affix-workbench/CraftingStation.tsx';

describe('affix-workbench crafting copy matches the kernel', () => {
  it('locks outlive Divine Roll and Annul & Exalt, so a lock is not "(1 craft)"', () => {
    const s = initialCraftState([{ ...instantiateAffix(pool('aff-blazing')), locked: true }, instantiateAffix(pool('aff-strength'))]);
    const out = applyCraft(s, 'divine_roll', { rarity: 'Rare', rng: () => 0.5 });
    expect(out.state.affixes.find((a) => a.tag === 'Affix.FireDmg')?.locked).toBe(true);
    for (const id of ['lock_prefix', 'lock_suffix']) expect(action(id).description).not.toMatch(/1 craft/i);
  });

  it('Divine Roll re-rolls only unlocked affixes, so it is not "all affixes"', () => {
    expect(action('divine_roll').description).not.toMatch(/\ball affixes\b/i);
    expect(action('divine_roll').description).toMatch(/unlocked/i);
    expect(CURRENCIES.find((c) => c.id === 'chaos')!.description).not.toMatch(/all affixes/i);
  });

  it('Forging Potential gates crafting; nothing degrades the item and Unlock All is free', () => {
    expect(Object.keys(action('unlock').costs)).toEqual([]);
    const s = initialCraftState([]);
    const dry = { ...s, wallet: { ...s.wallet, forging: 0 } };
    expect(applyCraft(dry, 'augment', { rarity: 'Rare', rng: () => 0 }).refused).toBe('cannot afford');
    const forging = CURRENCIES.find((c) => c.id === 'forging')!;
    expect(forging.description).not.toMatch(/degrade|every craft/i);
    expect(fs.readFileSync(STATION, 'utf8')).not.toMatch(/durability/i);
  });
});
