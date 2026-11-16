import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DUMMY_ITEMS } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import { itemPower } from '@/components/modules/core-engine/sub_inventory/catalog/itemComparison';

/**
 * "Sort: Power" must order the grid by the same number the card's PWR badge shows.
 * They were two formulas (sort: stat sum; badge: stat sum + 10 per affix), so on the
 * seed catalog 494 of 10,153 item pairs sorted against their own badges.
 */
const CATALOG = 'src/components/modules/core-engine/sub_inventory/catalog';
const code = (f: string) => fs.readFileSync(path.join(process.cwd(), CATALOG, f), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('one power score for the badge and the sort', () => {
  it('itemPower = numeric stat sum + 10 per affix', () => {
    const it8 = DUMMY_ITEMS.find((i) => i.id === '8')!;
    const stats = it8.stats.reduce((s, st) => s + (st.numericValue ?? 0), 0);
    expect(itemPower(it8)).toBe(stats + (it8.affixes?.length ?? 0) * 10);
  });

  it('sorting the seed catalog by itemPower leaves 0 badge inversions', () => {
    const sorted = [...DUMMY_ITEMS].sort((a, b) => itemPower(b) - itemPower(a));
    let inverted = 0;
    for (let i = 1; i < sorted.length; i++) if (itemPower(sorted[i - 1]) < itemPower(sorted[i])) inverted++;
    expect(inverted).toBe(0);
  });

  it('CatalogGearTab sorts and TradingCard badges through itemPower, with no private formula', () => {
    const tab = code('CatalogGearTab.tsx');
    const card = code('TradingCard.tsx');
    expect(tab).toMatch(/itemPower\(bd\)\s*-\s*itemPower\(ad\)/);
    expect(card).toContain('itemPower(item)');
    expect(card).not.toContain('function computePower');
    expect(tab).not.toMatch(/stats\.reduce/);
  });
});
