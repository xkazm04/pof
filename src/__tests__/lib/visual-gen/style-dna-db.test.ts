import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  createStyleDnaDb,
  saveStyleDna,
  getActiveStyleDna,
  listStyleDna,
  setActiveStyleDna,
  deleteStyleDna,
  styleDnaForProfile,
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

// /diablo W03 (D13): style resolves per canon profile. W02d rendered a Diablo zombie through the ONE
// global style — PoF's — because nothing else existed to resolve.
describe('style per canon profile', () => {
  it('a style bound to a canon profile never becomes the project’s active style', () => {
    saveStyleDna(db, { name: 'PoF', dna: DNA, sourceImageCount: 3 });
    const d1 = saveStyleDna(db, { name: 'Diablo I', dna: { ...DNA, render: ['prerendered'] }, sourceImageCount: 0, canonProfile: 'diablo1' });
    expect(d1.active).toBe(false);
    expect(d1.canonProfile).toBe('diablo1');
    expect(getActiveStyleDna(db)?.name).toBe('PoF');
    expect(setActiveStyleDna(db, d1.id)).toBe(false);
  });

  it('resolves the project’s style for pof / no profile, and ONLY the bound style for another canon', () => {
    saveStyleDna(db, { name: 'PoF', dna: DNA, sourceImageCount: 3 });
    expect(styleDnaForProfile(db, 'diablo1')).toBeNull(); // never PoF's style on a Diablo entity
    saveStyleDna(db, { name: 'Diablo I', dna: DNA, sourceImageCount: 0, canonProfile: 'diablo1' });
    expect(styleDnaForProfile(db, 'diablo1')?.name).toBe('Diablo I');
    expect(styleDnaForProfile(db, 'pof')?.name).toBe('PoF');
    expect(styleDnaForProfile(db, null)?.name).toBe('PoF');
  });

  it('binding to the default profile is the same as an unbound save', () => {
    const p = saveStyleDna(db, { name: 'explicit pof', dna: DNA, sourceImageCount: 1, canonProfile: 'pof' });
    expect(p.active).toBe(true);
    expect(p.canonProfile).toBeNull();
  });

  it('migrates a pre-W03 table (no canon_profile column) in place', () => {
    const old = new Database(':memory:');
    old.exec(`CREATE TABLE style_dna (id TEXT PRIMARY KEY, name TEXT NOT NULL, dna TEXT NOT NULL,
      source_image_count INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
    old.prepare("INSERT INTO style_dna (id, name, dna, active) VALUES ('a', 'legacy', ?, 1)").run(JSON.stringify(DNA));
    expect(styleDnaForProfile(old, null)?.name).toBe('legacy');
    expect(styleDnaForProfile(old, 'diablo1')).toBeNull();
  });
});
