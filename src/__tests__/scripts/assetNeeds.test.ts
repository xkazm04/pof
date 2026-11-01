import { describe, expect, it } from 'vitest';
import { buildBpAssetNeeds, inventoryRow, manifestTris, parseBudgetCell, type BpFiles } from '@/lib/asset-needs/bp';
import { newestScorecard, parsePassRule, parseScorecard } from '@/lib/asset-needs/score';
import { serializeAssetNeeds, validateAssetNeeds } from '@/lib/asset-needs/schema';

const SHA = 'a'.repeat(40);
const META = { generatedAt: '2026-10-25T00:00:00.000Z', commit: SHA, pofCommit: 'b'.repeat(40) };
const pass = { pass: true, note: '', date: '2026-10-25' };

const manifest = (o: Record<string, unknown>) => JSON.stringify({ gates: { input: pass, poly_budget: pass }, ...o });

const SCORECARD = [
  '# Run note',
  '',
  '| # | Element | Before | Now | What still differs |',
  '|---|---|---|---|---|',
  '| 1 | Lit table | 1 | 2 | The rim band is thick |',
  '| 7 | Amber pins with tags | 0 | **0** | Not built (L5) |',
  '| 9 | Lamp agent | 0 | 1 | It reads as a desk lamp |',
  '| 10 | Decision card | 0 | **0** | Not built (L5) |',
  '| | **Total** | **1 / 12** | **3 / 12** | |',
].join('\n');

const BREAKDOWN = [
  '| # | In the image | In bp | Built as | Notes |',
  '|---|---|---|---|---|',
  '| 1 | Backlit glass table | the drawing board | procedural mesh + shader | emissive strip |',
  '| 7 | Amber pins with paper tags | scan findings | data + generated + text layer | pin mesh generated once |',
  '| 9 | The lamp agent | the daemon | generated (TRELLIS.2) + finished + rigged | states from events |',
  '| 10 | The decision card | a gated action | data + text layer | the payload |',
  '| 13 | Dark studio: shelves | the place you work in | generated props + generated textures | a small kit, static |',
  '',
  'Pass: no element below 2, and elements 1, 7 and 9 at 3. These carry the concept.',
].join('\r\n');

const PLAN = [
  '| Asset | Budget (triangles, guide) | Notes |',
  '|---|---|---|',
  '| Lamp agent: head, arm | 30k | rigged |',
  '| Survey pin | 500, instanced | text layer |',
  '| Studio kit (shelves) | 80k total | static |',
  '| City backdrop | n/a | matte |',
].join('\n');

const files = (over: Partial<BpFiles> = {}): BpFiles => ({
  manifests: [
    { folder: 'lamp-agent', text: manifest({ id: 'lamp-agent', class: 'character-prop', tris: 14730, budget_tris: 15000 }) },
    { folder: 'survey-pin', text: manifest({ id: 'survey-pin', class: 'prop-instanced', tris: 468 }) },
    { folder: 'light-table-frame', text: manifest({ id: 'light-table-frame', class: 'prop-hero', tris: 8082, budget_tris: 10000 }) },
    { folder: 'mat-vellum', text: manifest({ id: 'mat-vellum', class: 'material', gates: { input: pass, tiling: { pass: false } } }) },
  ],
  scorecard: { path: 'docs/runs/2026-10-24-x.md', text: SCORECARD },
  breakdown: BREAKDOWN,
  plan: PLAN,
  ...over,
});

const built = (f: BpFiles = files()) => {
  const r = buildBpAssetNeeds(f, META);
  if (!r.ok) throw new Error(r.error.join('; '));
  return r.data;
};

describe('bp manifests -> inventory', () => {
  it('maps every bp class to a gravitone class, or none for materials, backdrops and hand captures', () => {
    const cls = (c: string) => inventoryRow('x', { class: c }).gravitoneClass;
    expect(cls('character-prop')).toBe('character');
    for (const c of ['prop-hero', 'prop-instanced', 'prop-instanced-kit', 'studio-kit', 'set-dressing']) expect(cls(c)).toBe('prop');
    for (const c of ['material', 'backdrop-matte', 'capture-hands', 'something-new']) expect(cls(c)).toBeUndefined();
  });

  it('counts tris the way bp check-art does: summed, the largest mesh when the budget is per mesh', () => {
    expect(manifestTris({ tris: { a: 100, b: 50 } })).toBe(150);
    expect(manifestTris({ tris: { a: 100, b: 50 }, budget_note: 'per mesh (800 each)' })).toBe(100);
    expect(manifestTris({})).toBeUndefined();
  });

  it('omits absent values instead of writing null, and reads gate pass flags', () => {
    const mat = built().inventory.find((r) => r.id === 'mat-vellum')!;
    expect(mat).toEqual({ id: 'mat-vellum', name: 'Vellum material', class: 'material', gates: { input: true, tiling: false } });
    expect(serializeAssetNeeds(built())).not.toContain('null');
  });

  it('names an unknown class in the rules notes', () => {
    const doc = built(files({ manifests: [...files().manifests, { folder: 'odd', text: manifest({ class: 'hologram' }) }] }));
    expect(doc.rules.notes.some((n) => n.includes('"hologram"'))).toBe(true);
    expect(doc.inventory.find((r) => r.id === 'odd')!.gravitoneClass).toBeUndefined();
  });
});

