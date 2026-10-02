/**
 * Tune a Style DNA without re-paying: the pure edit/preview core (style-dna-edit.ts) and the
 * fork write (forkStyleDna). The preview must report the REAL fragment — the one
 * styleDnaToPromptFragment builds and applyStyleFragment appends — and name every chip that
 * never reaches a prompt, with why. A fork is a new row; the parent's content is never touched.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyStyleFragment, styleDnaToPromptFragment, type StyleDna } from '@/lib/visual-gen/style-dna';
import { editDna, styleFragmentPreview, validateStyleDna } from '@/lib/visual-gen/style-dna-edit';
import {
  createStyleDnaDb,
  forkStyleDna,
  getActiveStyleDna,
  getStyleDna,
  listStyleDna,
  saveStyleDna,
} from '@/lib/visual-gen/style-dna-db';
import { DIABLO1_STYLE_DNA } from '@/lib/catalog/canon/profiles/diablo1Style';

const DNA: StyleDna = {
  palette: ['ash gray', 'ember orange'],
  materials: ['cracked stone', 'rusted iron', 'bone', 'wet leather', 'tarnished silver', 'rotten wood'],
  mood: ['grim', 'Neon', 'oppressive'],
  render: ['painterly'],
  motifs: ['skulls'],
};

describe('styleFragmentPreview — the real fragment, with every unsent chip named', () => {
  it('case 1: chips past the per-dim cap are unsent with reason cap; the fragment is the real one', () => {
    const preview = styleFragmentPreview(DNA);
    expect(preview.rows.materials.sent).toEqual(DNA.materials.slice(0, 4));
    expect(preview.rows.materials.unsent).toEqual([
      { item: 'tarnished silver', reason: 'cap' },
      { item: 'rotten wood', reason: 'cap' },
    ]);
    expect(preview.fragment).toBe(styleDnaToPromptFragment(DNA));
    expect(preview.rows.mood.unsent).toEqual([]);
    expect(preview.cut).toBe(false);
  });

  it('case 2: the diablo1 shipped style behind a 1300-char prompt — the budget cut, measured', () => {
    const preview = styleFragmentPreview(DIABLO1_STYLE_DNA, { promptChars: 1300, maxLength: 1500 });
    const fragment = styleDnaToPromptFragment(DIABLO1_STYLE_DNA);
    const applied = applyStyleFragment('x'.repeat(1300), fragment, 1500);
    expect(preview).toMatchObject({ fragmentChars: 1034, fragmentCharsSent: 198, cut: true });
    expect(applied.length - 1302).toBe(preview.fragmentCharsSent);
    expect(fragment.length).toBe(preview.fragmentChars);

    // Every chip lying wholly past the cut is unsent with reason 'budget'.
    for (const [dim, items] of Object.entries(DIABLO1_STYLE_DNA) as [keyof StyleDna, string[]][]) {
      for (const item of items) {
        const at = fragment.indexOf(item);
        if (at >= 198) expect(preview.rows[dim].unsent).toContainEqual({ item, reason: 'budget' });
        if (at + item.length <= 198) expect(preview.rows[dim].sent).toContain(item);
      }
    }
  });

  it('case 9: a cut preview NAMES what it dropped — the cap, the budget, and the chip cut mid-word', () => {
    const capped = styleFragmentPreview(DNA);
    expect(capped.dropped.join('\n')).toContain('2 materials not sent (cap 4)');
    expect(capped.dropped.join('\n')).toContain('tarnished silver');

    const cut = styleFragmentPreview(DIABLO1_STYLE_DNA, { promptChars: 1300, maxLength: 1500 });
    const partial = 'in dark interiors, predominantly sub-midgray non-emissive values';
    expect(cut.rows.palette.unsent).toContainEqual({ item: partial, reason: 'cut', keptChars: 4 });
    const text = cut.dropped.join('\n');
    expect(text).toContain(partial);
    expect(text).toContain('sparse angular surface breaks');
    expect(text).toMatch(/16 chips? past the 1500-char budget/);

    expect(styleFragmentPreview(DIABLO1_STYLE_DNA).dropped).toEqual([]);
  });
});

describe('editDna — remove / add / promote, one dim at a time', () => {
  it('case 3: remove drops the chip; add dedupes trimmed + case-insensitive; promote moves into the sent four', () => {
    const removed = editDna(DNA, { op: 'remove', dim: 'mood', item: 'Neon' });
    expect(removed.mood).toEqual(['grim', 'oppressive']);
    for (const dim of ['palette', 'materials', 'render', 'motifs'] as const) expect(removed[dim]).toEqual(DNA[dim]);

    expect(editDna(DNA, { op: 'add', dim: 'mood', item: ' neon ' })).toEqual(DNA);
    expect(editDna(DNA, { op: 'add', dim: 'mood', item: ' ashen ' }).mood).toEqual([...DNA.mood, 'ashen']);

    const promoted = editDna(DNA, { op: 'promote', dim: 'materials', item: 'rotten wood' });
    expect(promoted.materials[0]).toBe('rotten wood');
    expect(styleFragmentPreview(promoted).rows.materials.sent).toContain('rotten wood');
    expect(DNA.materials[5]).toBe('rotten wood'); // the input is never mutated
  });
});

describe('validateStyleDna', () => {
  it('case 4: an all-empty style and an over-long chip are refused with the reason', () => {
    const empty = validateStyleDna({ palette: [], materials: [], mood: [], render: [], motifs: [] });
    expect(empty).toEqual({ ok: false, error: 'style has no chips — nothing would be appended' });
    const long = validateStyleDna({ ...DNA, render: ['x'.repeat(81)] });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.error).toContain('render');
    expect(validateStyleDna(DNA)).toEqual({ ok: true, data: DNA });
  });
});

describe('forkStyleDna — a correction is a copy', () => {
  let dir: string;
  let db: Database.Database;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pof-style-dna-edit-'));
    db = new Database(join(dir, 'style.db'));
    createStyleDnaDb(db);
  });
  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('case 5: an unbound fork becomes active; the parent stays, content untouched, inactive', () => {
    const parent = saveStyleDna(db, { name: 'Ashen', dna: DNA, sourceImageCount: 5 });
    const before = listStyleDna(db).length;
    const edited = editDna(DNA, { op: 'remove', dim: 'mood', item: 'Neon' });
    const child = forkStyleDna(db, parent.id, { name: 'Ashen (edited)', dna: edited });

    expect(child).not.toBeNull();
    expect(child!.active).toBe(true);
    expect(child!.sourceImageCount).toBe(5);
    expect(child!.dna).toEqual(edited);
    expect(getActiveStyleDna(db)?.id).toBe(child!.id);
    expect(listStyleDna(db)).toHaveLength(before + 1);
    const kept = getStyleDna(db, parent.id)!;
    expect(kept.active).toBe(false);
    expect({ ...kept, active: true }).toEqual(parent); // name, dna, count, createdAt, canon: unchanged
  });

  it('case 6: a canon-bound source is refused — no row, no change to the project style', () => {
    const project = saveStyleDna(db, { name: 'Project', dna: DNA, sourceImageCount: 3 });
    const bound = saveStyleDna(db, { name: 'Diablo board', dna: DNA, sourceImageCount: 2, canonProfile: 'diablo1' });
    const rows = JSON.stringify(listStyleDna(db));

    expect(forkStyleDna(db, bound.id, { name: 'Diablo (edited)', dna: DNA })).toBeNull();
    expect(forkStyleDna(db, 'dna-missing', { name: 'x', dna: DNA })).toBeNull();
    expect(JSON.stringify(listStyleDna(db))).toBe(rows);
    expect(getActiveStyleDna(db)?.id).toBe(project.id);
  });
});
