import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  createStyleDnaDb,
  deleteStyleDna,
  getActiveStyleDna,
  getStyleDna,
  listStyleDna,
  saveStyleDna,
} from '@/lib/visual-gen/style-dna-db';
import { styleDnaToPromptFragment, type StyleDna } from '@/lib/visual-gen/style-dna';

const DNA: StyleDna = { palette: ['ochre'], materials: ['iron'], mood: ['grim'], render: ['painterly'], motifs: [] };

let db: Database.Database;
const insert = (id: string, dna: string, active = 0) =>
  db.prepare('INSERT INTO style_dna (id, name, dna, active) VALUES (?, ?, ?, ?)').run(id, id, dna, active);

beforeEach(() => {
  db = new Database(':memory:');
  createStyleDnaDb(db);
});

describe('an unreadable style_dna row is contained to that row', () => {
  it('the list still returns every readable profile', () => {
    saveStyleDna(db, { name: 'good', dna: DNA, sourceImageCount: 1 });
    insert('bad', '{not json');
    expect(listStyleDna(db).map((p) => p.name)).toEqual(['good']);
  });

  it('an unreadable active row reads as no active style instead of throwing', () => {
    insert('bad', '{not json', 1);
    expect(getActiveStyleDna(db)).toBeNull();
    expect(getStyleDna(db, 'bad')).toBeNull();
  });

  it('the unreadable row can still be deleted', () => {
    insert('bad', '{not json');
    expect(deleteStyleDna(db, 'bad')).toBe(true);
  });

  it('a row missing a dimension reads with that dimension empty, so the fragment cannot throw', () => {
    insert('old', JSON.stringify({ palette: ['ochre'], mood: ['grim'] }), 1);
    const dna = getActiveStyleDna(db)!.dna;
    expect(dna.materials).toEqual([]);
    expect(styleDnaToPromptFragment(dna)).toContain('ochre');
  });

  it('a row of the wrong JSON shape is unreadable', () => {
    insert('arr', '[1,2]', 1);
    expect(getActiveStyleDna(db)).toBeNull();
  });
});
