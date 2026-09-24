// `ingestTable` builds the entity and the coverage report from ONE mapping table, so the
// two cannot drift. These fixtures use the real monstdat column order with two rows whose
// values are trimmed to what each assertion needs.
import { describe, it, expect } from 'vitest';
import { ingestTable } from '@/lib/catalog/ingest/run';
import { MONSTER_MAP, provenanceFor } from '@/lib/catalog/ingest/diablo1';
import { jsonUnsafeKeys } from '@/lib/catalog/entityPayload';

const HEADER = '_monster_id name assetsSuffix soundSuffix trnFile availability width image hasSpecial hasSpecialSound frames[6] rate[6] minDunLvl maxDunLvl level hitPointsMinimum hitPointsMaximum ai abilityFlags intelligence toHit animFrameNum minDamage maxDamage toHitSpecial animFrameNumSpecial minDamageSpecial maxDamageSpecial reducePlayerStrength reducePlayerMagic reducePlayerDexterity reducePlayerVitality reducePlayerMaxHP reducePlayerMaxMana armorClass monsterClass resistance resistanceHell selectionRegion treasure exp'.split(' ');

function row(over: Record<string, string>): string {
  return HEADER.map((c) => over[c] ?? '').join('\t');
}

const TSV = [
  HEADER.join('\t'),
  row({ _monster_id: 'MT_NZOMBIE', name: 'Zombie', level: '1', hitPointsMinimum: '2', hitPointsMaximum: '4', ai: 'Zombie', armorClass: '5', monsterClass: 'Undead', exp: '54', minDamage: '2', maxDamage: '5' }),
  row({ _monster_id: 'MT_BZOMBIE', name: 'Ghoul', level: '2', hitPointsMinimum: '3', hitPointsMaximum: '7', ai: 'Zombie', armorClass: '10', monsterClass: 'Undead', exp: '58', treasure: 'Uniq(CLEAVER)' }),
].join('\n');

const OPTS = {
  catalogId: 'bestiary',
  sourceFile: 'monsters/monstdat.tsv',
  keyColumn: '_monster_id',
  map: MONSTER_MAP,
  provenanceFor,
  idPrefix: 'd1',
};

