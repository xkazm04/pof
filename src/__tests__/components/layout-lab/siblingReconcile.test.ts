import { describe, it, expect } from 'vitest';
import {
  SIBLING_CAP, contentText, keysIn, promptReach, reconcileDirection, reconcileSiblings, unnamedSiblings,
} from '@/components/layout-lab/steps/ux/siblingReconcile';
import { siblingStepsBlock } from '@/lib/catalog/siblingSteps';
import type { LabStepArtifact } from '@/components/layout-lab/labPipelineStore';

/** The pure model behind `?ux=sibling-check`: what the Localization table names, shares and the prompt carries. */

const CATALOG = 'ux-unregistered'; // no pipeline → siblingStepsBlock orders the labels alphabetically
const art = (data: Record<string, unknown>, status?: string): LabStepArtifact =>
  ({ done: true, data, ueAssets: [], at: '2026-10-07T00:00:00.000Z', ...(status ? { status } : {}) });

const TABLE = {
  locKeys: ['CODEX_SUNDER_TITLE', 'CODEX_SUNDER_BODY', 'CODEX_SUNDER_ALT'],
  locNotes: 'Body strings follow the Lore Body step.',
  _provenance: { note: 'mentions Accessibility only in bookkeeping' },
};
const artifacts: Record<string, LabStepArtifact> = {
  Localization: art(TABLE),
  Accessibility: art({ a11yChecks: ['alt text on the illustration', 'x'.repeat(SIBLING_CAP)] }, 'pass'),
  'Concept Brief': art({ brief: 'The world broke.' }, 'pass'),
  'Lore Body': art({ loreBody: 'Long ago… CODEX_SUNDER_BODY' }),
  'UE Packaging': art({ assets: ['ST_Codex :: CODEX_SUNDER_TITLE'] }, 'deferred'),
};
const siblings = Object.fromEntries(Object.entries(artifacts).map(([k, v]) => [k, v.data]));
const ORDER = ['Concept Brief', 'Lore Body', 'Audio Sting', 'Accessibility', 'Localization', 'UE Packaging'];

const model = () => reconcileSiblings({
  catalogId: CATALOG, step: 'Localization', keyField: 'locKeys', data: TABLE, artifacts, siblings, order: ORDER,
});
const row = (label: string) => model().rows.find((r) => r.label === label)!;

describe('keysIn', () => {
  it('finds UPPER_SNAKE keys of 3+ segments and dotted camel keys, once each', () => {
    expect(keysIn('CODEX_A_TITLE, input.action.lightAttack and CODEX_A_TITLE again')).toEqual(['CODEX_A_TITLE', 'input.action.lightAttack']);
  });
  it('ignores two-segment tokens, prose and an absent field', () => {
    expect(keysIn('FOO_BAR is not a key; e.g. this either')).toEqual([]);
    expect(keysIn(undefined)).toEqual([]);
  });
});

describe('contentText', () => {
  it('leaves out bookkeeping fields, so a label in _provenance does not count as named', () => {
    expect(contentText(TABLE)).not.toContain('Accessibility');
    expect(contentText(TABLE)).toContain('Lore Body');
  });
});

describe('promptReach', () => {
  it('reads carried and omitted siblings straight from the block the prompt builder renders', () => {
    const r = promptReach(siblingStepsBlock(CATALOG, 'Localization', siblings));
    // Alphabetical: Accessibility alone is over the cap, so it and everything after it is omitted.
    expect(r.carried.size).toBe(0);
    expect([...r.dropped]).toEqual(['Accessibility', 'Concept Brief', 'Lore Body', 'UE Packaging']);
  });
  it('treats a heading with a seeded/template suffix as the label', () => {
    const r = promptReach('# head\n\n## Lore Body (seeded from the reference — reproduce, do not contradict)\n{}');
    expect(r.carried.has('Lore Body (seeded from the reference — reproduce, do not contradict)')).toBe(true);
  });
});

describe('reconcileSiblings', () => {
  it('lists every pipeline sibling in order, the current step excluded', () => {
    expect(model().rows.map((r) => r.label)).toEqual(['Concept Brief', 'Lore Body', 'Audio Sting', 'Accessibility', 'UE Packaging']);
  });
  it('reads named, shared keys, output state and prompt reach per sibling', () => {
    expect(row('Lore Body')).toMatchObject({ named: true, sharedKeys: ['CODEX_SUNDER_BODY'], state: 'produced', reach: 'dropped' });
    expect(row('UE Packaging')).toMatchObject({ named: false, sharedKeys: ['CODEX_SUNDER_TITLE'], state: 'deferred' });
    expect(row('Accessibility')).toMatchObject({ named: false, sharedKeys: [], state: 'pass', reach: 'dropped' });
    expect(row('Audio Sting')).toMatchObject({ produced: false, state: 'no output', reach: 'absent', sharedKeys: [] });
  });
  it('counts only produced siblings', () => {
    expect(model()).toMatchObject({ produced: 4, named: 1, carried: 0, dropped: 4, keys: TABLE.locKeys });
  });
  it('marks a sibling carried when the block holds it in full', () => {
    const small = { ...siblings, Accessibility: { a11yChecks: ['alt text'] } };
    const r = reconcileSiblings({ catalogId: CATALOG, step: 'Localization', keyField: 'locKeys', data: TABLE, artifacts, siblings: small, order: ORDER });
    expect(r.rows.find((x) => x.label === 'Accessibility')?.reach).toBe('carried');
    expect(r.dropped).toBe(0);
  });
  it('appends a stored label the pipeline no longer lists', () => {
    const extra = { ...artifacts, 'Old Step': art({ x: 1 }) };
    const r = reconcileSiblings({ catalogId: CATALOG, step: 'Localization', data: TABLE, artifacts: extra, siblings: { ...siblings, 'Old Step': { x: 1 } }, order: ORDER });
    expect(r.rows.at(-1)?.label).toBe('Old Step');
  });
});

describe('reconcileDirection', () => {
  it('names the unnamed produced siblings in pipeline order, and the entity name verbatim', () => {
    const dir = reconcileDirection('Localization', 'The Sundering', model());
    expect(unnamedSiblings(model()).map((r) => r.label)).toEqual(['Concept Brief', 'Accessibility', 'UE Packaging']);
    expect(dir).toMatch(/^Reconcile this Localization table with the sibling steps it does not account for: Concept Brief, Accessibility, UE Packaging\./);
    expect(dir).toContain('crossReferences');
    expect(dir).toContain('"The Sundering"');
  });
  it('is empty when every produced sibling is named', () => {
    const all = { ...TABLE, locNotes: 'Concept Brief, Lore Body, Accessibility and UE Packaging agree.' };
    const r = reconcileSiblings({ catalogId: CATALOG, step: 'Localization', keyField: 'locKeys', data: all, artifacts, siblings, order: ORDER });
    expect(reconcileDirection('Localization', 'The Sundering', r)).toBe('');
  });
});
