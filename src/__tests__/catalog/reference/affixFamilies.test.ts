// /diablo W11 (D1): a Diablo affix row is ONE TIER; PoF's affix entity is the FAMILY with its tiers. Rows aggregate per
// (side, power) into one family entity — promoted through the same door as any wrapper — and the family's steps are
// seeded (SOURCED) from its tiers. Synthetic rows.
import { describe, it, expect } from 'vitest';
import { wrapTable } from '@/lib/catalog/reference/wrapper';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { affixFamilies, seedAffixSteps } from '@/lib/catalog/reference/affixFamilies';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';

const pre = DIABLO1.tables.find((t) => t.file === 'items/item_prefixes.tsv')!;
const suf = DIABLO1.tables.find((t) => t.file === 'items/item_suffixes.tsv')!;
const COLS = Object.keys(pre.map);
const tsv = (rows: Record<string, string>[]) => [COLS.join('\t'), ...rows.map((r) => COLS.map((c) => r[c] ?? '').join('\t'))].join('\n');

const prefixes = wrapTable(DIABLO1, pre, tsv([
  { name: 'Keen', power: 'DAMMOD', 'power.value1': '3', 'power.value2': '5', minLevel: '8', itemTypes: 'Weapon', alignment: 'Any', chance: '2' },
  { name: 'Dull', power: 'DAMMOD', 'power.value1': '1', 'power.value2': '2', minLevel: '1', itemTypes: 'Weapon,Bow', alignment: 'Any', chance: '1' },
  { name: 'Brittle', power: 'DAMMOD_CURSE', 'power.value1': '1', 'power.value2': '2', minLevel: '1', itemTypes: 'Weapon', alignment: 'Evil', chance: '1' },
]), 't0').wrappers;
const suffixes = wrapTable(DIABLO1, suf, tsv([
  { name: 'of Leeching', power: 'STEALLIFE', 'power.value1': '3', 'power.value2': '3', minLevel: '5', itemTypes: 'Weapon', alignment: 'Any', chance: '1' },
]), 't0').wrappers;

describe('affixFamilies', () => {
  const fams = affixFamilies([...prefixes, ...suffixes]);

  it('aggregates tiers per (side, power); a curse is its own family', () => {
    expect(fams.map((f) => f.entity.id).sort()).toEqual(['d1-affix-prefix-dammod', 'd1-affix-prefix-dammod_curse', 'd1-affix-suffix-steallife']);
    for (const f of fams) expect(f.catalogId).toBe('affixes');
  });

  it('orders a family\'s tiers by the item level that unlocks them, and names every source row', () => {
    const dm = fams.find((f) => f.entity.id === 'd1-affix-prefix-dammod')!;
    const tiers = dm.entity.data.tiers as { name: string; minItemLevel: number }[];
    expect(tiers.map((t) => t.name)).toEqual(['Dull', 'Keen']);
    expect(dm.entity.provenance?.sourceRow).toMatch(/row=0/);
    expect(dm.entity.provenance?.sourceRow).toMatch(/row=1/);
  });
});

describe('seedAffixSteps', () => {
  const fams = affixFamilies([...prefixes, ...suffixes]);
  const dm = fams.find((f) => f.entity.id === 'd1-affix-prefix-dammod')!;
  const seeds = seedAffixSteps(dm.entity);

  it('seeds Affix Definition, Tiers & Item Level and Spawn Rules, each SOURCED', () => {
    expect(seeds.map((s) => s.step)).toEqual(['Affix Definition', 'Tiers & Item Level', 'Spawn Rules']);
    for (const s of seeds) expect(s.data.sourced).toBeDefined();
  });

  it('writes the family as the UE row reads it: a prefix, grouped by its power, targeting the PoF attribute', () => {
    const a = seeds[0].data.affix as Record<string, unknown>;
    expect(a).toMatchObject({ isPrefix: true, group: 'DAMMOD', statTarget: 'UARPGAttributeSet.AttackPower' });
  });

  it('lists tiers with ascending gates, and spawn types as the union over tiers', () => {
    const t = seeds[1].data.tiers as { tier: number; minItemLevel: number }[];
    expect(t.map((x) => [x.tier, x.minItemLevel])).toEqual([[1, 1], [2, 8]]);
    expect((seeds[2].data.spawn as { itemTypes: string[] }).itemTypes.sort()).toEqual(['Bow', 'Weapon']);
  });

  it('declares a power with no PoF home as a gap, never a target', () => {
    const leech = seedAffixSteps(fams.find((f) => f.entity.id === 'd1-affix-suffix-steallife')!.entity);
    expect((leech[0].data.affix as Record<string, unknown>).statTarget).toBe(REFERENCE_GAP);
    expect(leech[0].gaps.join(' ')).toMatch(/leech/);
  });
});
