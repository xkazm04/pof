/**
 * ONE canon-aware style resolver (style-apply.ts) — the rule "which Style DNA reaches this prompt,
 * and why not" that /api/leonardo used to hold inline, now shared by every server 2D route.
 *
 * The resolver restates nothing: the fragment is styleDnaToPromptFragment's, the length cap is
 * applyStyleFragment's, and what the caps drop is styleFragmentPreview's `dropped`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { styleDnaToPromptFragment, type StyleDna } from '@/lib/visual-gen/style-dna';
import { styleFragmentPreview } from '@/lib/visual-gen/style-dna-edit';
import { saveStyleDna } from '@/lib/visual-gen/style-dna-db';
import { DIABLO1_CREATURE_STYLE_DNA } from '@/lib/catalog/canon/profiles/diablo1Style';
import { applyStyle, resolveStyle, styleClause, styleRequestOf, styledPrompt } from '@/lib/visual-gen/style-apply';

const POF_DNA: StyleDna = {
  palette: ['desaturated teal', 'bruised violet'],
  materials: ['aged brass', 'lacquered oak', 'bone', 'glass', 'felt', 'tin'],
  mood: ['whimsical'],
  render: ['painterly'],
  motifs: ['clockwork'],
};
const BOUND_DNA: StyleDna = { palette: ['blood red'], materials: ['wet stone'], mood: ['dread'], render: ['gritty'], motifs: [] };
const pofItems = Object.values(POF_DNA).flat();

let db: Database.Database;
beforeEach(() => { db = new Database(':memory:'); });
afterEach(() => db.close());

describe('resolveStyle — which Style DNA reaches this prompt', () => {
  it('case 1: an active unbound profile is applied, fragment built by styleDnaToPromptFragment', () => {
    const p = saveStyleDna(db, { name: 'Alice gothic', dna: POF_DNA, sourceImageCount: 3 });
    expect(resolveStyle(db, { apply: true })).toEqual({
      fragment: styleDnaToPromptFragment(p.dna),
      applied: { id: p.id, name: p.name },
      withheld: null,
    });
  });

  it("case 2: a diablo1 creature gets diablo1's shipped creature style — never the project's", () => {
    saveStyleDna(db, { name: 'Alice gothic', dna: POF_DNA, sourceImageCount: 3 });
    const res = resolveStyle(db, { apply: true, canonProfile: 'diablo1', catalogId: 'bestiary' });
    expect(res.applied?.id).toBe('shipped:diablo1:creature');
    expect(res.fragment).toBe(styleDnaToPromptFragment(DIABLO1_CREATURE_STYLE_DNA));
    for (const item of pofItems) expect(res.fragment).not.toContain(item);
    expect(res.withheld).toBeNull();
  });

  it('case 3: an unknown canon withholds, with the reason', () => {
    saveStyleDna(db, { name: 'Alice gothic', dna: POF_DNA, sourceImageCount: 3 });
    const res = resolveStyle(db, { apply: true, canonProfile: 'no-such-canon' });
    expect(res.fragment).toBeNull();
    expect(res.applied).toBeNull();
    expect(res.withheld).toMatch(/no Style DNA is bound to canon profile "no-such-canon"/);
  });

  it('case 4: apply false resolves to nothing and the prompt stays byte-identical', () => {
    saveStyleDna(db, { name: 'Alice gothic', dna: POF_DNA, sourceImageCount: 3 });
    const res = resolveStyle(db, { apply: false });
    expect(res).toEqual({ fragment: null, applied: null, withheld: null });
    expect(styledPrompt('a sword', res, 1500)).toBe('a sword');
  });

  it('apply false never opens the database (a lazy db source is not called)', () => {
    let opened = 0;
    resolveStyle(() => { opened++; return db; }, { apply: false });
    expect(opened).toBe(0);
    resolveStyle(() => { opened++; return db; }, { apply: true });
    expect(opened).toBe(1);
  });

  it('a canon-bound profile stays isolated to its canon', () => {
    const pof = saveStyleDna(db, { name: 'Alice gothic', dna: POF_DNA, sourceImageCount: 3 });
    const bound = saveStyleDna(db, { name: 'Tristram', dna: BOUND_DNA, sourceImageCount: 2, canonProfile: 'diablo1' });
    // The project's own entities (no canon, or 'pof') never get the bound style...
    expect(resolveStyle(db, { apply: true }).applied?.id).toBe(pof.id);
    expect(resolveStyle(db, { apply: true, canonProfile: 'pof' }).applied?.id).toBe(pof.id);
    // ...and the bound canon never gets the project's.
    const d = resolveStyle(db, { apply: true, canonProfile: 'diablo1', catalogId: 'bestiary' });
    expect(d.applied?.id).toBe(bound.id);
    for (const item of pofItems) expect(d.fragment).not.toContain(item);
  });

  it('no active profile and no canon: nothing applied and nothing withheld (the leonardo behaviour)', () => {
    expect(resolveStyle(db, { apply: true })).toEqual({ fragment: null, applied: null, withheld: null });
  });
});

describe('applyStyle / styleClause — the route-facing outcome, drops named by styleFragmentPreview', () => {
  it('a long prompt reports exactly the chips styleFragmentPreview says the budget drops', () => {
    saveStyleDna(db, { name: 'Alice gothic', dna: POF_DNA, sourceImageCount: 3 });
    const prompt = 'x'.repeat(1420);
    const out = applyStyle(db, prompt, { apply: true }, 1500);
    expect(out.prompt.length).toBe(1500);
    expect(out.styleDnaApplied).toBe('Alice gothic');
    expect(out.styleDnaDropped).toEqual(styleFragmentPreview(POF_DNA, { promptChars: 1420, maxLength: 1500 }).dropped);
    expect(out.styleDnaDropped.some((s) => /budget|cut mid-chip/.test(s))).toBe(true);
  });

  it('apply false: prompt untouched, nothing reported', () => {
    saveStyleDna(db, { name: 'Alice gothic', dna: POF_DNA, sourceImageCount: 3 });
    expect(applyStyle(db, 'a sword', { apply: false })).toEqual({
      prompt: 'a sword', styleDnaApplied: null, styleDnaWithheld: null, styleDnaDropped: [],
    });
  });

  it('styleClause hands the fragment as a sentence clause (no trailing period) with the cap drops', () => {
    saveStyleDna(db, { name: 'Alice gothic', dna: POF_DNA, sourceImageCount: 3 });
    const c = styleClause(db, { apply: true });
    expect(`${c.clause}.`).toBe(styleDnaToPromptFragment(POF_DNA));
    expect(c.outcome.styleDnaApplied).toBe('Alice gothic');
    expect(c.outcome.styleDnaDropped).toEqual(styleFragmentPreview(POF_DNA).dropped);
    expect(styleClause(db, { apply: false }).clause).toBeNull();
  });

  it('styleRequestOf reads only the three optional fields, strictly typed', () => {
    expect(styleRequestOf({ applyStyleDna: true, canonProfile: 'diablo1', catalogId: 'bestiary' }))
      .toEqual({ apply: true, canonProfile: 'diablo1', catalogId: 'bestiary' });
    expect(styleRequestOf({ applyStyleDna: 'yes', canonProfile: 3 })).toEqual({ apply: false, canonProfile: null, catalogId: null });
    expect(styleRequestOf(null)).toEqual({ apply: false, canonProfile: null, catalogId: null });
  });
});
