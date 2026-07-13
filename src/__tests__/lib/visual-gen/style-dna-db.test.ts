import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  createStyleDnaDb,
  saveStyleDna,
  getActiveStyleDna,
  listStyleDna,
  setActiveStyleDna,
  deleteStyleDna,
} from '@/lib/visual-gen/style-dna-db';
import type { StyleDna } from '@/lib/visual-gen/style-dna';

const DNA: StyleDna = {
  palette: ['teal'],
  materials: ['brass'],
  mood: ['melancholic'],
  render: ['painterly'],
  motifs: ['clockwork'],
};

let db: Database.Database;
beforeEach(() => {
  db = new Database(':memory:');
  createStyleDnaDb(db);
});

describe('style-dna-db', () => {
  it('saves a profile, activates it, and round-trips the DNA', () => {
    const saved = saveStyleDna(db, { name: 'Alice aesthetic', dna: DNA, sourceImageCount: 4 });
    expect(saved.active).toBe(true);
    const active = getActiveStyleDna(db);
    expect(active?.name).toBe('Alice aesthetic');
    expect(active?.dna).toEqual(DNA);
    expect(active?.sourceImageCount).toBe(4);
  });

  it('a newly saved profile becomes the single active one', () => {
    saveStyleDna(db, { name: 'first', dna: DNA, sourceImageCount: 1 });
    saveStyleDna(db, { name: 'second', dna: DNA, sourceImageCount: 2 });
    expect(getActiveStyleDna(db)?.name).toBe('second');
    expect(listStyleDna(db).filter((p) => p.active)).toHaveLength(1);
  });

  it('setActiveStyleDna switches the active profile', () => {
    const first = saveStyleDna(db, { name: 'first', dna: DNA, sourceImageCount: 1 });
    saveStyleDna(db, { name: 'second', dna: DNA, sourceImageCount: 2 });
    expect(setActiveStyleDna(db, first.id)).toBe(true);
    expect(getActiveStyleDna(db)?.name).toBe('first');
    expect(setActiveStyleDna(db, 'nope')).toBe(false);
  });

  it('deleteStyleDna removes a profile; deleting the active one leaves none active', () => {
    const only = saveStyleDna(db, { name: 'only', dna: DNA, sourceImageCount: 1 });
    expect(deleteStyleDna(db, only.id)).toBe(true);
    expect(getActiveStyleDna(db)).toBeNull();
    expect(listStyleDna(db)).toHaveLength(0);
  });
});
