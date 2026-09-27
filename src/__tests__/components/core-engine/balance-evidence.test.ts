import { describe, it, expect } from 'vitest';
import { DUMMY_ITEMS, type ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import { buildBalancePrompt } from '@/components/modules/core-engine/sub_inventory/_shared/balance-prompt';
import {
  deriveAffixPool, itemCombatProfile, deriveDpsTable, rarityEvidence,
} from '@/components/modules/core-engine/sub_inventory/_shared/balance-evidence';
import { mergeInventoryItems } from '@/components/modules/core-engine/sub_inventory/_shared/useInventoryItems';
import { runItemEconomySim, DEFAULT_ITEM_ECON_CONFIG } from '@/lib/economy/item-economy-engine';
import type { ItemEntry } from '@/lib/catalog/types';

/** The JSON block that follows a `## <heading>` line in the advisor prompt. */
function section(prompt: string, heading: string): string {
  const start = prompt.indexOf(`## ${heading}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = prompt.slice(start + 3);
  const next = rest.search(/\n## |\n---/);
  return next < 0 ? rest : rest.slice(0, next);
}

function entry(data: ItemData): ItemEntry {
  return { id: data.id, catalogId: 'items', name: data.name, categoryPath: [], tags: [], lifecycle: 'planned', data };
}

const X_ITEM: ItemData = {
  id: 'x', name: 'Catalog Glaive', type: 'Weapon', subtype: 'Glaive', rarity: 'Rare',
  stats: [{ label: 'Damage', value: '20-30' }, { label: 'Speed', value: '2/s' }], description: 'designer-authored',
};

describe('balance evidence — derived from the items the advisor names', () => {
  it('case 1: deriveAffixPool(DUMMY_ITEMS) carries 17 distinct affix names', () => {
    const pool = deriveAffixPool(DUMMY_ITEMS);
    const names = pool.map((a) => a.name);
    expect(new Set(names).size).toBe(17);
    expect(names).toHaveLength(17);
    for (const n of ['of the Bear', 'Frozen', 'of the Dark Lord']) expect(names).toContain(n);
    for (const a of pool) expect(a.carriedBy).toBeGreaterThanOrEqual(1);
  });

  it('case 2: the prompt quotes no affix name that no item carries', () => {
    const prompt = buildBalancePrompt(DUMMY_ITEMS);
    // Neither shadow-catalog affix appears anywhere.
    expect(prompt).not.toContain('Shadow Cloak');
    expect(prompt).not.toContain('Mana Efficiency');
    // 'Armor Penetration' survives only as a lightsaber STAT label; it is never quoted as an affix.
    const pool = JSON.parse(section(prompt, 'Affix Pool').replace(/^[^\n]*\n/, '')) as { name: string }[];
    const carried = new Set(deriveAffixPool(DUMMY_ITEMS).map((a) => a.name));
    expect(pool.map((a) => a.name).sort()).toEqual([...carried].sort());
    expect(pool.map((a) => a.name)).not.toContain('Armor Penetration');
    expect(section(prompt, 'Effective DPS')).not.toContain('Armor Penetration');
  });

  it('case 3: itemCombatProfile reads Speed "1.2s" as seconds per attack; unparseable items are unparsed, never zero', () => {
    const longsword = DUMMY_ITEMS.find((i) => i.name === 'Iron Longsword')!;
    expect(itemCombatProfile(longsword)).toEqual({ dps: 12.5, basis: 'avg damage 15 / 1.2 s per attack' });

    const potion = DUMMY_ITEMS.find((i) => i.name === 'Minor Health Potion')!;
    const p = itemCombatProfile(potion);
    expect(p.dps).toBeNull();
    expect('reason' in p && p.reason.length > 0).toBe(true);

    const table = deriveDpsTable([longsword, potion]);
    expect(table.rows.map((r) => r.name)).toEqual(['Iron Longsword']);
    expect(table.unparsed.map((u) => u.name)).toEqual(['Minor Health Potion']);
    expect(table.rows.every((r) => r.dps > 0)).toBe(true);
  });

  it('case 4: with no simulation evidence the rarity section reads UNMEASURED, never the typed "actual"', () => {
    const prompt = buildBalancePrompt(DUMMY_ITEMS);
    expect(section(prompt, 'Rarity Distribution')).toContain('UNMEASURED');
    expect(prompt).not.toContain('"actual": "55%"');
  });

  it('case 5: rarityEvidence is measured with its basis at Lv5, unmeasured at Lv14 of the default 80 h run', () => {
    const small = runItemEconomySim({ ...DEFAULT_ITEM_ECON_CONFIG, maxLevel: 10 });
    const ev = rarityEvidence(small, 5);
    expect(ev.state).toBe('measured');
    if (ev.state !== 'measured') return;
    const sum = Object.values(ev.shares).reduce((s, v) => s + v, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
    expect(ev.basis).toMatch(/seed 42/);
    expect(ev.basis).toMatch(/500 players/);

    expect(rarityEvidence(runItemEconomySim(DEFAULT_ITEM_ECON_CONFIG), 14).state).toBe('unmeasured');
    expect(rarityEvidence(null, 14).state).toBe('unmeasured');

    // A measured run reaches the prompt with its basis instead of UNMEASURED.
    const rarity = section(buildBalancePrompt(DUMMY_ITEMS.slice(0, 2), { sim: small, level: 5 }), 'Rarity Distribution');
    expect(rarity).toContain('seed 42');
    expect(rarity).not.toContain('UNMEASURED');
  });

  it('case 6: mergeInventoryItems adds catalog entries and lets a catalog entry replace its DUMMY namesake', () => {
    const merged = mergeInventoryItems(DUMMY_ITEMS, [entry(X_ITEM)]);
    expect(merged).toHaveLength(144);
    expect(merged.map((i) => i.id)).toContain('x');

    const override: ItemData = { ...DUMMY_ITEMS[0], name: 'Reforged Longsword' };
    const replaced = mergeInventoryItems(DUMMY_ITEMS, [entry(override)]);
    expect(replaced).toHaveLength(143);
    expect(replaced.find((i) => i.id === DUMMY_ITEMS[0].id)!.name).toBe('Reforged Longsword');
  });

  it('[guard] case 7: buildBalancePrompt with one argument still returns a prompt', () => {
    expect(buildBalancePrompt(DUMMY_ITEMS.slice(0, 2)).length).toBeGreaterThan(0);
  });

  it('[guard] case 8: mergeInventoryItems(DUMMY_ITEMS, []) is exactly DUMMY_ITEMS in order', () => {
    const merged = mergeInventoryItems(DUMMY_ITEMS, []);
    expect(merged).toHaveLength(143);
    merged.forEach((it, i) => expect(it).toBe(DUMMY_ITEMS[i]));
  });
});
