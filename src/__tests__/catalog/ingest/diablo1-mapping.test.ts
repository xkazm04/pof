// The mapping tables are checked against the REAL upstream headers, captured from
// DevilutionX's `assets/txtdata` on 2026-09-22. Checking a mapping against fixtures I
// invented would only prove the mapping agrees with itself; these are the actual column
// orders of the actual files, so `unclassified` going non-empty means the upstream table
// gained a column and nobody has judged it, and `declaredButAbsent` means it lost one.
//
// Column NAMES are schema, not design data — the values stay out of this repo (see the
// licence note in `diablo1.ts`).
import { describe, it, expect } from 'vitest';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { applyDecode } from '@/lib/catalog/ingest/decode';
import { MONSTER_MAP, ITEM_MAP, SPELL_MAP, TARGET_GAPS, provenanceFor } from '@/lib/catalog/ingest/diablo1';

const REAL_HEADERS: Record<string, string[]> = {
  // assets/txtdata/monsters/monstdat.tsv — 112 rows
  monstdat: '_monster_id name assetsSuffix soundSuffix trnFile availability width image hasSpecial hasSpecialSound frames[6] rate[6] minDunLvl maxDunLvl level hitPointsMinimum hitPointsMaximum ai abilityFlags intelligence toHit animFrameNum minDamage maxDamage toHitSpecial animFrameNumSpecial minDamageSpecial maxDamageSpecial reducePlayerStrength reducePlayerMagic reducePlayerDexterity reducePlayerVitality reducePlayerMaxHP reducePlayerMaxMana armorClass monsterClass resistance resistanceHell selectionRegion treasure exp'.split(' '),
  // assets/txtdata/items/itemdat.tsv — 168 rows
  itemdat: 'id dropRate class equipType cursorGraphic itemType uniqueBaseItem name shortName minMonsterLevel durability minDamage maxDamage minArmor maxArmor minStrength minMagic minDexterity specialEffects miscId spell usable value'.split(' '),
  // assets/txtdata/spells/spelldat.tsv — 36 rows
  spelldat: 'id name soundId bookCost10 staffCost10 manaCost flags bookLevel staffLevel minIntelligence missiles manaMultiplier minMana staffMin staffMax'.split(' '),
};

const CASES = [
  { name: 'monstdat', map: MONSTER_MAP, columns: REAL_HEADERS.monstdat, expectCols: 41 },
  { name: 'itemdat', map: ITEM_MAP, columns: REAL_HEADERS.itemdat, expectCols: 23 },
  { name: 'spelldat', map: SPELL_MAP, columns: REAL_HEADERS.spelldat, expectCols: 15 },
];

describe('Diablo I mapping tables vs. the real upstream headers', () => {
  for (const c of CASES) {
    describe(c.name, () => {
      it(`covers the real column count (${c.expectCols})`, () => {
        expect(c.columns).toHaveLength(c.expectCols);
      });

      it('classifies EVERY column — nothing unclassified', () => {
        const a = auditColumns(c.columns, c.map);
        expect(a.unclassified).toEqual([]);
      });

      it('declares no column the upstream file does not have (drift guard)', () => {
        expect(auditColumns(c.columns, c.map).declaredButAbsent).toEqual([]);
      });

      it('every GAP carries a reason a reader can act on', () => {
        for (const g of auditColumns(c.columns, c.map).gap) {
          expect(g.why.length).toBeGreaterThan(20);
        }
      });
    });
  }

  it('reports real, non-trivial coverage on the genre-matched bestiary table', () => {
    const a = auditColumns(REAL_HEADERS.monstdat, MONSTER_MAP);
    // Pinned so a future edit that quietly reclassifies gaps as drops is visible.
    expect(a.mapped).toHaveLength(19);
    expect(a.dropped).toHaveLength(8);
    expect(a.gap).toHaveLength(14);
    expect(a.mapped.length + a.dropped.length + a.gap.length).toBe(41);
  });
});

describe('the art-set FAMILY key (W07)', () => {
  // `assetsSuffix` was first dropped as "a 1996 renderer detail". It is the family key: every
  // member of a family shares one asset set (`<set folder>\<file prefix>`) and differs by a
  // palette swap, so W06 had to type the family head on the command line. The FOLDER is the key.
  const rule = MONSTER_MAP.assetsSuffix;
  it('is mapped, not dropped', () => {
    expect(rule.kind).toBe('mapped');
  });
  it('keeps the set folder, not the file prefix', () => {
    const decode = rule.kind === 'mapped' ? rule.decode : undefined;
    expect(applyDecode('famdir\\fileprefix', decode)).toEqual(['famdir']);
    expect(applyDecode('', decode)).toEqual([]);
  });
});

describe('target-side gaps (PoF fields no source can fill)', () => {
  it('no target field is unpersistable any more (G1 fixed: icon → iconKey)', () => {
    expect(TARGET_GAPS.filter((g) => g.kind === 'unpersistable')).toEqual([]);
    expect(TARGET_GAPS.find((g) => g.field === 'iconKey')).toMatchObject({ catalogId: 'bestiary', kind: 'presentation' });
  });

  it('separates a GENRE ASSUMPTION from a merely-derived field', () => {
    // The distinction is the point: a derived field needs a formula, a genre assumption
    // needs a schema decision.
    const genre = TARGET_GAPS.filter((g) => g.kind === 'genre-assumption').map((g) => `${g.catalogId}.${g.field}`);
    expect(genre).toContain('spellbook.cooldown');
    expect(genre).toContain('items.rarity');
  });
});

describe('provenance', () => {
  it('carries the licence note on every row, not in a README the row can be separated from', () => {
    const p = provenanceFor('monsters/monstdat.tsv', '_monster_id=MT_NZOMBIE');
    expect(p.kind).toBe('ingest');
    expect(p.sourceRow).toContain('MT_NZOMBIE');
    expect(p.licenceNote).toMatch(/do not ship/i);
    expect(Date.parse(p.ingestedAt)).not.toBeNaN();
  });
});