describe('scorecard -> scored-low needs', () => {
  it('parses the element table, bold scores included, and skips the total row', () => {
    const r = parseScorecard(SCORECARD);
    expect(r.ok && r.data.map((e) => [e.n, e.now])).toEqual([[1, 2], [7, 0], [9, 1], [10, 0]]);
  });

  it('reads the pass rule from the project file (CRLF tolerated)', () => {
    const r = parsePassRule(BREAKDOWN);
    expect(r.ok && [r.data.floor, r.data.required, r.data.line]).toEqual([2, [1, 7, 9], 9]);
  });

  it('turns every element below 2 into a need, priority 1 when the pass rule requires it at 3', () => {
    const needs = built().needs.filter((n) => n.kind === 'scored-low');
    expect(needs.map((n) => [n.id, n.priority])).toEqual([
      ['need-amber-pins-with-tags', 1], ['need-lamp-agent', 1], ['need-decision-card', 2],
    ]);
    const lamp = needs.find((n) => n.id === 'need-lamp-agent')!;
    expect(lamp).toMatchObject({
      assetId: 'lamp-agent', gravitoneClass: 'character', class: 'character-prop', budgetTris: 15000,
      why: 'It reads as a desk lamp', evidence: 'docs/runs/2026-10-24-x.md:7', subject: 'The lamp agent',
    });
  });

  it('joins an element to the folder it names; the plan budget fills in when the manifest states none; unjoined stays without assetId', () => {
    const doc = built();
    expect(doc.inventory.find((r) => r.id === 'light-table-frame')!.score).toEqual({ value: 2, of: 3, source: 'docs/runs/2026-10-24-x.md' });
    const pin = doc.needs.find((n) => n.id === 'need-amber-pins-with-tags')!;
    expect([pin.assetId, pin.budgetTris]).toEqual(['survey-pin', 500]);
    const card = doc.needs.find((n) => n.id === 'need-decision-card')!;
    expect(card.assetId).toBeUndefined();
    expect(card.gravitoneClass).toBeUndefined();
    expect(card.budgetTris).toBeUndefined();
    expect(card.class).toBe('data + text layer');
  });
});

describe('breakdown -> missing needs', () => {
  it('flags a generated element with no ArtSource folder, and only generated ones', () => {
    const missing = built().needs.filter((n) => n.kind === 'missing');
    expect(missing).toEqual([{
      id: 'need-dark-studio', kind: 'missing', subject: 'Dark studio: shelves',
      class: 'generated props + generated textures', gravitoneClass: 'prop', why: 'a small kit, static',
      evidence: 'docs/concepts/vr-light-table/art-breakdown.md:7', budgetTris: 80000, priority: 2,
    }]);
  });

  it('drops the need once a folder the element names exists', () => {
    const withShelves = files({ manifests: [...files().manifests, { folder: 'studio-shelves', text: manifest({ class: 'set-dressing' }) }] });
    expect(built(withShelves).needs.some((n) => n.kind === 'missing')).toBe(false);
  });
});

describe('the contract', () => {
  it('validates what the adapter writes, and the serializer keeps contract key order', () => {
    const doc = built();
    expect(validateAssetNeeds(JSON.parse(serializeAssetNeeds(doc))).ok).toBe(true);
    expect(Object.keys(JSON.parse(serializeAssetNeeds(doc)))).toEqual(['schema', 'project', 'generatedAt', 'source', 'rules', 'inventory', 'needs']);
    expect(serializeAssetNeeds(doc).endsWith('}\n')).toBe(true);
  });

  it('refuses a bad file: a null, a wrong schema, a dangling assetId, an unknown key', () => {
    const good = JSON.parse(serializeAssetNeeds(built()));
    const bad = [
      { ...good, schema: 'asset-needs/2' },
      { ...good, rules: { ...good.rules, budgets: null } },
      { ...good, needs: [{ ...good.needs[0], assetId: 'no-such-folder' }] },
      { ...good, needs: [{ ...good.needs[0], gravitoneClass: 'vehicle' }] },
      { ...good, extra: 1 },
      { ...good, source: { ...good.source, commit: 'abc' } },
    ];
    for (const b of bad) expect(validateAssetNeeds(b).ok).toBe(false);
  });

  it('refuses to build without the pass rule rather than guessing it', () => {
    const r = buildBpAssetNeeds(files({ breakdown: BREAKDOWN.replace(/Pass:.*$/m, '') }), META);
    expect(r.ok).toBe(false);
  });

  it('picks the newest dated run note and parses budget cells', () => {
    expect(newestScorecard(['2026-10-21-a.md', 'README.md', '2026-10-24-lynx-l34.md'])).toBe('2026-10-24-lynx-l34.md');
    expect([parseBudgetCell('30k'), parseBudgetCell('500, instanced'), parseBudgetCell('80k total'), parseBudgetCell('n/a')])
      .toEqual([30000, 500, 80000, undefined]);
  });
});
