// Decoders exist because the real Diablo cells are not the values PoF wants. Every case here
// is a vocabulary observed in the downloaded tables on 2026-09-22, not an invented one.
import { describe, it, expect } from 'vitest';
import { applyDecode, dropValues, split, unwrap } from '@/lib/catalog/ingest/decode';
import { ingestTable } from '@/lib/catalog/ingest/run';
import { ITEM_MAP, MONSTER_MAP, SPELL_MAP, provenanceFor } from '@/lib/catalog/ingest/diablo1';
import { mapped } from '@/lib/catalog/ingest/fieldMap';

describe('applyDecode', () => {
  it('a blank cell yields nothing, with or without steps', () => {
    expect(applyDecode('')).toEqual([]);
    expect(applyDecode('  ', [split(',')])).toEqual([]);
  });

  it('splits a flag list (monstdat.abilityFlags)', () => {
    expect(applyDecode('SEARCH,CAN_OPEN_DOOR', [split(',')])).toEqual(['SEARCH', 'CAN_OPEN_DOOR']);
  });

  it('drops a sentinel (itemdat.spell = Null on 142/168 rows)', () => {
    expect(applyDecode('Null', [dropValues('Null')])).toEqual([]);
    expect(applyDecode('Fireball', [dropValues('Null')])).toEqual(['Fireball']);
  });

  it('unwraps a reference and drops a non-matching value (monstdat.treasure)', () => {
    const steps = [dropValues('None'), unwrap('^Uniq\\((.+)\\)$')];
    expect(applyDecode('Uniq(CLEAVER)', steps)).toEqual(['CLEAVER']);
    expect(applyDecode('None', steps)).toEqual([]);
  });

  it('decoders are DATA — a map carrying them survives JSON unchanged', () => {
    const rule = mapped('links[role=x]', dropValues('None'), unwrap('^A\\((.+)\\)$'));
    expect(JSON.parse(JSON.stringify(rule))).toEqual(rule);
  });
});

describe('the Diablo mapping on the real sentinel vocabularies', () => {
  const opts = (map: typeof MONSTER_MAP, key: string, file: string, catalogId: string) =>
    ({ catalogId, sourceFile: file, keyColumn: key, map, provenanceFor, idPrefix: 'd1' });

  it('a monster with treasure `None` has no link; `Uniq(CLEAVER)` links the unique item', () => {
    const cols = Object.keys(MONSTER_MAP);
    const row = (o: Record<string, string>) => cols.map((c) => o[c] ?? '').join('\t');
    const tsv = [cols.join('\t'), row({ _monster_id: 'MT_A', treasure: 'None' }), row({ _monster_id: 'MT_B', treasure: 'Uniq(CLEAVER)', abilityFlags: 'SEARCH,CAN_OPEN_DOOR' })].join('\n');
    const [a, b] = ingestTable(tsv, opts(MONSTER_MAP, '_monster_id', 'monsters/monstdat.tsv', 'bestiary')).entities;
    expect(a.links).toBeUndefined();
    expect(b.links).toEqual([{ catalogId: 'items', entityId: 'CLEAVER', role: 'unique-drop' }]);
    expect(b.data.behaviorFlags).toEqual(['SEARCH', 'CAN_OPEN_DOOR']);
    expect(b.data.abilities).toBeUndefined();
  });

  it('an item whose spell is `Null` links to no ability', () => {
    const cols = Object.keys(ITEM_MAP);
    const row = (o: Record<string, string>) => cols.map((c) => o[c] ?? '').join('\t');
    const tsv = [cols.join('\t'), row({ id: 'IDI_X', spell: 'Null' }), row({ id: 'IDI_Y', spell: 'Fireball' })].join('\n');
    const [x, y] = ingestTable(tsv, opts(ITEM_MAP, 'id', 'items/itemdat.tsv', 'items')).entities;
    expect(x.links).toBeUndefined();
    expect(y.links).toEqual([{ catalogId: 'spellbook', entityId: 'Fireball', role: 'ability' }]);
  });

  it('a spell keeps its element among its traits and drops the -1 book level', () => {
    const cols = Object.keys(SPELL_MAP);
    const row = (o: Record<string, string>) => cols.map((c) => o[c] ?? '').join('\t');
    const tsv = [cols.join('\t'), row({ id: 'Identify', flags: 'Magic,AllowedInTown', bookLevel: '-1', missiles: 'FlashBottom,FlashTop' })].join('\n');
    const [s] = ingestTable(tsv, opts(SPELL_MAP, 'id', 'spells/spelldat.tsv', 'spellbook')).entities;
    expect(s.data.traits).toEqual(['Magic', 'AllowedInTown']);
    expect(s.data.tier).toBeUndefined();
    expect(s.data.missiles).toEqual(['FlashBottom', 'FlashTop']);
  });
});