describe('ingestTable', () => {
  it('produces one entity per row, id-prefixed so it cannot collide with a code seed', () => {
    const r = ingestTable(TSV, OPTS);
    expect(r.entities.map((e) => e.id)).toEqual(['d1-MT_NZOMBIE', 'd1-MT_BZOMBIE']);
    expect(r.entities[0].catalogId).toBe('bestiary');
    expect(r.entities[0].name).toBe('Zombie');
  });

  it('routes a `data.stats[Label]` rule into the {label,value}[] the UI expects', () => {
    const stats = ingestTable(TSV, OPTS).entities[0].data.stats as { label: string; value: string }[];
    expect(stats).toContainEqual({ label: 'Level', value: '1' });
    expect(stats).toContainEqual({ label: 'HP Max', value: '4' });
    expect(stats).toContainEqual({ label: 'XP', value: '54' });
  });

  it('SKIPS a blank cell instead of writing an empty value', () => {
    // A blank `treasure` means "drops nothing", not "drops the empty string" — and an
    // empty stat row would render as a real, wrong number in the bestiary UI.
    const [zombie, ghoul] = ingestTable(TSV, OPTS).entities;
    expect(zombie.links).toBeUndefined();
    // Real vocabulary (the first fixture invented `GoldSmall`, which never occurs in monstdat).
    expect(ghoul.links).toEqual([{ catalogId: 'items', entityId: 'CLEAVER', role: 'unique-drop' }]);
    const stats = zombie.data.stats as { label: string }[];
    expect(stats.map((s) => s.label)).not.toContain('Special Damage Min');
  });

  it('carries per-row provenance including the licence note', () => {
    const p = ingestTable(TSV, OPTS).entities[0].provenance;
    expect(p.sourceRow).toBe('_monster_id=MT_NZOMBIE');
    expect(p.sourceFile).toBe('monsters/monstdat.tsv');
    expect(p.licenceNote).toMatch(/Blizzard/);
  });

  it('every produced entity is persistable — the ingest cannot emit a hollow payload', () => {
    // The guard that would have caught the `icon` defect at the source.
    for (const e of ingestTable(TSV, OPTS).entities) {
      expect(jsonUnsafeKeys(e)).toEqual([]);
    }
  });

  it('never turns a BOOLEAN column into a list member', () => {
    // Regression from the first live run: `hasSpecial` is "true"/"false" and was mapped
    // onto `data.abilities`, producing a monster whose ability was named "false". The
    // fixture that missed it left the column blank — real output did not.
    const boolRow = [HEADER.join('\t'), row({ _monster_id: 'MT_X', name: 'X', hasSpecial: 'false' })].join('\n');
    const e = ingestTable(boolRow, OPTS).entities[0];
    expect(e.data.abilities).toBeUndefined();
    expect(e.data.hasSpecialAttack).toBe('false');
  });

  it('reports the same audit the mapping implies, alongside the entities', () => {
    const r = ingestTable(TSV, OPTS);
    expect(r.audit.mapped).toHaveLength(23);
    expect(r.audit.gap).toHaveLength(11);
    expect(r.audit.unclassified).toEqual([]);
  });

  it('falls back to POSITIONAL identity when the key column is blank, and says so', () => {
    // Measured on the real itemdat.tsv: only 50 of 168 rows carry a symbolic `id`. Dropping
    // the other 118 (the first behaviour this had) loses two-thirds of the table invisibly.
    const withBlank = [TSV, row({ name: 'Nameless' })].join('\n');
    const r = ingestTable(withBlank, OPTS);
    expect(r.entities).toHaveLength(3);
    expect(r.entities[2].id).toBe('d1-row2');
    expect(r.entities[2].provenance.sourceRow).toBe('row=2');
    expect(r.positionalIds).toBe(1);
  });

  it('reports colliding keys instead of letting the last row win', () => {
    // The trap on the other side: `name` looks like a key for itemdat and repeats 21 times.
    const dupes = [
      HEADER.join('\t'),
      row({ _monster_id: 'MT_X', name: 'First' }),
      row({ _monster_id: 'MT_X', name: 'Second' }),
    ].join('\n');
    const r = ingestTable(dupes, OPTS);
    expect(r.duplicateKeys).toEqual([{ key: 'MT_X', rows: [0, 1] }]);
    expect(r.entities).toHaveLength(2);
  });

  it('with NO key column at all, every row gets a positional identity', () => {
    const r = ingestTable(TSV, { ...OPTS, keyColumn: undefined });
    expect(r.entities.map((e) => e.id)).toEqual(['d1-row0', 'd1-row1']);
    expect(r.positionalIds).toBe(2);
    expect(r.duplicateKeys).toEqual([]);
  });

  it('surfaces a malformed row instead of shifting its cells into the wrong columns', () => {
    const r = ingestTable([HEADER.join('\t'), 'MT_X\tShort'].join('\n'), OPTS);
    expect(r.malformed).toHaveLength(1);
    expect(r.malformed[0].actual).toBe(2);
    expect(r.entities).toHaveLength(0);
  });
});

describe('positional identity is scoped by a table tag (W11)', () => {
  // Two positional tables projected into ONE catalog (Diablo's affix prefixes and suffixes) both produced `d1-row5`.
  it('prefixes a positional key with the table tag; a declared key is unchanged', () => {
    const tsv = ['_monster_id\tname', '\tNameless', 'MT_X\tKeyed'].join('\n');
    const r = ingestTable(tsv, { ...OPTS, positionalTag: 'pre-' });
    expect(r.entities.map((e) => e.id)).toEqual(['d1-pre-row0', 'd1-MT_X']);
  });
});
