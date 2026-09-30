// /diablo W11 (D1): Diablo I's affix tables (items/item_prefixes.tsv, items/item_suffixes.tsv) → the affixes catalog.
// Real upstream HEADERS only (column names are schema); values never enter the repo.
import { describe, it, expect } from 'vitest';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { AFFIX_MAP, AFFIX_POWERS, affixTargetsOf } from '@/lib/catalog/ingest/diablo1Affixes';

// assets/txtdata/items/item_prefixes.tsv (83 rows) and item_suffixes.tsv (95 rows) share one header, captured 2026-09-24.
const HEADER = 'name power power.value1 power.value2 minLevel itemTypes alignment chance useful minVal maxVal multVal'.split(' ');

describe('AFFIX_MAP', () => {
  const a = auditColumns(HEADER, AFFIX_MAP);
  it('classifies every column of the real header', () => {
    expect(a.unclassified).toEqual([]);
    expect(a.declaredButAbsent).toEqual([]);
  });
  it('maps the family, the tier range, the item-level gate, the spawn types and the weight', () => {
    for (const c of ['name', 'power', 'power.value1', 'power.value2', 'minLevel', 'itemTypes', 'alignment', 'chance']) {
      expect(AFFIX_MAP[c].kind).toBe('mapped');
    }
  });
  it('every gap carries a reason a reader can act on', () => {
    for (const g of a.gap) expect(g.why.length).toBeGreaterThan(20);
  });
});

describe('the power vocabulary', () => {
  it('maps a stat power to its PoF attribute, and its CURSE to the same target reversed', () => {
    expect(affixTargetsOf('STR')).toMatchObject({ targets: ['UARPGAttributeSet.Strength'], sign: 1, grade: 'full' });
    expect(affixTargetsOf('STR_CURSE')).toMatchObject({ targets: ['UARPGAttributeSet.Strength'], sign: -1, grade: 'full' });
  });
  it('spreads an all-resistances power over every Diablo element', () => {
    expect(affixTargetsOf('ALLRES')?.targets).toEqual(['UARPGAttributeSet.FireResistance', 'UARPGAttributeSet.LightningResistance', 'UARPGAttributeSet.MagicResistance']);
  });
  it('names a power with no PoF home as a gap with a reason, never a target', () => {
    const g = affixTargetsOf('STEALLIFE');
    expect(g?.targets).toEqual([]);
    expect(g?.grade).toBe('dropped');
    expect(g?.reason.length).toBeGreaterThan(15);
  });
  it('refuses a power the vocabulary has never seen (an upstream addition is a defect, not a silent drop)', () => {
    expect(affixTargetsOf('NEWPOWER')).toBeNull();
  });
  it('declares every power the real tables use', () => {
    for (const p of ['TOHIT', 'ACP', 'TOHIT_DAMP', 'DAMP', 'MANA', 'LIFE', 'DAMMOD', 'VIT', 'STR', 'MAGICRES', 'MAG', 'LIGHTRES', 'GETHIT', 'FIRERES', 'DUR', 'DEX', 'ATTRIBS', 'ALLRES', 'FASTATTACK', 'TARGAC', 'LIGHT_ARROWS', 'FIRE_ARROWS', 'FASTRECOVER', 'STEALMANA', 'STEALLIFE', 'SPLLVLADD', 'LIGHT', 'CHARGES', 'THORNS', 'NOMANA', 'LIGHTDAM', 'KNOCKBACK', 'INDESTRUCTIBLE', 'FIREDAM', 'FASTBLOCK', 'ABSHALFTRAP']) {
      expect(AFFIX_POWERS[p], p).toBeDefined();
    }
  });
});
